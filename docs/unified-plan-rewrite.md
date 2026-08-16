# Unified Plan rewrite — one scheduler, three tabs

Status: **proposed, not started**
Author: drafted 2026-08-16 with Henrik
Scope: multi-day. Ships in phases, each independently mergeable and revertible.

---

## 1. What changes, in one paragraph

`Plan` becomes the only place a dose is ever scheduled, and it holds three tabs:
**Peptides**, **Compounds**, **Supplements**. The `TRT` and `Enhanced` tiers merge into
a single **Compounds** tier — testosterone, nandrolone, GH, orals and everything else sit
together, all belonging to a Protocol.

**T‑Calc's scheduling is deleted, not relocated.** Scheduling returns to the compound UI
that the protocol editor already uses — pick a compound, set a dose, a frequency or a set
of weekdays, a start date and an optional end date. That is the interface users
understand, and it already exists and works for peptides and for every non‑testosterone
compound. Testosterone simply rejoins it.

`Levels → Testosterone` keeps the plasma curve and the exposure card, and `T‑History`
keeps the stored history — both become **read‑only views** of what the protocol has
scheduled and what has been ticked. After this, nothing outside Plan writes an
injection.

---

## 2. Why — the concrete case

This is not a tidy‑up. Every bug fixed on 2026‑08‑15/16 was a symptom of the same two
structural faults, and they will keep producing bugs until the structure changes.

### Fault A — testosterone has two owners

The 2026‑08‑14 rule ("T‑Calc owns all testosterone") made `_genInjBatches` suppress
testosterone in both tiers, but left T‑Calc as a *second* scheduler alongside the
protocol generator. What followed, in one working day:

| # | Bug | Root cause |
|---|-----|-----------|
| 1 | Saving a T‑Calc plan **deleted the schedule and created nothing** | `_tcWritePlanToStack` deleted, then called `generateAndPushInjections`, which suppresses testosterone. Delete, then silence. |
| 2 | Editing a series didn't change the curve | `_tcSaveEditSeries` synced the record but never refreshed `_injectionsCache`, which the curve also reads. |
| 3 | Shortening a series left doses behind | The prune deleted by TRT‑catalogue ids only; rows stored under Enhanced ids survived. |
| 4 | A protocol showed Nebido and scheduled nothing | Enhanced‑tier testosterone is suppressed; with no T‑Calc plan bound, zero rows existed and nothing said so. |

Every one of these is "two owners disagreeing about who writes what". One scheduler
deletes them as a class.

### Fault B — two catalogues key the same molecule differently

`TRT_CAT` uses `nebido`, `enanthate`, `cypionate`, `propionate`, `sustanon`.
`ENHANCEMENT_COMPOUNDS` uses `test_u`, `test_e`, `test_c`, `test_p`, `sustanon`.
`_TC_TESTO_ALIAS` maps between them. Every comparison in the codebase must therefore
remember to canonicalise, and **three separate bugs on 2026‑08‑16 were one side
canonicalising and the other not**:

- `refreshInjectionsCache` compared raw ids → every T‑Calc dose in an Enhanced‑tier
  protocol was classed an orphan, hidden, and (before the delete was removed) destroyed.
- The "testosterone not scheduled" note keyed off the same filtered cache → it told the
  user *"no plan is saved to this protocol"* about a protocol that had one.
- The prune list omitted the Enhanced ids → doses that could not be deleted from the UI.

Field evidence, from the Stored Doses readout on 2026‑08‑16 — one protocol, one
molecule, two id spaces, two tiers:

```
protocol_2_nostart | nebido | tier=trt        6 rows,  1 logged, 16 Aug → 26 Aug
protocol_2_nostart | test_u | tier=enhanced  25 rows,  0 logged, 18 Aug → 5 Oct
```

Merging the tiers lets one catalogue and one id space replace both.

### Fault C — the same dose is planned in two places

