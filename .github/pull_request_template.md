<!-- When the manual step is done: remove that line and the label yourself, mark ready, and tell the owner. -->
<!-- If this PR needs a migration or manual step: make the first line "⚠️ DO NOT MERGE until: <steps>", open as draft, and add the needs-manual-step label. -->
## What
<1-3 bullets of what changed>

## Why
Closes #<issue>. <one line of context>
Collaboration version: <e.g. 1.8>

## How tested
- <commands run and results>
- <devices/browsers checked>
- Known CI noise: <e.g. "build check fails: Actions blocked by billing", or "none">

## Merge order
Depends-on: <#N, owner/repo#N (all open deps) or "none"; any open dep → blocked-by label>
Merges with: <open PRs sharing files, incl. version bumps, and which merges first, or "none">
Order: <e.g. backup → migrate 0014 → #92 → #29 → install, or "just this PR">
Installed: <build → devices, or "not installed">

## Screenshots
<before/after for any UI change, or "n/a">

## Risks and follow-ups
- <migrations, env vars, breaking changes, or "none">
- <follow-up issues opened>
- Throwaway DB branches: <names, deleted after merge with okay, or "none">

## Checklist
- [ ] Small and focused, branch agent/<issue>-<name>
- [ ] Lint, typecheck and tests pass
- [ ] No secrets, no migrations/auth/CI changes unless the issue asked
- [ ] Docs updated (docs/ dated file if a design changed)
- [ ] Deploy-safe: no 5xx if deployed before its migration
- [ ] Real issue/PR links, no shorthand numbers
- [ ] Read the platform doc(s) for this task (COLLABORATION.md table)
- [ ] Collaboration version noted, and checked for a newer one before starting
