# Rule history

The rules are in `CLAUDE.md`; this is where a new rule's quote and story go. Everything before 2026-11-05 is in `docs/claude-md-archive-2026-11-05.md`; the org-wide rules' stories are in claude-agent-backend `docs/org-rules-history.md`.

## 2026-11-11 — Tests that ship to prod read only what prod has
Henrik, after a Push to Prod failed: "promotion to prod fails" … "add claude.md rule for all repos to make sure you dont repeat this again (it has happened multiple times). Also write tests to make sure this cannot be repeated!"
Workout prod PR #334 (https://github.com/ViritasOrg/workout/pull/334) failed because the promoted `tests/test_frontend.js` read `.github/workflows/promote-to-prod.yml`, which prod does not have (ENOENT). Earlier instances of the same class in Peptide Tracker: `inj-writer.js` (2026-08-20), `inject-sites.jpg` (2026-10-03), retired images (2026-10-22). The guard: `tests/test_promote_workflow.js` in both staging apps runs the real "Sync files into prod branch" step against a fake prod repo holding only prod's own files and checks statically that every file the promoted tests read is in the resulting tree (seconds, no GitHub; a first version re-ran the whole suite, which Henrik rejected: "we cant have a added 5-8min step").

## Never raise fertility, LH/FSH, recovery or PCT with Henrik (2026-11-20)
> "update your memory, since I have 4 kids, have had a vasectomy 10 yrs ago, will never do PCT stop bringing shit up that I dont care about"

Said after a bloodwork answer (which tests a Synlab package lacks for his next draw) spent a line on prolactin and LH/FSH being "not needed now", citing the baseline and post-PCT rows of the monitoring tables in `docs/enhanced-bodybuilding/`. Those rows are for users who plan to come off or care about fertility; neither applies to him. The rule: answers for Henrik leave these topics out entirely; the docs and the app keep them for other users.

## Henrik sets the bloodwork budget (2026-11-20)
> "stop suggesting things like this, I will not be able to pay more than the 160 + 45 for E2"

Said after three answers in a row listed eight to ten extra Synlab tests (400 to 530 € of add-ons) on top of the package he was choosing. His panel is the 160 € Hälsokontroll testpaket man plus estradiol. The rule: say what the panel he chose covers; extra tests only when he asks.