A user can add a series in T‑Calc and a compound in the protocol editor, and the two do
not know about each other. The curve then merges `manualLog`, the simple plan and
`_tcProtocolInjections` and de‑duplicates on `(compound, date)` — a de‑duplication that
only exists because two planners can describe the same injection. With one planner it is
dead code.

---

## 3. Target architecture

### 3.1 Navigation

```
Plan ─┬─ Peptides      the protocol's peptides, their schedules, and Reconstitution
      ├─ Compounds     testosterone, other androgens, GH, orals — one tier
      └─ Supplements   unchanged

Levels ─┬─ Blood Levels    unchanged
        ├─ Testosterone    plasma curve + exposure card   ← READ ONLY
        └─ T-History       stored history                 ← READ ONLY
```

**Decided 2026-08-16:**

- **Reconstitution moves inside Peptides.** It is a per-peptide calculation (vial size,
  bacteriostatic water, units per dose), so it belongs beside the peptide it is for
  rather than as a sibling tab. `PRIMARY_GROUPS.plan` drops `recon`; the `recon` tab id
  and `buildRecon()` survive as a section rendered within the Peptides tab, so the
  existing calculator is reused rather than rewritten.
- **Timeline is removed.** Never used. Delete `tab-timeline.js`, its entry in
  `TAB_LABELS`/`TAB_DEFAULTS`/`SUBTAB_LABELS`/`PRIMARY_GROUPS`, its `proto-tab-vis`
  toggle, and the `MILESTONES` const if nothing else reads it. Check for stray
  `buildTimeline()` callers before removing the file.

That leaves Plan at exactly three tabs, as briefed.

### 3.2 One scheduler

The scheduler is the one the app already has: `_genInjBatches` /
`generateAndPushInjections`, with the testosterone suppression removed so it emits every
tier again. Nothing new is built here — a capability is *restored*.

A single module owns turning *protocol configuration* into *stored injections*, for
every tier:

```
Protocol config ──► scheduler ──► POST /injections/batch ──► the record
   (Plan tabs)                          │
                                        └──► refreshInjectionsCache ──► Today, curve, history
```

Rules, non‑negotiable:

1. **Only the scheduler writes injections.** No other module calls `/injections`,
   `/injections/batch`, or `DELETE /injections` for planning purposes. Today's tick
   (`PUT /injections/{id}` to set `logged`) is the sole exception — that records an
   event, it does not plan one.
2. **Every write is followed by `refreshInjectionsCache()`**, then the affected views
   rebuild. Bug #2 above was exactly this step missing.
3. **The scheduler is the only thing that expands a series into dates.** Curves,
   histories and Today read stored rows; they never re‑derive a schedule.

### 3.3 What T‑Calc keeps and loses

| Keeps | Loses — **deleted, not moved** |
|-------|--------------------------------|
| `_tcFreeTSeries` — the PK/free‑T model | Add series / Edit series / Delete series |
| The plasma curve draw + zoom/pan | Simple planner (ester/dose/cadence/start) |
| Exposure card, evidence citations | "Save to protocol", "Push to schedule" |
| Bloodwork calibration + SHBG model | `_tcp.manualLog` as an editable list |
| `Update saved history` → T‑History | every write path listed in §3.4 |

### 3.4 What gets deleted

All of these exist only to schedule from T‑Calc and go with it:

```
_tcSyncLogToBackend      _tcPostPlanInjections     _tcCreatePlannedInjections
_tcWritePlanToStack      _tcSavePlanToStack        _tcSaveEditSeries
_tcRemoveSeries          _tcConfirmAddSheet        _tcPushLogToSchedule
_tcp.manualLog           _tcp.simplePlan           _tcPlanDraft / _tcPlanDirty
_tcSimplePlanInjections  _tcProtocolInjections     _tcLoadLogFromStack
```

Two judgement calls, flagged rather than assumed:

- **`_tcCreateLoggedInjections`** writes *past* doses the user says they took — the
  mid‑cycle onboarding path. That is record entry, not planning, so it should survive.
  Decide where it lives: a "log a past dose" action in Today, or in the Compounds tab.
