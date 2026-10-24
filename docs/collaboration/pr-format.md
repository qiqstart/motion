Status: current as of 2026-10-22 (collaboration 1.6)

# PR format

Open this when writing any PR. Title: `<type>: <short summary> (#<issue>)`, type is feat, fix, docs, refactor, test or chore.

Body (same as `.github/pull_request_template.md`):

```
## What
<1-3 bullets of what changed>

## Why
Closes #<issue>. <one line of context>
Collaboration version: <e.g. 1.9>

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
<before/after for UI changes, or "n/a">

## Risks and follow-ups
- <migrations, env vars, breaking changes, or "none">
- <follow-up issues opened>
- Throwaway DB branches: <names, deleted after merge with okay, or "none">

## Checklist
- [ ] Small and focused, branch agent/<issue>-<name>
- [ ] Lint, typecheck and tests pass
- [ ] No secrets, and no migration/auth/CI changes unless the issue asked
- [ ] If a migration or manual step is needed: draft PR, "⚠️ DO NOT MERGE until" first line, needs-manual-step label
- [ ] Deploy-safe: no 5xx if deployed before its migration
- [ ] Real issue/PR links, no shorthand numbers
- [ ] Collaboration version noted, and checked for a newer one before starting
- [ ] Docs updated (a new dated file in docs/ if a design changed)
```
