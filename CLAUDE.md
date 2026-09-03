# Peptide Tracker Staging — Claude Instructions

## 🔒 ALL DATA LIVES IN THE BACKEND — ALWAYS. NEVER ASK AGAIN. 🔒
**Every piece of data — compound/PK/pharmacology parameters, reference ranges,
baselines, catalogue entries, and all user data — lives in `claude-agent-backend`
and is served to the frontends via API at runtime. This is settled and permanent.**

- Do **NOT** ask Henrik where data should live. The answer is always: the backend.
- Do **NOT** hardcode data (compound parameters, Vd, baselines, ranges, catalogues,
  user values) into any public frontend repo. If the frontend needs data, add/extend
  a backend endpoint and fetch it.
- Existing hardcoded consts in the frontend (`PEPTIDE_CAT`, `ENHANCEMENT_COMPOUNDS`,
  `TRT_GUIDE`, `RECON_DB`, `DOSE_GUIDE`, `PRICELIST`, …) are **legacy tech debt** to be
  migrated to the backend over time — never a pattern to copy. All *new* data goes to
  the backend first.
- Algorithm/math constants (e.g. Vermeulen K_SHBG/K_ALB, unit-conversion factors) are
  code, not data — those may live in the frontend.

Henrik has stated this repeatedly. Treat it as a standing rule and act on it without
re-confirming.

## ⚠️ NEVER SWITCH UNITS — pmol/L IS THE ONLY FREE-T UNIT ⚠️
**The free-T / plasma curve is always in pmol/L. There is no second unit and there must
never be one.** Missing or incomplete data changes the **confidence** of a number, never
its **unit**, and never whether a curve is drawn at all.

**What triggered this rule (2026-08-02):** Claude added a "safe" fallback so that when the
model could not calibrate, the chart silently switched to plotting the drug appearance
rate in **mg/day** instead. The result was a y-axis reading 0–35 where the user expected
217+ pmol/L, with a curve that still looked exactly like a free-T curve. Henrik read it as
a broken scale, which is the only reasonable reading. **Nobody asked for that fallback —
Claude invented it while fixing something else.**

**The rules:**
- `unitLabel` for the plasma curve is the literal `'pmol/L'`. Never a ternary, never
  derived from whether calibration succeeded.
- **If bloodwork is missing, use the population average for the user's age** and label it
  clearly as an estimate/educated guess, with a prompt to add a blood test. The curve is
  still drawn, still in pmol/L. Degrade the *confidence*, never the unit.
- A user's own free-T value typed in **without a date cannot anchor the curve** — the
  anchor DAY sets the whole scale, and guessing it made a pre-cycle baseline get read as
  an accumulated mid-cycle level. Fall back to the age-based population value, which is
  unambiguously an untreated baseline and anchors at day 0.
- Never invent a fallback behaviour that was not requested. If a state cannot be handled,
  say so in the UI in the user's own terms — do not quietly render a different quantity.
- Tests assert `unitLabel` is never assigned `mg` and that a no-lab case still returns
  `pmol/L` at the population average. Keep them.

## ⚠️ UI CONSISTENCY — ALL COMPOUND TIERS MUST BE IDENTICAL ⚠️
Every compound tier (Peptides, TRT, Enhanced) must have **exactly the same UI features**. If one tier shows dose recommendations, all tiers must show dose recommendations. If one shows an info card, all must. If you add a UI element to one tier, immediately add it to all others in the same session.

**Non-negotiable parity rules:**
- Dose guidance (`_renderDoseGuide` / `_renderTRTGuide` / `_renderEnhancedGuide`) shown in BOTH the add-compound modal AND the edit/configure view for every tier
- Unit dropdowns must include all units used by any compound in that tier (e.g. `IU/day`, `IU/week` for GH Axis; `mg/week`, `mg/day`, `mg/EOD` for androgens)
- Info cards (mechanism, side effects) shown consistently across all three tiers
- No tier may have a feature that another tier is silently missing

When a new compound tier feature is added, check all other tiers before closing the PR.

## ⚠️ THE INJECTION LOG IS THE TRUE RECORD — A CHECKED DOSE IS THE PAST ⚠️
Henrik, 2026-08-07: *"any checked injection needs to be counted regardless of which
stack it actually belonged to. Also the Stack concept might be changed or updated in
the future, so the checked injections is the only source of truth to the past."*
And: *"the injection log must be treated as the true record of what was injected.
Also it needs to be well protected in backups."*

`injections.json` is the canonical history. `_tcp.manualLog`, a stack's config and a
saved plasma curve are all **derived views** — when one disagrees with the injection
log, the log is right and the view is stale.

**This does not contradict the section below.** "The stack is the container" governs
**writing**: nothing new is scheduled outside a stack. This governs **reading the
past**: the stack a dose was filed under is irrelevant history.

- Selection for the past is `logged === true` and **nothing else** — not `cycle_id`,
  not whether the owning stack is active, not the `active` flag (that retires a
  *schedule*, not a recorded event), not a date window beyond the PK bound.
- `_tcFetchHistory` reads its own 400-day window straight from the backend. It must
  **never** be re-pointed at `_injectionsCache`, which is scoped to what Today needs
  (14 days back) and is exactly what broke this.
- A past-dated dose that was never ticked is a plan the user did not confirm taking,
  and is excluded. `_tcProtocolInjections` is future-only.
- The past is added to the curve **first** and outranks every planner, so a draft
  preview can change the future without rewriting what already went in.
- **Editing history means editing the record.** T-Calc's add `POST`s a real injection
  with `logged:true`; its delete `DELETE`s `/injections/<id>`. Both then re-read the
  history rather than assuming. Writing to `manualLog` alone is a silent no-op — it is
  a cache and the next render rebuilds it. That bug shipped twice in one day
  (delete, then add); do not reintroduce it by "just updating the list".
- `_tcLoadLogFromStack` refuses to rebuild `manualLog` unless the history is fully
  loaded. A partial source once overwrote the stored log with a fortnight of it.

**What triggered this (2026-08-07):** six weeks of logged TRT — two Testoviron Depot,
then 100 mg Nebido E2D from 26 June — rendered as roughly 40% of the real accumulated
level, and in simple-planner mode contributed nothing at all. Three filters compounded:
the 14-day cache window, the active-stack filter, and a bound-stack `cycle_id` filter.
At Nebido's 56-day half-life essentially nothing from June had cleared.

The curve states what it stands on ("Built on N checked injections since …") precisely
so a gap shows as missing data rather than as a low number. Keep that line.

## ⚠️ NEVER MERGE OR CONSOLIDATE SERIES CARDS ⚠️
Henrik, 2026-08-14: *"never merge cards, this is how I experiment with different
schedules and doses, currently I get 10 injections out of a 4ml vial of Nebido."*

