# Peptide Tracker Staging — Claude Instructions

## 🚦 THE WORKFLOW — STAGE, THEN PING. NEVER PROD. 🚦
**Henrik, 2026-09-08, verbatim: "you must move code to Stage, and once ready for
test ping me, but never ever push to prod!!"**

Every piece of work Claude does follows exactly three steps:

1. **Move the code to Stage.** Commit, push the branch, open the PR against
   `main` on `peptidetracker-staging`, wait for CI, and **merge it**. Staging
   `main` is branch-protected, so a direct `git push origin main` is rejected —
   a PR is the only route, and pushing the branch alone is NOT done. Work that
   sits on an unmerged branch has not been delivered. Do not stop to ask
   permission for any of this; it is pre-authorised, standing.
2. **Ping Henrik that it is ready for test.** Say what landed and what to look
   at. That is where Claude's job ends.
3. **Never push to prod. Ever.** No exceptions, no "obvious" fixes, no
   hotfixes, no CI-green argument, no "he said yes last time". See
   *Promotion to prod* below — the prohibition there is absolute and Claude
   may not talk itself past it.

### 🛑 "DONE" IS RESERVED FOR MERGED. NOTHING ELSE EARNS THE WORD.
Added 2026-09-10 after Claude pushed four commits to a branch and reported them as
*"Done — staging, b990b30"*, three separate times across one session. Every rule needed
to prevent that was **already written above, verbatim, and pre-authorised.** The failure
was not the branching — it was calling a branch push delivery.

Until the PR is **merged into `main`**, Claude may not write *done*, *shipped*, *landed*,
*live*, *delivered*, *what shipped this session*, or describe the change in the present
tense ("the card now says…"). A commit SHA is not delivery. "Pushed" is not delivery.
CI passing is not delivery.

- Before claiming anything is delivered, verify it: `git fetch origin main` then confirm
  the change is actually on `main`. **Quote the `main` SHA, never the branch SHA** — the
  branch SHA is what made the false reports look precise and checkable.
- Until then the only accurate phrasing is "on a branch, **not delivered**".
- This applies to docs-only changes too.

### 🛑 OPENING THE PR IS NOT DELIVERY EITHER. MERGING IS NOT HENRIK'S HOMEWORK.
Added 2026-09-16 after Claude opened **five** PRs in one session, merged none, and closed
the reply with a *"suggested merge order"* for Henrik to run. Same failure as 2026-09-10
above in a better suit: **handing Henrik the last step and calling the job finished.**

- A PR is the mechanism, not the outcome. Neither opening it, nor green CI, nor a good
  description, is delivery.
- **Never end a reply with a merge order or "ready to merge."** If Claude can work out the
  order it can execute it — writing it down and stopping is *more* work than merging.
- **Rebasing stacked PRs is Claude's job.** "These will want a rebase" names the remaining
  work; it does not excuse leaving it. Land one, rebase the next, re-run, merge.
- All of it or none: landing three of five has delivered nothing that can be called done.
- Only a failure **this change caused** blocks a merge — fix it. A pre-existing red on
  `main` is not a blocker: name it and merge.
- Before ending any session that touched code, `git fetch origin main` and confirm every
  branch it created is merged, or abandoned with a stated reason.

If something genuinely needs Henrik's input, finish everything that does not
depend on the answer, land it on stage, and end the reply with a **numbered
list of questions**. Do not bury a question inside a long explanation — it will
not be read.

## 🔗 ONE NUMBER, ONE SOURCE — NOTHING MAY DISAGREE WITH ITSELF 🔗
**Henrik, 2026-09-08: "make it a rule that nowhere in any app can there be data
not agreeing with each other."**

Across every app in this ecosystem — peptidetracker, peptidetracker-staging,
workout, workout-staging — **the same quantity must have exactly one definition,
in one place, and every surface must read it from there.** Two screens showing
different numbers for the same thing is a defect on its own, even when both
numbers are individually defensible, and even when nobody has noticed yet.

This applies to all of it: compound parameters, half-lives, dose tiers,
reference ranges, unit conversions, pharmacological models, and the derived
figures shown on screen.

**In practice:**
- A quantity read from the backend is read from the backend *everywhere*. Never
  copy a served value into a constant "so this tab doesn't have to fetch".
- One model, one implementation. If two tabs answer questions about the same
  drug, they call the same function — a second implementation is how they start
  disagreeing. The Dose Finder is isolated from T-Calc's *data* and still shares
  its pharmacology (`_tcFreeTSeries`) for exactly this reason.
- One renderer for one kind of content. Dose guidance is `_renderEnhancedGuide`
  in every tab that shows it, so wording and numbers cannot drift apart.
- A derived figure names its source. If a number is computed rather than
  measured or served, say which, so a reader can tell them apart.
- Fix disagreements at the source, never at the display. Patching one screen to
  match another leaves the two definitions in place and hides the drift.

**When you find two places disagreeing:** say so immediately, identify which one
is authoritative, and make the other read from it. Do not average them, do not
pick the one that looks nicer, and do not leave both in place with a comment.

This is why hardcoded frontend data is tech debt rather than a shortcut: every
copy is a future disagreement. See the standing backend rule directly below —
the two rules are the same rule seen from different sides.

<!-- BEGIN ORG-WIDE RULES v12. Canonical copy: ViritasOrg/claude-agent-backend docs/org-rules.md. Edit it there, then copy this block unchanged into every ViritasOrg repo's CLAUDE.md (scripts/check_org_rules.py finds drift). -->
## Org-wide rules: every ViritasOrg repo (canonical v12, 2026-11-03)