- **`_tcalcOwnsTestoNote`** and the "testosterone not scheduled" banner both exist to
  explain the split ownership. When the split goes, they go.

### 3.5 This reverses the 2026‑08‑14 rule

CLAUDE.md currently carries **"T‑CALC OWNS TESTOSTERONE — IT IS THE ONLY SCHEDULER"**.
That rule is superseded by this rewrite and its section must be replaced, not quietly
left to rot — a stale rule in CLAUDE.md is worse than none, because it will be obeyed.

The rule was not wrong about the problem it solved: before it, the TRT and Enhanced tiers
each generated their own testosterone and a protocol held **27 `enhanced/test_u` rows
beside 23 `trt/nebido` rows** for the same molecule. It was wrong about the remedy — it
moved ownership to a *third* scheduler instead of removing the duplication, and the
duplication was only ever possible because two tiers described one molecule.

**Merging the tiers removes the cause.** With one Compounds tier and one id space there is
no second generator to contend with, so testosterone can be scheduled by the same
generator as everything else. The 2026‑08‑07 "one stream per molecule" principle is
preserved and is now structural rather than enforced by a suppression rule.

`_isTestosteroneComp` is deleted along with the suppression it gates. What replaces it is
the catalogue's own `isTestosterone` flag (§4.1), used to decide what feeds the **PK
model** — never to decide what gets scheduled.

The curve's input collapses from four sources to one:

```
before: _tcLoggedHistory() + manualLog|simplePlan + _tcProtocolInjections()   (deduped)
after:  the stored injections for the active protocol, logged and planned
```

`_tcCurveLog()` becomes a thin read of `_injectionsCache` plus logged history, with no
merge and no de‑duplication. `_tcInputsReady()` (added 2026‑08‑16) stays — the curve must
still wait for history, cache and bloodwork before drawing.

---

## 4. Data model

### 4.1 Tier vocabulary

Stored rows carry `tier` ∈ `{peptide, trt, enhanced}`. After the merge:

```
peptide   → peptide     unchanged
trt       → compound    migrated
enhanced  → compound    migrated
```

`tier` still matters — it selects the catalogue, the dose units, and whether a row feeds
the testosterone PK model. Replace the tier test with an explicit property on the
compound (`isTestosterone`, from the catalogue) rather than inferring it from the tier,
which is what `_isTestosteroneComp('trt', c) === (tier === 'trt')` does today and is why
*every* TRT‑tier compound is treated as testosterone.

### 4.2 Compound ids

One catalogue, one id per molecule. `_TC_TESTO_ALIAS` becomes a **migration table**, not
a runtime lookup: read both spellings, write only the canonical one, and stop.

Choose the surviving id space in Phase 0. Recommendation: keep the **TRT/PK ids**
(`nebido`, `enanthate`, …) because the PK model, `_TC_T_FRACTION` and the plasma curve
already key on them, and the backend's `trt_catalog.py` is the richer source.

### 4.3 Backend

No schema change is required. `POST /injections/batch` already gives exactly the
semantics the scheduler needs — per `(cycle_id, compound_id)` it drops unlogged rows from
`from_date` onward, preserves logged ones, and refuses to re‑insert into a slot holding a
logged row (`routers/injections.py`, `batch_upsert`). Verified 2026‑08‑16.

The catalogue merge is a **backend change** (`routers/compounds.py`,
`routers/trt_catalog.py`) and per CLAUDE.md all data lives there — the frontend must not
hardcode the merged list.

### 4.4 A compound may appear more than once in a protocol

CLAUDE.md, **"NEVER MERGE OR CONSOLIDATE SERIES CARDS"** (Henrik, 2026‑08‑14): *"never
merge cards, this is how I experiment with different schedules and doses, currently I get
10 injections out of a 4ml vial of Nebido."* T‑Calc's series cards disappear with its
planner, but that requirement moves with the capability — the Compounds tab must express
**the same compound, twice, back to back, at different doses or cadences**, each editable
on its own and each its own block on the curve. A protocol editor that can only hold one
row per compound has deleted the experiment surface, and Phase 4 is not done.