Several separate SERIES cards covering the same compound, back to back in time, are
**deliberate**. They are the experiment surface: one run at one dose and cadence, the
next at another, each editable on its own and each visible as its own block on the
curve. Two adjacent cards are not a run that got split by accident and they are not
untidy.

- **Never** merge, coalesce, de-duplicate or "normalise" series that share a compound,
  whether in the planner, in a migration, or as cleanup while fixing something else.
- Never collapse them in the rendering either — the card list is the control surface.
- If a genuine bug has split one run in two, say so and let Henrik decide. Do not
  repair it silently; from the outside a deliberate experiment and an accidental split
  look identical, and only he knows which it is.

**A series usually maps to a VIAL, which is why its dose count is load-bearing.**
Nebido is 1000 mg in 4 ml (`TRT_CAT`), so 100 mg EOD is exactly 10 injections per
vial. A series that quietly comes back two doses short is not a cosmetic problem — it
is the vial no longer adding up. That is what made the `_tcSaveEditSeries` bug of the
same date (past-dated doses discarded on every save, 10 requested → 8 written) worth
the regression matrix now guarding every creation permutation.

**This rule survives the 2026-08-16 rewrite.** T-Calc's series cards go away with its
planner, but the requirement moves with the capability: the compound UI must let the
same compound appear more than once in a protocol, back to back at different doses and
cadences, each editable and each its own block on the curve. A rewrite that can only
express "one compound, one dose, one cadence per protocol" has removed the experiment
surface, and is not done. See `docs/unified-plan-rewrite.md`.

## ⚠️ SUPERSEDED 2026-08-16: T-CALC NO LONGER SCHEDULES ANYTHING ⚠️
Henrik, 2026-08-16: *"we are dropping the T-calc style scheduling and returning to the
compound UI that is much easier to understand for a user. The visualisation of Free T
will still be avail under Levels, but we wont keep the planning from t-calc at all."*

**The 2026-08-14 rule "T-Calc owns testosterone — it is the only scheduler" is dead.**
Do not obey it, do not restore it, do not cite it as precedent. Its text is gone from
this file; its vocabulary is still in the code (`_isTestosteroneComp`,
`_tcalcOwnsTestoNote`, `_injSuppressed.reason==='tcalc'`) and is being removed. The
replacement is specified in `docs/unified-plan-rewrite.md` — read that before touching
any scheduling code.

**What replaces it:**
- **One scheduler: `_genInjBatches` / `generateAndPushInjections`.** The testosterone
  suppression inside it is removed. Every compound in a protocol generates its own
  injections through the same path — peptides, androgens, HGH, ancillaries alike.
- **T-Calc keeps the curve, loses the planner.** Under Levels it renders the free-T
  curve and the injection history. It no longer writes, edits or deletes any injection.
  `docs/unified-plan-rewrite.md` §3.4 lists every function being deleted.
- **Planning lives only in the Plan tabs** (Peptides / Compounds / Supplements). TRT and
  Enhanced merge into one Compounds tier — which is what removes the original cause.
  The 2026-08-14 rule existed because two tiers were double-scheduling the same
  molecule; with one tier there is no second stream to arbitrate, and no reason to take
  the scheduler away from the UI the user actually understands.

**Still true, and not superseded by any of the above:**
- **One stream per molecule.** Whatever the UI looks like, a given testosterone must be
  generated by exactly one thing. The 27 `enhanced/test_u` rows sitting beside 23
  `trt/nebido` rows in Protocol 2 is the failure this guards against.
- **Readers select on what a row IS, never on which cycle it was filed under.**
  `_blTcalcTestosterone` and `_tcalcTrtSummary` were broken for weeks because they
  matched `cycle_id === 'tcalc'`, a namespace that had already moved. Match on
  tier/compound identity via `_tcIsTestoRow`, and compare compound ids canonically
  (`_tcCanonCompId`) — the two catalogues key the same ester under different ids
  (`test_u` vs `nebido`), which alone caused three separate bugs.
- **Nothing is deleted, edited or hidden as a side effect.** Every injection already
  stored stays exactly as it is. Deletes are global and are Henrik's call.
- **A row that stops generating with no explanation is the bug, not the fix.** If
  suppression is ever reintroduced anywhere, it must be visible in the UI.

**Migration status (2026-08-19): Phases 0–5 have landed.** `_genInjBatches` emits
testosterone again, the tiers are merged into one Compounds tab, and every T-Calc write
path is disabled behind `_TC_PLANNING_REMOVED`. The planner UI is still on disk and comes
out in Phase 6. Do not extend it, do not fix its scheduling bugs by adding features to
it, and do not write new callers of it.

**One stream per molecule is now enforced in the generator itself.** `_genInjBatches`
dedupes by canonical id across the TRT and Enhanced blocks, so an unmigrated protocol
holding `trt/nebido` beside `enhanced/test_u` schedules it once and records the other in
`_injSuppressed` with `reason:'duplicate'`. Never remove that dedupe on the grounds that
the migration makes it redundant — it is what makes the generator safe for a protocol
nobody has migrated yet.

**Record entry is not planning.** T-Calc's Add sheet still writes past-dated doses the
user says they took; only its future/plan half is refused. Logging a dose you already
took is the mid-cycle onboarding path and has no other home yet.

## ⚠️ THE STACK IS THE CONTAINER — NO INJECTIONS OUTSIDE ONE ⚠️
Henrik, 2026-08-06: *"T-calc should be used in the stack wizard, and testosterone
injections should be part of a stack. No injections can exist outside of a stack
'object'."* And: *"T-calc needs to save and read injections to a stack."*