These rules are identical in every repo's `CLAUDE.md` under `ViritasOrg`. Rules further down in this file add repo-specific detail. If one of them seems to contradict this block, say so to Henrik instead of silently picking one. They bind every session, whatever started it (Claude Code, claude.ai, a Project, a scheduled task, an agent).

### Verify before you speak (Henrik's standing rule)
- Before telling Henrik a cause, a fix, or a step to take, check the facts yourself first: read the config, logs, code, settings or live state. Never present a guess as the answer.
- Never send him to repeat something he may already have done; check whether it is already done first.
- If something can't be verified, say exactly what is unverified, instead of giving an instruction built on an assumption.
- If you notice you'd have to write "let me find the actual cause instead of guessing", you already broke this rule: the checking belongs before the first answer, not after he pushes back.
- **Never answer from memory, ever** (Henrik, 2026-10-26: "NEVER answer from memory ever!", https://github.com/ViritasOrg/flyt/issues/910). Training memory is not a source. Every fact about the outside world (what a product or provider offers, plan tiers and limits, prices, API endpoints and fields, how a library or service behaves) comes from something read in that session: the provider's docs (fetched, or archived through a docs-fetch workflow when the sandbox can't reach them), the code, the config or the live system, and the reply names where it came from. Not read yet? Read it before answering. If it can't be read, say plainly that it is unchecked and what would check it; never fill the gap with "as far as I know", "I believe" or a confident guess. Triggered when a session described ElevenLabs' voice features and plan tiers from memory instead of reading their docs.

### Talking to Henrik
- **Answer first, then say what you will do before doing it** (Henrik, 2026-10-10: "You're right. I'll answer first and say what I'm doing before I start."). A question gets its answer in the first lines, before any tool call. Before starting any work (a workflow, a PR, a deploy, waiting on CI), say in one line what you are about to do and why; never disappear into tool calls on a simple question.
- **One step at a time, and it is the last part of the message** (Henrik, 2026-11-03: "anything needing my attention or action needs to be the last part of any message, guess if you are faster than me looking through the history of what a 100 open sessions", then "STOP giving all instructions then!!!!! I told you 100 of times we do one STEP AT A TIME!!!!!"). A message asks Henrik for ONE thing: the next single step, decision or question, with its full command or page link and what he should see when it worked, as the final part of the message. Never a numbered list of steps, never the steps after it: the next one comes in the reply after he says this one is done. While it is open, every message ends with that one step again, in full; never "your steps", "the steps above" or "pending your action" pointing back, since he runs about a hundred sessions and will not search one. Triggered when a reply ended on "the Google Drive backup is still off until your Google and Bitwarden steps are done" with no steps, and the replies after it listed all five.
- **Times are in Henrik's own time zone: EET, or CET while he is in CET, never UTC** (Henrik, 2026-11-03: "NEVER use UTC time references, only EET", then "unless I am in CET, update repo wide rules"). Every clock time Henrik reads (when a run ends, when a check fires, when something happened) is given in Helsinki time and labelled EET (EEST in summer); when he says he is in CET, in CET (CEST in summer) until he says otherwise. A time a tool reports in UTC is converted first. Never write a time as UTC, and never give both. Triggered by a session saying a perf run would be read "at 11:00 UTC".
- **Every request carries context** (Henrik, 2026-10-10: "add context to requests so I have a clue what you are talking about"). When you ask Henrik to do or check something, say what it is for, where it fits in the overall task (step N of what), and what he should see when it worked. Never a bare instruction that assumes he remembers the thread.
- **Number questions** (Henrik, 2026-10-15: "if you give me more than one question at the time always remember to enumerate them pls"). Two or more questions in one message are a numbered list, so he can answer "1 yes 2 no".
- **Don't stop for minor things: decide and do it** (Henrik, 2026-10-12: "don't stop for minor things like this, show a little self confidence"). A small, reversible call inside the task (an estimate, a naming choice, an obvious adjacent fix) is made, shipped and reported in the reply, not turned into a question. Ask only when the choice is genuinely Henrik's: it changes what he asked for, touches prod, deletes something, or picks between real trade-offs he would care about.
- **Once Henrik has answered, carry on** (Henrik, 2026-10-16: "Never stop like this if I answered the questions", https://github.com/ViritasOrg/Flyt/issues/582). Never end a turn on "shall I go ahead?" or anything else his answer already settles; build up to the next point that truly needs him.
- **Never slack off when you know what to do next** (Henrik, 2026-11-03: "ok, ready for a new run or have you been slacking off?", then "update the repos wide rules to never slack off when you know what to do next!"). When the next step is known and needs nothing from Henrik, do it in the same turn: a turn never ends on a plan ("next I'll profile …", "I'll start on X"), a promise or a summary while that work is undone. End a turn only when the work is finished, when it truly waits on Henrik (and then the message ends with that one step), or when it waits on something running elsewhere that will wake the session (CI, a scheduled check), named with when it lands. Triggered when a session reported a perf run, wrote "Next I'll profile the CPU at 130 req/s in the sandbox", and stopped.
- **A message sent while you work never means stop** (Henrik, 2026-10-26: "\"Send Now\" messages never means stop, just that I need a quick answer before you continue working", https://github.com/ViritasOrg/Flyt/issues/895). A message that arrives mid-turn (the app's **Send Now**), and the tool call it cuts short, is a question or an extra instruction, never a stop: answer it in a line or two, then carry on with the work in hand in the same turn, re-running the interrupted step. Stop only when Henrik says so in words ("stop", "wait", "hold", "don't").
- **Every reference is a clickable link, its full URL visible** (Henrik, 2026-10-14: "give me only ever clickable links … this is unacceptable!!!", https://github.com/ViritasOrg/Flyt/issues/425). Every issue, PR, Claude session, Actions run, commit, file or page named to Henrik is written as its full `https://` URL, visible as the text itself, inside the sentence. Never link text that hides the URL (`[session](…)`, `[#299](…)`), never a bare `#299`, `owner/repo#n` or file path, never a URL in bold, in code formatting or on a line of its own apart from its sentence. Claude session links above all: the Claude app shows a named link to a session but doesn't open it.

### Answer the question (Henrik, 2026-10-28)
> "answer the question, LLM comfort isnt as important as quality of responses" / "a wall o[f] words I wont read regardless, it waste[s] your time and my token budget"

- **The answer goes first, in the first line.** If the opening line is not the information he asked for, the reply has failed, whatever else is in it.
- **No answer is a complete answer: say so and stop.** "Not in what we hold — X would establish it" is finished. Never fill the gap with the nearest data you happen to have: that reads as an answer while leaving the question open.
- **Everything unasked-for is cut.** Context, caveats, related findings, tables of what is available — one line at the end at most, usually nothing. Never its own section.
- **He will not read a wall of text.** It burns his token budget and your time and tells him nothing. Short and answering beats long and circling, every time.

Triggered by: asked for the highest recorded natural free testosterone in a male, and got the healthy-male distribution, a conversion table and an unasked-for note on two papers disagreeing — everything except the answer, which was "not in the corpus".

### Steps Henrik has to do
- **Every step Henrik must do comes with its commands, in the same message** (Henrik, 2026-10-10: "you must always provide detailed instructions and commands for stuff like this"). Give the full instructions and the exact, complete, copy-paste commands right there, saying which machine each runs on. Never "I'll give you the command when…" or "deploy as usual". **Never point back in the chat** (Henrik, 2026-10-22, https://github.com/ViritasOrg/Flyt/issues/679: "never ask me to search backwards in a session chatt , just show me the needed bash to copy into terminal!!!"): a message that asks him to run something carries the complete command itself, never "the command above", "as before" or "scroll up".
- **Every step on a page links that exact page** (Henrik, 2026-10-28, https://github.com/ViritasOrg/flyt/issues/1015: "I want to make a org wide rule to always provide clickable links so I dont have to spend time on it when doing this!!!"). A step Henrik does in a browser (try a feature on staging, press a button in Admin, change a GitHub setting, open a board or console) carries the full `https://` URL of the page where he does it, inside that step's own sentence, the deepest page Claude can name (the new-link form, not the site's front page). Look the URL up (routes in the code, the app's host in its config) before writing it; never "on staging", "in Admin", "on the dashboard" or "the release PR" without its URL. The clickable-link rule above holds for the rest: full URL visible, never hidden behind link text. Triggered by a staging test that said "On staging, make a 20 EUR Direct card payment link and open it" with no link, and named the release PR as `[ViritasOrg/flyt#1013](…)`.
- **Every published URL is listed in the URL directory** (Henrik, 2026-10-29: "any published URL must always be updated in the URL directory in the Whitelist UI"). The Links tab of https://claude-agent-api-aged-sun-3616.fly.dev/whitelist/ui is the one directory of every page Henrik's repos publish, grouped by repo and prod/stage. Whoever publishes a page, app, site or host (a new route that serves a page, a new Fly app, a GitHub Pages site, a staging copy), or moves or retires one, updates that directory in the same piece of work: a row in `SITES` (or the app's `url` in `APPS`) in `data_registry.py` of https://github.com/ViritasOrg/claude-agent-backend, through a PR there whichever repo the page lives in; a retired URL loses its row. The work is not done until the URL shows on the Links tab; say so to Henrik with that tab's URL. In claude-agent-backend `tests/test_url_directory.py` fails for any page route missing from the directory.
- **Henrik's computer is a Mac: macOS with zsh, never bash** (Henrik, 2026-10-07). Commands he runs on his own computer must work as typed in zsh: `read -s "T?Prompt: "` (never `read -p`), BSD tools (`sed -i ''`, `base64 -D`, `date -v`, no `grep -P`, no `${!var}`, `open` not `xdg-open`). Fly machines, CI and the Pi are Linux/bash: say which machine each command runs on.
- **Henrik's Macs have EU keyboards: the Option key is labelled `alt`** (Henrik, 2026-10-11: "no option on eu keyboards only alt"). Write **alt (⌥)**, never "Option", and **cmd (⌘)**, not "Command".
- **Henrik uses Chrome, on his iPhone and his Macs, unless something forces him to use another browser** (Henrik, 2026-10-17: "update all repos that I only use Chrome unless forced to"). Every browser step is written for Chrome; on iPhone a page goes to the home screen through Chrome's **Share → Add to Home Screen**. Name Safari only when iOS genuinely requires it for that step, and say why.
- **Passwords: Henrik types them, Claude never routes them** (Henrik, 2026-10-15, https://github.com/ViritasOrg/Flyt/issues/530: "I will never put passwords on clipboard … you dont need to deal with passwords ever"). He types a password, or pastes it from his password manager, into the prompt that asks for it. Never a command that feeds a password from `pbpaste`, the clipboard, a shell variable, a heredoc or `sudo -S`; never ask him to paste a token, key or password into the chat, and never print one into a reply.
- **Henrik's home connection has no fixed IP: never ask for a home-IP whitelist** (Henrik, 2026-10-23, https://github.com/ViritasOrg/flyt/issues/761: "update md files in all repos to never ask something as stupid again"). Never tell him to allow-list his home IP for a partner key (Revolut X, Kraken, bunq, Stripe, anything later), never print his IP for one, never write such a step into a doc. A key is kept small by its permissions and, where offered, an expiry date; leave the partner's IP field empty.

### Do what Henrik asked the first time, and keep doing it (Henrik, 2026-11-01)
> "just move the clips to a folder in Downloads like I asked about three times by now!" / "an generic testfolder isnt helping at all"

- An instruction Henrik gives once holds for the rest of the session and every session after it: it is written into the repo's `CLAUDE.md` in the same session, so he never has to repeat it. Before replying, check the request against what he already said in this conversation; if he has asked for something before, do it now, fully, and do not answer with a plan for it.
- When he asks for something to be done to files on his own machine (move, sort, open), the reply is the complete command that does it now, in the first lines. A code change that makes the next run behave is extra, never the answer instead.
- Files Henrik is meant to look at or listen to (test clips, reports, exports) go to `~/Downloads`, in a folder named after what it is, one new folder per run or test, named with what was tested and when (e.g. `~/Downloads/Deadair tests/story 2026-11-01 12.40`). Never a hidden app folder, never one generic folder that collects every run, never overwriting the last run's files.
- If he has to say a thing twice, the first reply failed: fix it in that reply, and add the rule so the next session gets it right.

### Never touch production during perf, load, sizing or test work without asking (Henrik, 2026-11-01)
- Never send any request to production (`claude-agent-api-aged-sun-3616.fly.dev`, any repo's production app) or to any partner as part of perf, load, sizing or test work, including single read-only GETs, health checks and `/admin-data` reads, without Henrik's explicit permission in that conversation.
- Read-only is not harmless: a full-file read on the 256 MB machine stalled production twice on 2026-11-01.
- If production stops answering, stop all requests to it at once and report it to Henrik as an incident you caused.

### No legal advice unless Henrik asks for it (Henrik, 2026-10-21, https://github.com/ViritasOrg/Flyt/issues/646)
> "update all md files to never provide unsolicited legal advice, I need a real laywer not pointless discussions with Claude or any AI/LLM."
- Claude is the development team, not legal counsel. Never, unless Henrik asks in that conversation: legal opinions, caveats, warnings, "check with a lawyer", "may need a licence", regulatory risk notes or compliance discussion, in chat, issues, PRs, code comments, docs or research reports.
- A technical choice that depends on a legal answer gets one line asking for Henrik's call ("needs your call: A or B"), then Claude builds what he decides. Never argue it, never repeat it.
- Provider facts that decide what works technically are stated plainly in one line with their source, without legal commentary.
- Existing legal lists (e.g. Flyt's "Legal questions", https://github.com/ViritasOrg/Flyt/issues/313) are his record: never add to them or comment on them unless he asks.

### Nothing half-built is ever visible (Henrik, 2026-10-15, https://github.com/ViritasOrg/Flyt/issues/544)
> "update all claude.md in all repos to warn for this to ever happen again, this is very stupid!"
- Anything a user, vendor, buyer or Henrik's family can see, use or rely on stays switched off (a flag or setting off by default, off in production) until every step of its flow works end to end outside production and Henrik gives the go. Turning it on is its own change.
- Splitting work into issues never makes a part shippable on its own.
- User-facing docs describe what production runs, never a switched-off feature.

### "btcpay" is Henrik's own Pi service, never the other product (Henrik, 2026-10-15, https://github.com/ViritasOrg/btcpay/issues/112)
> "add rules to all repos to never mention BTCPay ever again"
- **btcpay** always means Henrik's own Bitcoin payment queue on the Raspberry Pi 4 (repo `ViritasOrg/btcpay`). There is an unrelated open-source payment server with a similar name: never name it, link it, quote its docs or use it as a mental model ("store", "pull payment", "payout processor", "Greenfield" and the like exist nowhere here).
- Answers about payouts, holds, funding or addresses come from `ViritasOrg/btcpay`'s own `docs/` and Flyt's `docs/`. Unsure which is meant? It is this one.

### Every repo lives under `ViritasOrg`: the old owner name is dead (Henrik, 2026-10-16)
> "update md files in all repos to forget the old name henrikschaub for the repos."
- Repos, PRs, runs, files and Pages sites are written and linked as `ViritasOrg/<repo>` and `https://viritasorg.github.io/<repo>/`, never `henrikschaub/<repo>` or `henrikschaub.github.io`. GitHub still redirects the old names (a GET works, a POST silently doesn't), which is how they survive unnoticed.
- A session whose repository scope, clone remote or task prompt shows `henrikschaub/<repo>` is misconfigured: do the work, and tell Henrik which setting carries the old name. (`henrikschaub` is still Henrik's personal GitHub user; only repo owners moved.)

### Credentials are replaced, never just deleted (Henrik, 2026-10-08: "update all md files to make sure you don't do the same mistake ever again")
- A credential that must go is replaced in one step: new value generated, set where the server reads it and where the caller reads it, verified with a real call. Never a delete with the replacement left for later.
- Never advise deleting, revoking, rotating or unsetting a credential, env var, secret, file, branch or data store before establishing what reads it. Grep for it first.
- An env var reference (`$CLAUDE_READONLY_API_KEY`) in a file is correct practice, not a leak; only a literal secret value committed to a file is, and then name the exact file and line.

### Keys live in Bitwarden and move with rekey.sh (Henrik, 2026-10-28, https://github.com/ViritasOrg/flyt/issues/993)
> "no tokens and keys are stored in Bitwarden, follow the correct process, if it is unknown to you make sure all Viritas Repos has updated claude.md instructions to use rekey.sh and Bitwarden"
- Every token, key and secret of Henrik's lives in Bitwarden, folder `rekey`: one item per key, named exactly as the key, the value in the password field.
- `rekey.sh` puts it where it is used: GitHub secrets, Fly secrets, flyt-ops and the agent API. Keys a command makes (a Fly deploy token) it writes into Bitwarden first. The script is `ViritasOrg/flyt` `infra/rekey/rekey.sh`, `~/ClaudeCode/rekey/rekey.sh` on the M1 Max; its phases and items are listed in `infra/rekey/README.md`.
- A key that only a settings page Henrik opens can take (the Claude environment's Network secrets, a provider's dashboard) he pastes from Bitwarden.
- Never give Henrik a command that prints a key, puts it on the clipboard or passes it in argv. Never ask for a key in chat.
- A key `rekey.sh` doesn't cover yet gets its item and phase in `rekey.sh` in a PR before Henrik is asked to do anything with it.
- A session that finds a key refused names the key and the `rekey.sh` phase that renews it, with its exact command.

### Merge your PR once it is green (Henrik, 2026-10-26, https://github.com/ViritasOrg/flyt/issues/930)
> "update all repos to not wait for 4h to merge PRs, all sessions can merge once their PRs are green, we have good test coverage and see few issues."
- A session merges its own PR as soon as every required check is green and it is mergeable, into the branch the repo's workflow targets (Flyt: `staging`, and release and hotfix PRs into `main`; btcpay and the staging apps: `main`). No merge ask, no waiting for Henrik, no 4-hour clock.
- Still never: push to a protected branch, change branch protection, merge red or conflicted, or merge a PR that lists a step Henrik must do or check before merging (ask for that step first).
- Henrik can still merge anything himself. A repo whose rules keep production behind his own step keeps it: `peptidetracker` and `workout` reach production only through his Push to Prod.

### Every repo has CI and tests (Henrik, 2026-10-28, https://github.com/ViritasOrg/flyt/issues/982)
> "I want CI setup and tests written and that all claude.md files for all repos future and present include this requirement."
- Every repo has a GitHub Actions workflow that runs its tests on every pull request and on every push to its main branch. A repo without one, or without tests, gets both in its own PR before the next change to its code merges.
- A new repo gets its CI workflow and first tests in its first PR, its line in `REPOS` in `ViritasOrg/claude-agent-backend` `scripts/check_org_rules.py`, and this block in its `CLAUDE.md`.
- New or changed behaviour comes with tests in the same PR. A bug fix comes with a regression test that fails on the code before the fix.
- Tests call the code and check what it returns. A test that greps the source is a structural guard (a trust split, a banned call, a registry), never coverage of behaviour; such guards stay, next to tests that call the code. Tests in CI never call a real partner or need a real secret: stub them.
- A PR merges only after the repo's CI ran green on its latest commit; no checks at all is not green. The one exception is a docs-only PR in a repo whose CI doesn't run on pull requests yet. Never skip, disable or loosen a test, a coverage floor or a CI step to get a change through.

### Every background job has a readable name (Henrik, 2026-10-28, https://github.com/ViritasOrg/flyt/issues/1004)
> "I want everything to have understandable names" … "fix all these names to correct ones, this is a mess, also update the central claude.md rule book to avoid this in the future"
- macOS System Settings → General → Login Items names a LaunchAgent or LaunchDaemon after the file its plist starts. A plist that starts `node`, `python`, `bash` or any other interpreter directly shows up as "node" or "python" from an "unidentified developer", and nobody can tell what it is.
- Every LaunchAgent or LaunchDaemon an installer writes starts a link or wrapper named after what it is, never a bare interpreter: Flyt's `~/.flyt-launchers/<name>` (`packages/shared/launch-name`), btcpay's console venv link, the podcast worker's `venv/bin/Podcast Voice`. The name says the product and the service, as Henrik would call it (`Flyt Ops Board (production)`, `btcpay CFO Console`), and is unique.
- A Python job's link sits in its venv's `bin/` next to `python`, so Python still finds the venv.
- A new background job gets its name in the same PR that adds it, with a test that its plist starts the named link.

### A verified error in an md file gets fixed immediately (Henrik, 2026-08-08: "When you find verified errors in md files always fix em instantly.")
- If you establish that something in a `CLAUDE.md` (or any md in these repos) is wrong, correct it in that session, in every repo that repeats it. Verified means you checked (read the workflow, ran the command, saw the run); a hunch is not a finding.
- Say what was wrong and why in the commit and the reply. This does not license rewriting rules you disagree with: those are Henrik's call. A SETTLED marker still wins: raise it, don't edit.
- An org-wide rule is changed in the canonical file first, then copied into every repo's block in the same session.
<!-- END ORG-WIDE RULES v12 -->

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

## ⛔ THE FREE-T MODEL RUNS ~1.5× ABOVE MEASURED DOSE-RESPONSE — THIS IS KNOWN AND OPEN ⛔
**Do NOT "fix" it. Read `docs/enhanced-bodybuilding/17-the-model-vs-measured-gap.md` in
`claude-agent-backend` before forming an opinion about the free-T curve.**

The model is `TT = TT_base × total/P` — serum testosterone proportional to appearance rate,
anchored on the user's own baseline. Compared trough-to-nadir against Bhasin 2001
(PMID 11701431), it sits about **1.5× high**. That is a **disagreement between two sourced
published quantities**, not a bug:
- the model side is clearance arithmetic that matches the literature MCR (1,240 L/day,
  PMID 6025489) against a 3–10 mg/day production rate to within a few percent;
- the measured side is Bhasin's five dose arms.

The leading hypothesis is IM depot bioavailability, which **does not exist in retrievable
form** (it needs an IV comparator these products never had). The gap is also
**dose-dependent** (1.62× at 25 mg/wk → 1.37× at 300), so **no fixed factor reproduces it**.

**What keeps being rediscovered as a good idea, and must not be shipped:**
- Replacing the personal slope with a slope least-squares-fitted to Bhasin. Tried and
  reverted 2026-09-09. That is *fitting, not sourcing*.
- Setting a bioavailability F to whatever closes the gap.
- Rewriting the failing first-principles test in `test_frontend.js` to match a new model.
  A red model test means **revert the change**, not update the test.

**If you think it is genuinely wrong: say so in your reply and let Henrik decide.**

⚠️ **Always compare TROUGH to NADIR.** Bhasin reports mean *nadir* concentrations. Comparing
a model's weekly *mean* against them overstates the disagreement by about a third — a mistake
that has now been made twice (2026-09-08, and again 2026-09-09).

**Known gap in the OPPOSITE direction:** `/systemic-interactions` carries SHBG effects for the
GH-axis peptides and boron only — **no androgen at all**. Masteron/drostanolone, nandrolone
and oxandrolone contribute nothing to modelled SHBG, so an AAS cycle's SHBG suppression on the
chart is coming from HGH alone. Flagged, not fixed: closing it needs a retrieved source.

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

## The Setup Wizard's animated tour and the "What's new" card (rule 2026-10-24)
Built for Workout first (Henrik: *"does it highlight new features as AI macro tracking or the
stick man info cards?"*, then *"I want a animated movie running as onboarding showing the main
features incl macro tracking"*, *"ask the onboarding questions first so a male user gets a
Hypertrophy in the gym movie and a female a female aesthetics at home movie"*, *"in settings/More
add a button on top to re run the intro for users who want to see it again"*), then *"yes"* to the
same here. Both go stale unless every feature PR maintains them.

- **A feature a user would not find on their own gets a row in `WHATS_NEW` in the same PR.** A new
  tab, a new button on an existing screen, a new way to enter data (food by photo), a new wizard
  step. Not a bug fix, not a reworded label, not a change inside a feature the user already uses.
- **Key the row to the version the PR ships AS**: the bump it will get after merge, which is
  `version.json` on `main` plus one. The runtime filter hides a row until the build reaches its
  version, so the row and the bump arrive together. A test fails on a row more than one bump ahead.
- **Newest first**, one title and one or two sentences in plain words, saying where the user taps.
- **The card shows what the account has not dismissed.** `pep-whatsnew-seen` is per account
  (localStorage + `/user-settings`); "Got it" marks the current `VERSION`. An account that is
  onboarded or has dose history and has no seen version gets every row; `obFinish` marks a NEW
  account as seen (the tour just showed it everything) and leaves an existing account's card alone.
  Never reset or clear the seen version to "make sure they see it".
- **The wizard's `tour` step is an animated movie, not a list.** `TOUR_SCENES` plays protocol →
  today → levels → macros → tabs, each a CSS-animated mock of the phone screen built by
  `_tourSceneHtml` (simulated taps, a dose ticked, the plasma curve drawing, bars filling) with one
  caption. No video file: markup in `index.html`, styles in `css/main.css`, so it plays offline.
  Tap the stage to pause; a dot jumps; the last scene stays and shows the six-tab list.
- **The movie follows the wizard's answers.** `_tourProfile()` reads `_obData.goals` (step 3) and
  `_obData.sex` (step 4): the protocol scene starts the plan `_obRankedTemplates()` ranks first for
  the ticked goal; with no goal ticked, female → fat loss, male → hormone health.
- **NO COMPOUND DATA IN THE TOUR.** Plan names come from the backend-served templates at runtime,
  with a neutral "Your suggested plan" when none has loaded; doses are "Dose 1 · 09:00". A test
  fails on a compound, peptide or dose unit written into the scenes. The Levels scene is in pmol/L.
- **"Watch the intro again" sits at the top of Settings.** `openTour()` opens the overlay on the
  tour step with the saved profile's sex and goals and `_obTourOnly` set: no Back, no dots, Done or
  Skip just close it. Nothing is saved and no starting point is routed.
- **`TOUR_TABS` names every button in the bottom bar**, in order; a test reads the bar from the HTML.
  Its descriptions name the features behind each tab: when a tab gains one, update its line.
- **Cross-app parity:** Workout has the same card and tour (`wkt-whatsnew-seen`, `TOUR_SCENES`,
  `TOUR_TABS`, `openTour`). A change to the mechanism is made in both apps in the same session.

## Macro targets are per day; Food Edit sets them for the past (rule 2026-10-24)
Henrik: *"I imported my old logs but the targets has changed since I been both in recomp and
cut as well as earlier included my training burn … the targets must be saved for each day so
real stats can be generated later."*

- `_flRecordGoal` records TODAY's targets (`PUT /food-log/goals`, one row per day) whenever the
  Macros page shows them, and `/food-log/stats` measures each day against the latest row
  recorded on or before it; days before the first row use the first row. That was already so.
- **Food Edit shows "Targets from this day"** (`_flGoalsCardHtml`, `_flGoalFor`): the goals in
  force on the chosen day and their origin (set on this day / inherited from a date / first on
  record), editable; **Save** writes a row on that date, which holds until the next recorded
  change; **Remove this change** deletes the row recorded on that date
  (`DELETE /food-log/goals/{date}`, behind `confirmGlobalDelete`). That is how an imported
  log's periods get their targets: one row at each change point, never one per day.
- Never recompute a past day against today's targets, and never backfill rows automatically:
  the user says when the targets changed.
- The food-log block is spelled identically in Workout and Peptide Tracker; change both.

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

**`CLAUDE_READONLY_API_KEY` is meant to be set in Claude's session environment and the backend is
reachable from it** — verified 2026-08-14. When a question is about DATA, read the data:

⚠️ **The variable was renamed on 2026-10-14** (it was `API_SECRET_RO`) and the key behind
it was replaced — see "ROTATING THE READ-ONLY KEY" below. Check it is actually set
(`[ -n "$CLAUDE_READONLY_API_KEY" ]`) before building a diagnosis on live data, and say so
plainly if it is missing rather than guessing.

```
curl -sS -H "x-api-secret: $CLAUDE_READONLY_API_KEY" \
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

## ⚠️ ANYTHING HENRIK MUST RUN COMES AS ONE COPY-PASTE BASH BLOCK ⚠️
Henrik, 2026-10-14: *"there should be a rule to always provide bash code I can copy, I am
not here to do linux admin when I have you"*

He is not the sysadmin. If a step cannot be done from the session, it is handed over as
**one fenced bash block he can paste whole** — not prose, not a numbered walkthrough, not
a command with `<placeholders>` to fill in, not steps scattered through a paragraph.

- **It generates its own values.** No "generate a key, then run X with it".
- **It checks its own prerequisites** and fails with the fix (`command -v fly >/dev/null ||
  { echo "brew install flyctl"; exit 1; }`), rather than erroring cryptically.
- **It verifies itself and prints what it proved** — the expected values next to the actual
  ones, and a final OK / NOT OK line. He should never have to judge whether it worked.
- **Secrets go through Bitwarden and `rekey.sh`** (org-wide rule "Keys live in Bitwarden and
  move with rekey.sh", https://github.com/ViritasOrg/flyt/issues/993): never generated into a
  block, piped to `pbcopy`, echoed or pasted into this conversation. A key goes into its
  Bitwarden item (folder `rekey`), and the matching `rekey.sh` phase puts it where it is used.
- **If one step really is a UI click** he alone can reach, the block does everything around
  it and ends by naming that single click, and the value he pastes there is the Bitwarden item
  it names.
- **Default to doing it in the session.** A block for Henrik is the fallback for what the
  sandbox genuinely cannot reach — never a way to hand work back. Check the pre-authorised
  paths (GitHub runners, the MCP endpoints, the session's own tokens) before deciding
  something is his to run, and say which one you tried.

## ⚠️ ROTATING THE READ-ONLY KEY — REPLACE IN ONE STEP, NEVER JUST DELETE ⚠️
Henrik, 2026-10-08: *"You told me to delete that api key in an other session, update all
md files to make sure you don't do the same mistake ever again"*
Henrik, 2026-10-14: *"one claude session required it to be deleted, we need to setup a
new key"* / *"with a less useless name"*

A session judged that the old key (`API_SECRET_RO`) had to go, and **deleting it was
right**. The mistake was deleting it **without provisioning a replacement in the same
step**: the sanctioned read path was dead for six days and nobody noticed until a session
needed it. On 2026-10-08 two workout bugs had to be diagnosed from source alone, and the
lost-log one could not be confirmed against Henrik's actual records at all.

**The rule: a credential that must go is REPLACED, not deleted.** One operation, not two,
with no gap in between:
1. generate a new value (`openssl rand -hex 32`) — never in a chat reply, a commit, a PR
   body, a CI log or a workflow input;
2. set it where the **server** reads it (`CLAUDE_READONLY_API_KEY` on the backend —
   `fly secrets set` on `claude-agent-api-aged-sun-3616`, or `claude_readonly_api_key` in
   `config.json`);
3. set it where the **caller** reads it (the same name in Claude's session environment:
   the cloud environment menu in the session title bar → Edit → Network secrets, labelled
   API credentials in an older app). A new session picks it up;
4. **verify with a real call** before calling it done — `GET /health`, then one
   `/admin-data/records` read — and confirm a write still returns 403.

**The other rules, which the 2026-10-08 incident is the standing example of:**
- **Never advise deleting, revoking, rotating or unsetting a credential, env var, secret,
  file, branch or data store before establishing what reads it.** Grep for it first. In
  this ecosystem the read-only key is used by every data-diagnosis path in every repo.
- **"A secret appears in a repo" is not a finding.** A reference to an environment
  variable (`$CLAUDE_READONLY_API_KEY`) is correct practice and appears in this file, in
  hook banners and in command lines by design. Only a literal secret *value* committed to
  a file is a leak — and then name the exact file and line, nothing more sweeping.
- **Never ask Henrik to paste a token, key or password into the chat**, and never print one
  into a reply. The transcript is stored.
- **The key existing in Claude's session environment is the design, not an exposure.** He
  was offered the full `x-api-secret` on 2026-08-07 and deliberately chose a read-only one:
  GET/HEAD/OPTIONS only, enforced in `main.py` middleware and again in
  `auth_helper.get_user_id`.
- **An absent key is a provisioning gap to REPORT, not a problem to engineer around.** Say
  it is unset, say what that blocks, do every part of the task that does not depend on it.
  Never substitute guesswork for the record, and never instrument the UI instead.
- **The retired name is not read any more, on purpose.** `auth_helper` reads only
  `CLAUDE_READONLY_API_KEY` / `claude_readonly_api_key`, so a stale `API_SECRET_RO` left in
  an environment or a config file grants nothing. `tests/test_readonly_credential.py`
  (`TestOldNameIsDead`) holds that line — a red test there means the retired key works
  again, not that the test is stale.
- **Security advice about Henrik's own tooling is advice, not an action.** State the
  concern in a sentence, state what acting on it costs him, and let him decide.

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

### ⛔ DO NOT RAISE IT EITHER — NOT AS A REMINDER, NOT AS A NEXT STEP ⛔
**Added 2026-09-10 after Henrik said: "I told u repeatedly not to bring up push
to prod. Somehow make sure you never ever mention this again except if I ask
directly."** Repeatedly. It had already been asked for more than once before this.

The rule above stops Claude from *triggering* promotion. This one stops Claude
from **talking about it**. They are different failures and the second is the one
that keeps happening: ending a reply with "the fix reaches prod via your Push to
Prod button", listing it as an outstanding item, or noting that prod still has
the bug just fixed on staging. Every one of those is a nudge toward an action
that is his alone, and he has to read past it every time.

**The rule: never mention promotion, Push to Prod, or that prod still lacks a
staging fix — unless Henrik asks about it directly in that turn.**

Specifically, do NOT:
- close a reply with how or when a fix reaches prod;
- list "still needs promoting" as outstanding, pending, or a next step;
- observe that prod is on an older version, or that prod still has the bug;
- offer to prepare, stage, draft or check anything promotion-related;
- mention it "just so you know" or "for completeness".

He knows how his own deploy works. Report what shipped **to staging**, and stop
there. If he wants prod, he will say so — and only then does the rule above about
never triggering it govern what Claude may actually do.

**What this means for Claude (hardened 2026-09-08 — this supersedes every
earlier wording):** promotion is **Henrik's action alone, always**. Claude must
never:

- click, fire, curl, or otherwise send the `repository_dispatch` / Push to Prod
  event, under any circumstance;
- push, commit, branch, or open a PR on `peptidetracker` directly;
- hand-merge the prod PR the workflow opens;
- start a promotion because CI is green, because the fix looks trivial, because
  a previous turn authorised one, or because it reasons that Henrik would
  obviously want it.

**There is no "explicit go-ahead" exception any more.** Earlier versions of this
file allowed promotion "with Henrik's explicit go-ahead in that specific
moment", and that clause is now REMOVED — it was the crack that any plausible
argument could widen. Henrik presses the button in the staging app's Settings
UI. Claude's last step is always to ping him that stage is ready for test.

Re-running a promotion run **Henrik already triggered himself** (e.g. after
fixing the token) is completing his action rather than starting one, and stays
allowed — but if there is any doubt whether he triggered it, treat it as a new
promotion and do not touch it.
*(Earlier versions of this note wrongly said the workflow only opens a PR that
must never be auto-merged. The workflow has always auto-merged; the note was
out of date.)*

**A Retry promotes staging as it is now, and the wait is 30 minutes (2026-11-04).** Henrik: *"been
impossible to promote to prod today"*. A run that timed out waiting for prod CI (10 minutes, both `test`
checks still queued) left its prod PR open, and the app's Retry re-ran it hours later; a re-run checks out
the commit it was first dispatched at, so it promoted an older staging build over a newer one already on
prod. `promote-to-prod.yml` now checks out staging `main` (`ref: main`, named by `STAGING_SHA`), waits up
to 30 minutes, retries a failed API read, and closes the older `promote/staging-*` PRs a new one
supersedes. `tests/test_promote_workflow.js` runs the steps against a fake `gh`.

**PEPTIDE_WORKOUT_PROD_TOKEN secret (renamed 2026-11-01, was `PROMOTE_TOKEN`):** the promotion
workflow checks out, pushes to, opens and merges the PR on the prod repo with this repository
secret: a classic GitHub token with the
scopes `repo` and `workflow` (fine-grained tokens have no Checks permission, and the workflow reads the
prod PR's check runs). The same
token is set in both staging repos (Settings → Secrets and variables → Actions); its value lives in
Bitwarden, item `PEPTIDE_WORKOUT_PROD_TOKEN`, folder `rekey`. Henrik, 2026-11-01: "POMOTE_TOKEN is too
generic a name, I want a better one especially since it is for prod repos". The old token answered
`Bad credentials` on every run from 2026-10-24 to 2026-11-01, so Push to Prod failed at its first step
and the app's Deploy status never moved; an earlier version of this note said it "runs green".
It moves from Bitwarden into both staging repos with `~/ClaudeCode/rekey/rekey.sh prod-push` on the M1 Max
(ViritasOrg/flyt `infra/rekey/`, flyt#1167), which first checks it can push to both prod repos. Claude has
no tool to create or edit repo secrets: when the run says `Bad credentials`, Henrik regenerates the token,
saves it in that Bitwarden item and runs that phase; never a copy-paste into GitHub's settings.

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