This is the one place the rewrite needs more than the existing protocol editor gives,
and it collides with the backend:

- `POST /injections/batch` keys on **`(cycle_id, compound_id)`** — a second run of the
  same compound in the same protocol would prune the first one's unlogged rows.
- So either the batch key gains a third component (a per‑entry id), or the scheduler
  submits all runs of a compound in **one** batch with a single `from_date`. The second
  is a frontend‑only change and is the recommendation; take it unless Phase 3 finds a
  reason not to.
- Either way `from_date` must be the earliest unlogged date across all of that
  compound's runs, or an earlier run gets silently truncated when a later one is edited
  — the 2026‑08‑14 vial‑count bug in a new costume.

Regardless of the mechanism, **never coalesce two adjacent runs**, in the scheduler, in
the migration, or in the rendering. If the migration finds runs that look accidentally
split, report them and let Henrik decide (§5 dry‑run).

---

## 5. Migration

Existing records carry the old tiers and both id spaces. Rows already logged are the
user's record and **must not be rewritten**.

```
1. Read-both / write-one     ship first, before any UI change.
                             Every comparison canonicalises both sides.
                             Nothing is rewritten yet. Reversible.

2. Backfill (one-shot)       tier trt|enhanced → compound
                             compound_id test_u → nebido (etc.)
                             logged rows: tier/id updated, date/dose/logged untouched.
                             Behind an explicit user action, never automatic.

3. Read-one                  drop the alias fallback once the backfill is confirmed.
```

Step 1 is largely done — `refreshInjectionsCache` canonicalises both sides as of
2026‑08‑16 (`COMPARE CANONICAL IDS`), and the prune covers both spellings as of 1.647.

A dry‑run is mandatory: report what step 2 *would* change, per group, in the shape the
Stored Doses card already prints, before anything is written.

---

## 6. Phases

Each phase is a mergeable PR that leaves the app working.

| # | Phase | Deliverable | Risk |
|---|-------|-------------|------|
| 0 | Decisions | §8 answered; id space chosen; Recon/Timeline placement settled | — |
| 1 | Catalogue merge (backend) | one compound list, `isTestosterone` flag, both ids resolvable | low |
| 2 | Read‑both/write‑one | every id comparison canonicalised; dry‑run report | low |
| 3 | Scheduler extraction | one module owns all injection writes; existing UI calls into it | **high** |
| 4 | Plan: Compounds tab | TRT + Enhanced editors merged into one | medium |
| 5 | Un‑suppress the generator | `_genInjBatches` emits testosterone again; CLAUDE.md rule replaced | **high** |
| 6 | T‑Calc read‑only | every write path in §3.4 deleted; curve reads stored rows only | medium |
| 7 | Migration | backfill tiers and ids, after dry‑run approval | **high** |
| 8 | Cleanup | `_TC_TESTO_ALIAS` runtime use and the curve's dedup removed | low |

Phases 3 and 5 are where this can go wrong. Both touch the code that writes the user's
record; both need the full behavioural test set below green before merge.

---

## 7. Tests

The suite is at 2839 checks and is the reason this session's regressions were caught. The
rewrite must **extend** it, not replace it. Specifically, these invariants get behavioural
tests (driving the real functions against a stub backend, not source greps):

- A logged dose is never moved, duplicated, un‑ticked or deleted by any planning action.
- Editing a schedule changes the record **and** the cache **and** the curve, in that order.
- Shortening a schedule removes exactly the dropped dates, whichever id or tier they carry.
- Nothing outside the scheduler issues a write to `/injections` — assert by grepping the
  other modules for `method:'POST'|'DELETE'` against `/injections`.