**Who schedules testosterone is settled separately — see the section above.** This
section governs where an injection LIVES (always a stack's `cycle_id`); that one governs
who writes it (always T-Calc).

**The model:**
1. A **stack (protocol)** owns its compounds and its cycle — `id` (frozen) and
   `cycle_start`. It is the only container.
2. **`injections.json` is the single source of truth** for the schedule. Every
   injection carries `cycle_id = <stack id>`.
3. **T-Calc is a planner over one stack's testosterone**, not a parallel store. It
   READS that stack's injections (`_tcLoadLogFromStack`, on every build) and WRITES
   edits back under the same stack `cycle_id`. `_tcp.simplePlan` stays in the profile
   because it is the plan's *input* — compound, dose, cadence, start — never the
   derived dated schedule.

**What triggered this (2026-08-06):** `_tcp.manualLog` lived in `tcalc_profiles.json`
and was pushed ONE WAY into `injections.json` under its own `tcalc` / `tcalc:<id>`
cycle namespace. Two stores for the same facts, and nothing ever read back. Two
symptoms, one cause:
- **T-Calc rendered empty while its injections still showed in Today** — the profile
  lost its log; the pushed injections were still stored, and nothing could reconcile
  them.
- **Two testosterone injections on the same day** — T-Calc wrote under `tcalc*` while
  the stack wrote its own testosterone under the stack's `cycle_id`. Same compound,
  two cycle ids, both rendering. `_reconcileStackTestoSource` never fired, because it
  begins `if(_tcp.targetStackId!==stack.id)return;` — its precondition is exactly the
  case that was going wrong.

**The rules:**
- Never reintroduce a `tcalc`, `manual`, or any other cycle id that is not a stack id.
  Legacy rows still RENDER (refusing to write a new one must never make stored
  injections vanish) but nothing new is written outside a stack.
- Never store a dated schedule anywhere but `injections.json` **as a second permanent
  copy** — that is what this section exists to prevent. Plan *parameters* are fine,
  a persisted parallel schedule is not.
- **An UNSAVED DRAFT is the exception, and it is required (clarified 2026-08-08).**
  Henrik: *"the user flow would always be add injections and when happy with the curve
  then save it to a protocol. Its a planning tool!"* **Save to protocol** is the moment
  of persistence — `_tcSetTargetStack` binds the stack and then calls
  `_tcSyncLogToBackend` — so a planned dose necessarily exists **before** any stack
  does. Those doses are marked `draft:true` in `manualLog` and `_tcLoadLogFromStack`
  carries them forward; without that they were erased on the next `buildTCalc()` and a
  10-dose series starting today saved only the one logged dose for today.
  A draft is not a second copy of stored data — it is data the record does not have
  yet. The carry-forward is deliberately narrow: only entries marked `draft`, only
  from today onwards (the record owns the past, so a draft can never resurrect a
  deleted row), and a draft the record has caught up with retires itself. Tests cover
  all four. Do not "fix" this back into an unconditional rebuild.
- T-Calc must read on open. A planner that only writes cannot detect that it has
  drifted from what is stored.
- Saving a T-Calc schedule goes through **Save to protocol**: pick an existing stack
  or create one (TRT, or Enhanced for tier 3 only — greyed out below that, and
  refused in the action, not just the button).

## ⚠️ AN ACTIVE PROTOCOL RENDERS — AND ACTIVATION STARTS ITS CYCLE ⚠️
Henrik, 2026-08-06: *"An active protocol must render, but stack creation needs to
make start date the date it is activated if not set prior to."*

- `refreshInjectionsCache` adds a cycle id for **every active stack**, with or without
  a `cycle_start`. Requiring one meant an active protocol with no start date
  contributed nothing and every dose it owned was filtered out — 679 stored
  injections and a Today showing only the T-Calc entry.
- `_ensureCycleStart(idx)` sets `cycle_start` to today when unset, on all four
  activation paths: toggling on, `useStack`, the wizard's first protocol, and starting
  from a template. An existing date is never overwritten.
- **ORDER MATTERS.** `_deriveStackCycleId()` includes the start date, so setting one
  on a stack whose id is not yet frozen MOVES its cycle id and orphans every injection
  already stored against `name_nostart`. `_ensureStackId` runs first — that is what it
  is for — then the date is set. Tests assert this ordering.
- Today never claims "Nothing scheduled today" while stored doses were filtered out.
  It says how many are hidden, names the protocol, and offers a way through to Plan.

## ⚠️ RESEARCH SCOPE — ALWAYS THE FULL CATALOGUE ⚠️
When conducting research, building databases, or compiling reference data for these apps:
- **Never** scope research to only the compounds Henrik is currently using
- **Always** scope to the **complete catalogue** — every entry in `PEPTIDE_CAT`, `TRT_CAT`, `ENHANCEMENT_COMPOUNDS`, and any other compound data structure in the app
- The database must serve all potential users and all potential use cases — not just the current user's active protocol
- This applies to: compound reference data, bloodwork panels, drug interaction tables, AI prompt design, RAG knowledge base construction, and any other research task

## ⚠️ COMPOUND DATA LIVES IN BACKEND ONLY — NEVER IN PUBLIC REPOS ⚠️
All peptide and compound information is **commercially sensitive and proprietary**. It must **NEVER** be stored in any public repository (`peptidetracker`, `peptidetracker-staging`, `workout`, `workout-staging`).

This includes, but is not limited to:
- Peptide catalogue data (names, SKUs, mechanisms, protocols, side effects, dosing defaults)
- Enhancement compound data (concentrations, vial sizes, anabolic profiles, dosing guidance)
- Reconstitution data (vial/water volumes, concentration defaults)
- Dose guidance tiers and risk labels
- Pricelist / SKU mappings
- Any supplier-specific product data

**The only place this data may live is `claude-agent-backend`.** The frontend apps must fetch it from the backend at runtime — never hardcode it into `index.html`, `tab-cycles.js`, or any other file in a public repo.

**Current state (as of 2026-06-21):** `PEPTIDE_CAT`, `ENHANCEMENT_COMPOUNDS`, `RECON_DB`, `DOSE_GUIDE`, `DEFAULT_PHASES`, `PRICELIST`, and related constants are still hardcoded in `index.html` / `tab-cycles.js`. This is a known technical debt. **Do not add new compound data to these files** — any new compounds or data updates must go into the backend and be served via API.

## ⚠️ RESEARCH & REFERENCE DOCS LIVE IN THE BACKEND — `docs/enhanced-bodybuilding/` ⚠️
**All peptide/enhancement/compound research, protocol, and reference documents
live in `claude-agent-backend/docs/enhanced-bodybuilding/` — the single canonical
home for this material.** Never store research/reference/protocol docs in this
public repo (or any public frontend repo); the reasoning is identical to the
compound-data rule above (commercially sensitive, proprietary).

When you research, compile, or write any cycle/dosing/compound/protocol reference
material, it goes there — not into this repo, and not left only as a chat reply.

### 📚 EVIDENCE STANDARD — MANDATORY, ZERO TOLERANCE FOR HALLUCINATION OR BRO-SCIENCE
**Every recommendation, dose, mechanism, or risk claim — in those docs, in the
app's dose guidance, or in anything Claude tells Henrik — MUST be backed by
published, peer-reviewed research or an established clinical guideline.**
- **No citation → do not state it as fact.** If it can't be sourced, leave it out
  or explicitly label it *anecdotal / low-evidence*.
- **Bro-science, forum lore, coach dogma, and confident-but-unsourced AI output
  are NOT acceptable sources.** Where popular practice contradicts the evidence,
  the evidence wins.
- **Fabricating or guessing a citation (author, journal, year, PMID) is the worst
  possible failure** — worse than omitting the claim. Verify before writing.
- Where evidence is thin, pre-clinical, or animal-only, say so in-line.

### 🔻 Primary sources CAN be downloaded — do it, never ask
Your sandbox cannot reach DailyMed, FDA, eMC, EuropePMC or PubMed (all 403 through the
agent proxy). That is **not** a reason to leave a value unsourced or to cite a web-search
summary as though you had read the document. `claude-agent-backend` has
`scripts/fetch_sources.py` + the **Fetch research sources** workflow, which runs on a
GitHub runner (full internet) and commits retrieved document text to
`claude-agent-backend/docs/enhanced-bodybuilding/sources/`. Add the source, trigger the
workflow, pull, read the file, then cite it. Henrik's standing instruction (2026-07-29):
**"Dont even ask me before downloading research to support app development."** Full
procedure and the cautionary Labetalol incident are in that repo's CLAUDE.md.

## ⚠️ NO PRICES IN THE APP — NEVER ⚠️
Supplier pricing is commercially sensitive and must **NEVER** appear in any app UI, rendered HTML, or user-facing output. The `PRICELIST` const in `index.html` (and `tests/pricelist.csv`) contains only vial sizes and quantities (`q`, `unit`, `n` fields) — **no `usd` or price fields**.

Rules:
- **Never add a `usd`, `price`, or any cost field** to `PRICELIST` entries
- **Never display US$ amounts, per-box prices, or grand totals** in the Shopping List modal or anywhere else
- `PRICELIST` is used **exclusively** for quantity calculations (how many vials/boxes needed per cycle)
- `pricelist.csv` must have only 3 columns: `SKU Code;Products Name;Mg*vials` — no price column ever

## ⚠️ HISTORY VIEWS READ AND PLOT — THEY NEVER CALCULATE ⚠️
**Any view whose job is to show *stored history* must load it from the backend and draw
it. Full stop. No re-derivation, no recomputation, no backfill, no "re-capture if the
data looks stale or empty" — not even once, not even as a convenience.**

The split is:
- **The tab that owns the model computes** — e.g. T-Calc owns the free-T PK model.
- **It persists only on an explicit user action** — a "save/update history" control the
  user presses (`tcSaveHistoryFromCurve`), storing the curve **exactly as displayed**.
  Nothing captures automatically: not on view load, not on profile save, not even when a
  past injection is logged. Stored history stays exactly as the user last saved it until
  they choose to refresh it. (Confirmed 2026-07-25: "corrected, then never touched unless
  I ask for it.")
- **The history view loads that and plots it.** If the backend has nothing, it shows an
  empty state that says where the data comes from. It does **not** helpfully generate one.

**What triggered this rule (2026-07-25):** `buildTHist()` in `tab-thist.js` backfilled
whenever the store looked empty *or* the stored tail extended past the last injection.
Opening the T-History tab therefore recomputed the entire series with whatever the client
model happened to be that build, and wrote it back **over the stored values**. Two
consequences, both bad:
- A bug anywhere in the PK model silently **rewrote saved history** — the data the user
  had was replaced by a fresh wrong answer, with no action on their part.
- The view stopped being a view. It disagreed with the source of truth it existed to show,
  and read ~10× high because it inherited a calibration-anchor bug from the live model.

**Why "just backfill once if it's empty" is still wrong:** it is indistinguishable from
the failure above. Empty *is* a valid state, and the fix for missing data is to make the
owning tab capture it, never to have the reader invent it. "Stale" heuristics are worse —
they overwrite data that was correct when it was written.

**The rule:**
- A history/read view may call `fetch` + render. Nothing else.
- If you are about to add "compute the series here so the chart isn't blank", stop — that
  is this bug.
- Regression tests assert `buildTHist` contains no capture/compute/model call. Keep them.

## ⚠️ localStorage IS A CACHE — NEVER THE SOURCE OF TRUTH ⚠️
localStorage is a read cache for performance only. It is NEVER the source of truth.

**Every single localStorage write MUST be paired with a backend push in the same code path — no exceptions.**

This means:
- `setData(key, value)` alone → WRONG
- `localStorage.setItem(key, value)` alone → WRONG  
- `setData(key, value)` + `push*ToAgent(...)` in the same call → CORRECT

A "Wipe local cache" button exists in Settings specifically to verify this: after wiping, ALL user data must come back from the backend on next load. If anything is lost after a wipe, that data was relying on localStorage as its source of truth — which is a bug.

This rule was violated multiple times (wk-db-*, wk-gear-* were localStorage-only). Any new data type must have a backend endpoint AND be included in the startup sync before it can be written to localStorage.

## ⚠️ BACKEND IS THE SOURCE OF TRUTH — EVERY SAVE MUST HIT THE BACKEND ⚠️
**Every user-facing data operation (save, update, delete) MUST be persisted to
the backend immediately — no exceptions, ever.** localStorage is only a local
cache for display. The backend is the source of truth.

Rules that are NOT negotiable:
- Every `save*()` function MUST call the corresponding `push*ToAgent()` function
- Every `delete*()` function MUST call the corresponding `delete*FromAgent()` function
- Every new data type added to the app needs BOTH a localStorage write AND a
  backend push in the same operation
- `setData(key, value)` or `localStorage.setItem()` alone is NEVER sufficient —
  always pair it with the backend call
- The backend data file for every endpoint MUST use the persistent volume pattern:
  `Path("/data/foo.json") if Path("/data").exists() else Path(...) / "data" / "foo.json"`
  (ephemeral container filesystem is wiped on every redeploy)

This rule applies to dose logs, body comp, weights, settings — **everything**.
Violating this has caused repeated data loss incidents.

## ⚠️ NO CROSS-APP LOCALSTORAGE READS — EVER ⚠️
Each app owns its localStorage keys exclusively. **NEVER read another app's
localStorage keys** (e.g., peptidetracker must not read `bf_log` which belongs
to workout; workout must not read `proto-bodycomp-v2` which belongs to
peptidetracker). Both apps run on the same origin (`viritasorg.github.io`)
and can technically read each other's keys, but doing so is categorically
forbidden.

The backend is the ONLY cross-app source of truth. If data must flow between
apps, it goes through the backend — never through shared localStorage.

## ⚠️ READ THE RECORD DIRECTLY — NEVER INSTRUMENT THE UI TO INSPECT DATA ⚠️
Henrik, 2026-08-14: *"solve so you can read backend data sources directly, updating
the UI to validate data is stupid."*

**`API_SECRET_RO` is already set in Claude's sandbox and the backend is reachable from
it** — verified 2026-08-14. When a question is about DATA, read the data:

```
curl -sS -H "x-api-secret: $API_SECRET_RO" \
  "$AGENT_URL/admin-data/records?app=peptide-stage&file=injections.json&email=<account>&limit=2000"
```

`app` is a `data_registry.APPS` key — `peptide`, `peptide-stage`, `workout`,
`workout-stage`, `trt`, `trt-stage`. Rows are at `[r['row'] for r in resp['records']]`.
The credential is GET/HEAD/OPTIONS only. Full procedure: `claude-agent-backend/CLAUDE.md`.

**Never add a counter, a chip, a debug line or any other UI to find out what is
stored.** That ships UI nobody asked for to answer a question the record already
answers.

**What this cost (2026-08-14).** A "flat area" in the free-T curve was chased through
~10 rounds of screenshots and five UI changes. One `/admin-data/records` call settled
it: the user's testosterone was filed under the **Enhanced** tier (`test_u`) while
every entry point into the free-T model filtered `tier === 'trt'`, discarding 4 logged
and 26 scheduled doses. Intermediate diagnoses — missing doses, unticked doses,
duplicate rows — were all wrong, and each produced advice that would have corrupted the
user's data by adding injections that already existed.

**PROD AND STAGING ARE SEPARATE DATA.** `APP_ID = IS_STAGING ? 'stage' : ''`, so the
two apps write to different namespaces on the same backend. A dose ticked in staging
does nothing to prod. Never explain a difference between them without reading both.

Reading the record is also how a fix is VALIDATED: replay the real rows through the
changed filter and state before/after counts per account, rather than asking for
another screenshot.

## ⚠️ LOCAL CLONE RULE — NEVER SKIP ⚠️
Local clones at `/home/user/<repo>` are **NOT automatically up to date**. A
session can be hours old and the remote may have moved on. **Before reading or
copying any file from a local clone, always pull it fresh:**
```
git -C /home/user/<repo> fetch origin && git -C /home/user/<repo> checkout origin/main -- <path>
```
or `git -C /home/user/<repo> pull origin main` for the whole tree. Skipping
this step has caused production regressions multiple times. No exceptions.

## This is the repo Claude works in
`peptidetracker` (prod) is **READ-ONLY** for Claude — see its CLAUDE.md.
All actual development (features, fixes, refactors) happens here on
`peptidetracker-staging`. Claude may freely branch, commit, push, open PRs,
and merge on this repo following the workflow below.

## ⚠️ CROSS-APP PARITY — SHARED INFRASTRUCTURE ⚠️
`peptidetracker-staging` and `workout-staging` share large swaths of
infrastructure code. **Any bug fix or change to shared infrastructure must be
applied to BOTH apps in the same session — never fix one and leave the other.**

Shared infrastructure (non-exhaustive):
- **Push to Prod** — `pushToProd()`, `pollPromoteStatus()`, `pollProdVersion()`, `renderPromoteStatus()`
- **Settings sync** — `syncSettingsFromAgent()` / `syncPepSettingsFromAgent()`, `pushSettingsToAgent()`, theme/prefs persistence
- **Update checker** — `checkForUpdate()`, `checkAppVersion()`, version banner
- **Auth flow** — Google Sign-In, token handling, `authHeaders()`
- **Backend API calls** — `AGENT_URL`, endpoint patterns, error handling
- **IS_STAGING pattern** — any environment-branching logic

When you fix or change any of the above in one app, immediately check the other
app for the same issue and fix it before closing the session.

## ⚠️ TESTS ARE MANDATORY — NO EXCEPTIONS ⚠️
This section existed only in `workout-staging` until 2026-08-14, which is how the
repo where most development actually happens ended up without it. Added here and to
`claude-agent-backend`; `trt-stage` states it inline.

- **New feature or changed feature** → add tests covering the new behaviour in
  `tests/test_frontend.js`
- **Bug fix** → add a regression test that **fails on the pre-fix source**. Run it
  against the old file and say so in the PR. A test that passes either way proves
  nothing, and this suite has shipped several of those.
- **Run `node tests/test_frontend.js index.html` and confirm 0 failures before opening
  any PR**
- Never merge a PR whose CI test job is failing or pending

### A SOURCE GREP IS NOT COVERAGE
Asserting that a function *contains* a string catches "someone deleted the await". It
does not catch "the resulting schedule is wrong", which is what actually ships. Where a
function can be called, **call it and assert what it produces** — stub the DOM fields
and record `fetch` if you must (see the schedule-creation permutation block for the
pattern). Reserve greps for ordering and for rules that are genuinely structural.

**What the absence of this cost (2026-08-14):** the Add sheet and series editor were
guarded only by greps. An edit silently discarded the past-dated half of every series —
"10 injections every 2 days" saved as 8, and every further save shed two more — with a
green suite throughout.

### GENERATED DATA NEEDS OUTPUT-LEVEL TESTS
`generateAndPushInjections` / `_genInjBatches` decide the tier, compound id, dose, unit
and cadence of every injection a protocol writes. Until 2026-08-14 every test either
stubbed the function out or asserted it had been *called* — its output was never
checked. That is the code path that files testosterone under the Enhanced tier, which
the free-T model then discarded: 4 logged and 26 scheduled doses missing from a user's
curve, found only by reading the backend record.

## ⚠️ ONLY FIX WHAT WAS ASKED — NO UNSOLICITED CHANGES ⚠️
Fix exactly what Henrik asked. **Never change anything else**, even if it looks
like an improvement. This applies especially to:
- Visual appearance: colors, gradients, opacity, fills, chart styling
- Layout or spacing
- Unrelated logic or data handling

If you notice something that could be improved while fixing a bug, mention it
in your reply — do NOT silently change it. Unsolicited "improvements" cause
confusion, break things Henrik didn't intend to change, and waste debugging
time. **One PR = one explicitly requested change.**

## ⚠️ BUILD THE MVP — SUGGEST THE REST, DON'T SHIP IT ⚠️
Henrik, 2026-09-03: *"not build features I haven't asked for. Pls suggest ideas
and tweaks but always build mvp versions if new features. I do occasionally find
bloated features and it makes the app seem confusing at times."*

**Ship the smallest version that does what was asked, then stop.** Everything you
thought of beyond that goes in the reply as a suggestion — never into the diff.

This is the sibling of "ONLY FIX WHAT WAS ASKED" above. That rule is about not
touching code *outside* the request; this one is about not inflating the thing
*inside* it. A feature can be entirely on-topic and still ship three times bigger
than what was asked for.

**These are unrequested features, not thoroughness:**
- A setting, toggle, filter or preference for something asked for as one fixed
  behaviour
- An extra panel, badge, summary line, empty state or chart added "while I was in
  there"
- Advice, guidance or explanatory copy nobody asked to be shown — especially
  advice keyed on something the user has not actually configured
- A second way to do something that already has one way
- Handling a case that has not come up yet, in case it does

**Each of those ships as a sentence, not as code:**
> Built X. I could also add Y — want it?

**Why: the cost is the screen, not the code.** Every element competes for attention
with the ones that matter. A screen carrying three things nobody asked for reads as
confusing rather than as generous, and bloat has been found in the shipped apps more
than once. A feature that is hard to explain in one line is usually bigger than the
request that produced it.

**What this rule does NOT license:**
- **Not an excuse to skip tests, error handling, or any other rule in this file.**
  Minimal in SURFACE AREA, never in correctness.
- **Not permission to delete existing features** you have decided are bloat. See
  "MY FIX MADE IT REDUNDANT" below — say so in your reply and ask.
- **Not permission to ask before doing the work itself.** Build the MVP and report
  it; do not stop for approval on the thing you were just asked for.

## ⚠️ "MY FIX MADE IT REDUNDANT" IS NOT PERMISSION TO REMOVE IT ⚠️
This is the single most common way the rule above gets bypassed — through internal reasoning rather than intent.

**The exact failure (2026-06-25):** A bug was fixed where T3 users didn't always get the Enhanced wizard step. Fix: auto-include `'enhanced'` in `_wiz.goals` inside `initWizard()`. Claude then reasoned: *"The Enhanced toggle in Goals is now redundant — T3 users always have it auto-included."* Claude removed the toggle without being asked. Users lost the ability to opt out of Enhanced on a per-stack basis and saw a blank section with no explanation.

**Why this reasoning is always wrong:**
- "Redundant" is the user's call, not Claude's
- A default and a toggle serve different purposes even when the default is always-on — the toggle gives the user agency to override it per-stack
- A side-effect of your fix appearing "unnecessary" is not the same as being asked to remove it
- This is still a violation of "ONLY FIX WHAT WAS ASKED," just disguised as logical cleanup

**The rule:**
- Make the fix. Stop. Do not touch anything the fix made look unnecessary.
- If your fix genuinely makes something obsolete, **say so in your reply and ask** — never remove it silently.
- You may only remove code that was **explicitly named** in the request.

## ⚠️ A VERIFIED ERROR IN AN md FILE GETS FIXED IMMEDIATELY ⚠️
Henrik, 2026-08-08: *"When you find verified errors in md files always fix em
instantly."*

If you establish that something in a `CLAUDE.md` (or any md in these repos) is
**wrong** — not merely stale-sounding or awkward — correct it in that session. Do
not flag it and wait, do not add it to a TODO, do not ask whether to bother.

- **Verified** means you checked: you read the workflow, ran the command, or saw
  the run. A hunch is not a finding, and "this reads oddly" is not an error.
- Fix it where it is wrong, in every writable repo that repeats the claim — these
  files are copied between repos, so one wrong sentence usually exists in several.
- Say what was wrong and why in the commit and in your reply, so the next session
  can tell a correction from a drive-by edit.
- **This does not license rewriting rules you disagree with.** A rule you think is
  mistaken is Henrik's call — say so and leave it. This is for statements of fact
  that are demonstrably untrue: a workflow that does not do what the file says, a
  file credited with behaviour it does not have, a value that no longer matches.
- A SETTLED marker still wins. If a value is marked settled, raise it, do not edit.

## Git workflow — ALWAYS follow this
### ⚠️ CLAUDE ALWAYS CREATES AND MERGES ITS OWN PRS — NEVER ASK HENRIK ⚠️
**Claude must NEVER ask Henrik to create a PR, merge a PR, or do anything with GitHub.**
Claude has `mcp__github__create_pull_request` and `mcp__github__merge_pull_request` tools.
Use them. Every time. No exceptions. Asking Henrik to touch GitHub is a failure.

0. **Always create new branches from the latest remote main — never from a local clone's stale HEAD:**
   ```
   git fetch origin && git checkout -b <branch-name> origin/main
   ```
   This ensures any AI (Claude, or another AI picking up when Claude hits token limits) always starts from a clean, up-to-date base and can hand off without conflicts.
1. Make changes on a feature branch
2. Before opening the PR, locally extract the `<script>` block from `index.html` and run `node --check` on it — catch syntax errors before they ever hit CI
3. `mcp__github__create_pull_request` — do this yourself immediately after pushing
4. Check CI: `pull_request_read` with `method: get_check_runs` — wait for `conclusion: success`. If still running, poll. If failed, fix and re-push. **Never merge with failing or pending checks.**
5. `mcp__github__merge_pull_request` — once CI is green, merge it yourself immediately

   **⚠️ "Immediately" means WITHOUT WAITING TO BE TOLD. Henrik, 2026-08-20: *"Amd stop
   waiting with merging stuff, now you been blocked several times today wasting my
   time."*** Green CI is the go-ahead; there is no second approval step. Do not end a
   turn with a merge-ready PR open, do not describe a PR as done when it is only
   opened, and never write "I'll merge it when CI is green" and then stop — poll the
   check and merge in the same turn.

   What this cost on 2026-08-20: #1017 and #1020 both sat green and unmerged while
   Henrik was testing. He had to ask *"Merged yet?"* and *"Still only see 677? Is 678
   deployed?"* — and 678 did not exist, because the fix he was looking for was sitting
   in an open PR. He was testing an app that could not contain the change.

   A PR is not delivered until it is **merged, version-bumped and deployed**. Report
   those three, not "PR opened". The only reasons to leave one open are the two below:
   CI red or pending, or a review comment that has to be answered first.
5. After merge the `version-bump` GitHub Action increments the minor version in
   `version.json` and `const VERSION` in `index.html`. **It does NOT commit with
   `[skip ci]`** (corrected 2026-08-08 — the file said so, the workflow never did):
   it pushes a `version-bump/vX.Y` branch, opens a PR and auto-merges it, falling
   back to merging directly when auto-merge is unavailable. So the bump arrives as
   its own squash-merged commit on `main`, and Pages deploys **that** commit — which
   is why step 6 checks the Pages run against the bump SHA, not the merge SHA.
   The run also prunes superseded `version-bump/*` branches, which used to
   accumulate forever (407 of them here before #865)
6. **After merging, confirm the deploy before telling the user it's live.**

   **Preferred — read the `deploy-status` branch. No API, no polling, no rate limit:**
   ```
   git fetch origin '+refs/heads/deploy-status:refs/remotes/origin/deploy-status' \
     && git show origin/deploy-status:deploy-status.json
   ```
   ⚠️ **The explicit refspec is required, not decoration.** This checkout is cloned
   single-branch — `git config --get-all remote.origin.fetch` returns only
   `+refs/heads/main:refs/remotes/origin/main` — so a plain `git fetch origin
   deploy-status` fetches into FETCH_HEAD and never creates `origin/deploy-status`.
   The `git show` then fails with "unknown revision", which looks exactly like the
   workflow not having run. It cost one wasted watcher on 2026-08-20, the same day the
   branch was introduced.
   `.github/workflows/deploy-report.yml` writes it on the `deployment_status` event —
   the moment Pages finishes publishing — carrying `version`, `state`, `sha` and
   `finished_at`. `state: success` with the version you expect IS the confirmation.
   Wait for it with a `git fetch` loop, never a REST poll.

   Fall back to the API only if that branch is stale or missing:
   - `mcp__github__actions_list` (method: list_workflow_runs, resource_id: version-bump.yml) → `conclusion: success`, read the bumped version from the commit message
   - `mcp__github__actions_list` (method: list_workflow_runs, resource_id: pages-build-deployment) → latest run `conclusion: success` and `head_sha` matching the bump commit

   ⚠️ **Never confirm a deploy with unauthenticated `curl` to api.github.com.** It is
   rate-limited, and on 2026-08-20 six watchers built that way died mid-run and reported
   "no terminal state" for deploys that had actually succeeded — which reads as a broken
   deploy and wastes a round trip correcting it. Use the branch, or the MCP tool, which
   is authenticated.

   Only once the deploy is confirmed say "live as vX.XXX — test now". DO NOT say "live"
   after just the version-bump — that only commits the bump, it does not deploy. DO NOT
   attempt to curl or WebFetch `viritasorg.github.io` — outbound network access to that
   host is blocked in this remote environment and will always fail.

## ⚠️ SOMETIMES A PUSH CREATES NO WORKFLOW RUN — RE-TRIGGER, NEVER ASSUME
Intermittently, a push or PR produces **no workflow run at all** — not queued, not
pending, nothing red. CI never appears, and Version Bump does not fire on the merge
either (the merge simply lands un-bumped).

**Absent checks are NOT green checks.** `total_count: 0` is not success. Verify a run
exists before you believe anything about it.

**Re-trigger with an EMPTY COMMIT:**
```
git commit --allow-empty -m "chore: re-trigger CI" && git push
```
That is the only thing observed to work. **Closing and reopening the PR did nothing**,
and with no run created there is nothing to re-run.

How strong is that? **It has now been tried twice and worked once** (corrected
2026-08-12). On 2026-08-08 the empty commit produced runs on all three affected repos
within a couple of minutes, after ~40 minutes of nothing. On **2026-08-12 it did not
work**: `peptidetracker-staging` PR #878 and `trt-stage` PR #134 sat at
`total_count: 0` for ~10 minutes, an empty commit was pushed to each, and still no run
appeared. (`claude-agent-backend` was unaffected in the same minutes and ran CI
normally on PRs #204 and #205.)

So it is worth trying first and it is **not** a fix. When it fails, the procedure is
the one that always applies: run the suite locally, **say so explicitly in the reply**,
never imply CI passed, and **do not merge** — leave the PR open rather than routing
around the missing check.

**Never route around a required check.** This repo requires the `test` check on `main`,
so the merge is refused outright ("Required status check *test* is expected"). That is
the guardrail working — get a run, do not look for a way past it.

**What has been seen:**
- 2026-08-07, ~20:19–20:42 — `claude-agent-backend` only.
- 2026-08-08, ~09:24–10:04 — `peptidetracker-staging`, `workout-staging` and
  `claude-agent-backend`, hitting **both** CI and Version Bump. `trt-stage` was
  unaffected in the same minutes and bumped normally.
- 2026-08-12, ~14:40–14:55 — `peptidetracker-staging` and `trt-stage` only, on PRs
  #878 and #134. **The empty-commit re-trigger did not recover it.** The backend ran
  CI normally throughout, so it was not account-wide.

Every time, Actions were otherwise alive (scheduled runs fired, `workflow_dispatch`
worked, and at least one repo was unaffected in the same minutes). It is intermittent and not a property of any credential — do not turn it into
a rule that pushes never trigger workflows.

**A merge left un-bumped is usually harmless — check before acting.** If the merge
touched only `CLAUDE.md` or other non-app files, what Pages serves is unchanged and
`version.json` still matches the live build: leave it, do not force a bump for a docs
change. If it touched `index.html` or a `tab-*.js`, the deploy did not happen — say so
plainly rather than reporting the change as live.

## Promotion to prod — Claude must NOT trigger this
Promotion only happens via **Henrik clicking "Push to Prod"** in the staging
app's Settings UI, which fires a `repository_dispatch` event that runs
`.github/workflows/promote-to-prod.yml`. That workflow diffs staging against
`peptidetracker`, opens a PR on `peptidetracker`, **and then auto-merges it
once CI passes** (step 6, "Wait for CI and merge prod PR") — so a single Push
to Prod goes all the way to a live prod deploy. It does **not** leave a PR
waiting for review.

**What this means for Claude (corrected 2026-07-17):** the merge is the
workflow's own built-in behavior — Claude never hand-merges the prod PR, and
must never make any other change directly to `peptidetracker`, or **initiate**
a new promotion, without Henrik's explicit go-ahead in that specific moment.
Re-running a promotion run **Henrik already triggered** (e.g. after fixing the
token) is completing an action he authorized, not starting a new one — that is
allowed; firing a fresh `repository_dispatch`/Push to Prod yourself is not.
*(Earlier versions of this note wrongly said the workflow only opens a PR that
must never be auto-merged. The workflow has always auto-merged; the note was
out of date.)*

**PROMOTE_TOKEN secret (resolved 2026-07-17):** the promotion workflow needs a
`PROMOTE_TOKEN` repository secret (a PAT with write access to `peptidetracker`)
under Settings → Secrets and variables → Actions. This was previously missing
(and briefly stale, causing `Bad credentials` on the prod checkout step);
Henrik has since added/refreshed it and promotion now runs green. Claude has no
tool to create/edit repo secrets, so if it breaks again Henrik must update it.

## ⚠️ NEVER HARDCODE PERSONAL USER DATA — GDPR / DATA ISOLATION ⚠️
Personal data belonging to a specific real user must **NEVER** be hardcoded anywhere in the codebase.

**What triggered this rule (2026-06-24):**
- Backend `protocol.py` injected Henrik's personal peptide protocol into every new user's empty stack via `_repair_empty_peptides()`.
- `tab-macros.js` used `|| 92` (Henrik's body weight) as the fallback for all users who hadn't set their weight — wrong data shown to every new user.

**Rules — no exceptions:**
- Never hardcode any real user's data (body weight, doses, compounds, dates, config) as a constant, default, or fallback
- Neutral fallbacks only: `0`, `""`, `[]`, `null` — never a specific person's real value
- Never write "repair" or "migration" helpers that populate missing user data from another user's values
- Any one-time migration must be scoped to the specific target `user_id`, have a clear expiry, and be removed once confirmed complete
- Every read/write of user data must be gated by the authenticated user's identity — never cross user boundaries

**Second incident (2026-08-05) — seeded records:** four constants held one person's
real records and wrote them into **every** user's storage: `SEED_LOGS` (33 training
sessions), `SEED_WEIGHTS` (37 bodyweight readings), `BF_SEED` and `BC_SEED` (body-fat
and neck/belly measurements). The backend had the same thing: `routers/bodycomp.py`
re-inserted three readings via `_ensure_seed()` **on every module import**, i.e. every
restart — so deleting one never stuck. All removed. `tests/test_no_hardcoded_personal_data.py`
(backend) and equivalent frontend checks now fail if any of it reappears.

## ⚠️ DELETES ARE GLOBAL — SAY SO BEFORE DELETING ⚠️
Henrik, 2026-08-05: *"delete entries need an extra confirmation step explaining
that the delete is global."*

Deleting a record removes it from the **backend**, so it is gone from every device
signed into that account — not just the one in front of you — and there is no undo.
Every delete of a stored record goes through `confirmGlobalDelete(what)`, which says
exactly that. Do not write a bare `confirm('Delete this?')`, and never delete a
stored record with no prompt at all.

**What triggered it:** `deleteWeight` and `deleteBf` deleted silently, with no
confirmation of any kind. The rest used generic wording ("Delete this protocol?
This cannot be undone.") that read like a local action.

- A new delete that reaches the backend must use the helper — tests assert every
  existing one does, and that the old local-sounding prompts are gone.
- The helper lives in `index.html` and is called from the tab files, so it is
  available everywhere.

## ⚠️ AUTH WARNING — READ BEFORE TOUCHING ANY AUTH CODE ⚠️
**PIN/passcode auth has been PERMANENTLY REMOVED.** Google Sign-In is the ONLY
end-user authentication method across this entire ecosystem (peptidetracker,
peptidetracker-staging, workout, workout-staging, claude-agent-backend). The
whitelist currently contains ONLY `henrik.schaub@gmail.com`. **NEVER
reintroduce a PIN, passcode, shared-secret, or any non-Google login for end
users** — not even as a "fallback" or "legacy" path. The only other credential
in the system is `x-api-secret`, used exclusively by Claude's own backend
tooling, never by end-user-facing apps.

## Deployment
- GitHub Pages (staging URL) — deploys automatically on push to `main`
- Monitor live version: `https://viritasorg.github.io/peptidetracker-staging/version.json` — **CANNOT be fetched by Claude** (outbound network to `viritasorg.github.io` is blocked in this remote environment). Use GitHub Actions status to confirm deployment instead.

## Environment-aware code — NEVER hardcode staging/prod URLs
`index.html` is a single file that gets promoted from staging to prod verbatim.
Any URL or value that differs between environments **must** use `IS_STAGING`:

```js
const IS_STAGING = (window.location.pathname||'').startsWith('/peptidetracker-staging');
```

Examples of things that must be dynamic, not hardcoded:
- `version.json` fetch URL (use `IS_STAGING ? '.../peptidetracker-staging/...' : '.../peptidetracker/...'`)
- Any feature flags or UI elements that should only appear in one environment

The `IS_STAGING` constant is already declared at the top of the `<script>` block, right after `const VERSION`.

## ⚠️ SI UNITS ONLY — NEVER SURFACE "mcg" ⚠️
The US "mcg" is **never** to be shown to the user or stored as a canonical unit —
the correct SI symbol is **`µg`** (micro sign U+00B5 + g). This is settled and permanent.
- Canonical unit value is `µg`; the unit dropdown (`UNITS` in tab-stack.js) and every
  peptide catalogue default use `µg`, never `mcg`.
- `_canonUnit(u)` (index.html) maps any legacy `'mcg'` data → `'µg'` on read; use it at
  every point a stored unit is compared or displayed so old data renders as `µg`.
- Comparisons may still *accept* legacy `'mcg'` as input (back-compat), but code must
  never *emit* `mcg` into rendered HTML, dose labels, dropdowns, or exports.
- Same rule for any future unit: use the SI symbol, not a US medical abbreviation.
- `%` is a valid unit for topical/transdermal products (creams/gels) — concentration,
  e.g. a 1% testosterone cream.

## App structure
- Single-file app: `index.html` (JS, CSS, HTML all inline)
- `version.json` — current version, read by the update-checker in the app
- `const VERSION='x.xx'` in index.html must match `version.json`
- Version bump workflow auto-increments both on merge to main

## Day-of-week display — ALWAYS Monday-first
**Weeks start on Monday** throughout the app. Every day-chip grid, schedule view,
and weekly label must display Mon → Sun (not Sun → Sat).

- `DAYS_SHORT=['S','M','T','W','T','F','S']` — indexed by JS `getDay()` (0=Sun)
- `DAYS_ORDER=[1,2,3,4,5,6,0]` — iteration order for all day-chip renders (Mon first)
- `tab-schedule.js` uses `dowMap=[1,2,3,4,5,6,0]` — same pattern, keep in sync
- **Never** iterate `DAYS_SHORT` by natural index (0→6) for display — always use `DAYS_ORDER`
- Internal `days[]` arrays still use JS dow values (0=Sun, 1=Mon, …, 6=Sat) — display order only

## 🔎 DEFERRED — CodeQL findings on the promoted apps (raised 2026-08-02)

Moving the repos into the **ViritasOrg** enterprise org turned on **CodeQL code
scanning by default**. Its first run on a promoted prod PR raised three **High**
findings in `workout`'s `index.html`:

| Finding | Note |
|---|---|
| Clear text storage of sensitive information (`gender`) | Likely a false positive — a profile field needed for BMR/macros, stored in the user's own localStorage. Candidate for "dismiss with reason". |
| DOM text reinterpreted as HTML | Genuine XSS-shaped pattern. Worth fixing, not dismissing. |
| DOM text reinterpreted as HTML | Same. |

**These describe code that was ALREADY live in production.** The scanner is new;
the code is not. Nothing regressed at the migration.

**Status: deferred by Henrik on 2026-08-02 — "it will need to be solved next week."**
Do not treat this as done, and do not silently dismiss the two DOM findings to
make a dashboard green.

**Why promotion is no longer blocked by them:** the `Wait for CI and merge prod PR`
gate used to fail on ANY failed/cancelled check on the prod commit, so a scanner the
repo does not control could block a deploy (as could a `pages-build-deployment`
cancelled by a visibility change). The gate now selects the **`test`** check by name.
A failing test still blocks the merge; other red checks are printed to the log
(`Note: non-blocking checks not passing: ...`) and triaged in the Security tab.
**Never widen that gate back to "any check" — and never narrow it so test failures
stop blocking.**

When picking this up: the three apps share rendering code, so the DOM findings very
likely exist in all of them, not just `workout`. Check every app, not only the one
CodeQL happened to scan first.
