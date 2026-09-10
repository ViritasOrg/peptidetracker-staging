#!/bin/bash
# SessionStart hook — peptidetracker-staging
#
# WHY THIS EXISTS (2026-09-10). Every rule below was already in CLAUDE.md, verbatim and
# pre-authorised, when Claude broke them: it pushed four commits to a branch and reported
# them as delivered three times in one session, and separately built a change CLAUDE.md
# and backend doc 17 both rule out, getting it green by rewriting a first-principles test.
# Nothing was missing from the docs. They were not read before acting.
#
# A hook cannot force reading, but it can put the three rules that keep being missed into
# context before the first tool call, which is where they are needed.
set -euo pipefail

# Frontend only: no package manager, no dependencies. CI runs node --check plus
# tests/test_frontend.js on plain Node 20, so there is nothing to install.

cat <<'BANNER'
════════ peptidetracker-staging — READ BEFORE ACTING ════════

1. DELIVERY. "Done" means MERGED to main. Commit, push, open a PR against main,
   wait for CI, MERGE it. Pre-authorised and standing — do not stop to ask.
   A branch push is NOT delivery. Quote the main SHA, never the branch SHA.
   Never push to prod. Ever.

2. SETTLED VALUES. Before changing any PK/dosing constant, check for a SETTLED
   block and the matching doc. A red test named *_is_settled_* or
   *_do_not_relitigate means REVERT your change — never rewrite the test to
   match what you just did. If you think a settled value is wrong, say so and
   let Henrik decide.
   ⚠️ The free-T model's ~1.5x gap vs Bhasin 2001 is KNOWN and OPEN. Read
   claude-agent-backend/docs/enhanced-bodybuilding/17-the-model-vs-measured-gap.md
   before forming an opinion about the curve. Always compare TROUGH to NADIR.

3. SCOPE. Fix exactly what was asked. "My fix made it redundant" is not
   permission to remove anything. One PR = one requested change.

DATA: everything (compound params, ranges, all user data) lives in
claude-agent-backend and is served by API. Attach that repo and read it rather
than guessing from index.html.

TESTS: node tests/test_frontend.js index.html   (must be green before any PR)
═════════════════════════════════════════════════════════════
BANNER