- The curve never draws from partial inputs (`_tcInputsReady`).
- A protocol with a compound configured but nothing scheduled says so.
- Two runs of the same compound in one protocol both survive a save of either one, keep
  their own dose counts, and are never merged (§4.4).
- Migration dry‑run reports exactly what the backfill would change, and changes nothing.

Carry over the existing regression blocks from 2026‑08‑15/16 — the tick/untick history
re‑read, the hidden‑dose counting, the canonical‑id matching, the cache re‑read on edit.
Those encode bugs that cost a day; they must survive the restructure.

---

## 8. Open questions for Henrik

1. **Id space** — keep `nebido`/`enanthate` (PK‑aligned, recommended) or `test_u`/`test_e`?
2. **Where does "log a past dose" live?** `_tcCreateLoggedInjections` is the only
   surviving record‑entry path from T‑Calc (§3.4). Today, or the Compounds tab?
3. **Migration timing** — backfill everything in one action, or leave legacy rows readable
   and only write new ones canonically?
4. **`Push to Prod`** — this is a multi‑day change on staging. Promote per phase, or hold
   prod at the current version until the whole rewrite lands?

---

## 9. Deleting bad data — the admin UI

Decided 2026-08-16. Stray rows keep appearing that no app screen can remove: on
2026-08-16 a protocol held 26 `test_u`/`enhanced` doses running to 5 Oct, generated by
the Enhanced tier before testosterone scheduling moved to T-Calc. Nothing in the app owns
them, so nothing in the app can delete them — the same shape as the 1000 mg Nebido test
row that motivated the admin API in the first place (2026-08-07).

**Corrected 2026-08-16: this already ships.** An earlier draft of this section said the
admin API was "unused by any UI" and that `admin-whitelist.html` called only `/whitelist`
and `/backups`. That was read off a stale copy and is wrong. `claude-agent-backend`'s
admin page has a **Records** tab (one of four: users / backup / records / upload) wired
to the endpoints below, and the endpoint prefix is `/admin-data`, not `/admin`.

| endpoint | purpose | in the UI |
|----------|---------|-----------|
| `GET /admin-data/files` | which registered files can be inspected | file dropdown |
| `GET /admin-data/records` | one account's rows from one file | search (AND over terms) |
| `POST /admin-data/delete` | delete selected rows — `dry_run` defaults **true** | Preview → confirm |
| `POST /admin-data/patch` | edit a field on selected rows | — not surfaced |
| `POST /admin-data/inject-series` | write a series of logged doses | Records tab |
| `POST /admin-data/upload` | bulk load rows into a file | Upload tab |

Owner-only, registered-filename lookup (never a path from user input), one account at a
time, and **a backup before every destructive write**. The delete flow is already two
steps — dry run, then a confirm dialog naming the account, the file, the matched count
and the untouched-other-accounts count.

So the stray rows are removable today, by hand, per app namespace (`peptide` and
`peptide-stage` are separate data and both carry them). What is still missing is small:

1. **Structured filters.** Search is a free-text AND over the row JSON. The strays
   present as a `(cycle_id, compound_id, tier)` group, so filters on those fields plus a
   date range and `logged` would turn a 26-checkbox selection into one action.
2. **A guard on `logged` rows.** They are the user's record. Today they are labelled
   `logged` in the row summary and are otherwise selectable like any other row — a bulk
   selection can include one without a second look. Deleting a logged dose should take
   its own explicit confirmation naming the dose and date.
3. **A "select all matching" action**, so a filtered group can be deleted without
   ticking each row.

This lives in **`claude-agent-backend`**, not in either app repo.

---

## 10. What this does not change

- The injection log stays the record. Every delete is global and destructive; the
  scheduler hides and reports rather than deleting whatever it cannot positively identify
  as its own output (the rule added 2026‑08‑16 after the orphan delete destroyed doses).
- The free‑T model, its calibration and its citations are untouched. The curve is drawn in
  `pmol/L` and only in `pmol/L`.
- Today stays the only place a plan becomes a record, by ticking.
- All data continues to live in the backend.
