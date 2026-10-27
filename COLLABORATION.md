Collaboration prompt version: 1.13 (2026-10-26)

Changelog (newest first; if you're one version behind, read only the new lines):
- 1.13: each repo keeps docs/progress-log.md (newest first); see "Progress log" below. scripts/push-protocol-update.sh creates a starter log if missing, never overwrites. ready-to-merge label: agents add it when a PR is finished and remove it on new changes or blockers; a signal, not permission to merge. PPU creates the label if missing.
- 1.12: existing repos join the protocol only via scripts/push-protocol-update.sh --repo (dry run, then --apply), never by hand; script also detects unlabeled protocol PRs. New web apps via scripts/new-web-project.sh start on the protocol.
- 1.11: protocol-update PRs are pushed to all repos by scripts/push-protocol-update.sh (run from project-template), not by bots.
- 1.10: AGENTS.md carries a short core-rules summary so it works as a one-line entry point; new rules: prefer scripts/ over manual steps; repos not on the protocol copy files from project-template main via a protocol-update PR.
- 1.9: don't message JTS about routine protocol-update PRs (opening, merging, version bumps); only failures, conflicts or needed action.
- 1.8: protocol-update label; JTS merges via scripts/merge-protocol-updates.sh; Depends-on line; blocked-by label; full chain when reporting a waiting PR; scripts/pr-dependencies.sh; cleanup workflow; backfill script; blurb per new script/workflow; docs/changelog.md for script/workflow changes.
- 1.7: platform standards table; iOS standards (version in Settings, bump every deploy, public changelog, vague security fixes, deep link); web stub.
- 1.6: shorter core; details moved to docs/collaboration/; glossary; changelog; AGENTS.md is a pointer. No rule changes.
- 1.5: merge order in arrows, deploy-safe server code, unblock on completion, "Merges with" and install lines, known CI noise, real issue links, throwaway DB branches.
- 1.4: PRs needing a migr or manual step carry a DNM warning.
- 1.3: check the one-line COLLABORATION_VERSION file first, at most once a day.
- 1.2: when to check for new versions; PRs record the protocol version.
- 1.1: web apps: home screen icon and title.

Apply: if your repo's AGENTS.md says "Collaboration prompt version: 1.13" or higher, skip. Else apply this and set that line at the top of AGENTS.md in a PR.
Updates: at session start, if a day or more since your last check, read only COLLABORATION_VERSION in private repo qiqstart/project-template:
  gh api repos/qiqstart/project-template/contents/COLLABORATION_VERSION -H "Accept: application/vnd.github.raw"
If newer than your AGENTS.md, read this file and apply the changelog lines above yours. Every change bumps the version. Can't check (no access/offline)? Keep your version and say so in the PR.

Glossary: PR = pull request. repo = repository. env = environment variables. prod = production. migr = DB migration. DNM = do not merge. WIP = work in progress. AC = acceptance criteria.

Progress log
Each repo keeps a running log at `docs/progress-log.md`, newest entry at the top.
- Add an entry whenever you finish a meaningful step: a PR opened or merged, a decision made, a blocker hit or cleared, or a deploy.
- Put each new entry directly under the title, above all older entries. Never edit or reorder past entries; add a correcting entry instead.
- Entry format:
  `### YYYY-MM-DD HH:MM (Asia/Jerusalem) · <agent name>`
  then one to three lines covering what changed, links to the issue or PR, and what's next or who it's waiting on.
- Keep entries short and factual. Longer designs belong in `docs/<topic>-YYYY-MM-DD.md` and project-wide decisions in `DECISIONS.md`; link to them from the log.
- Read the top few entries before starting work, so you pick up where the last agent left off.

Basics
- GitHub is the source of truth, not chat. Any agent must be able to pick up work from the repo alone. Read README and AGENTS.md first.

Issues
- Every bug, feature, feedback item and follow-up is a GitHub issue in the project repo. No task lists only in chat or memory.
- Format: Title, Goal, Details (quote source, e.g. feedback id + date), AC, Out of scope.
- Labels: bug, feature, in-progress (create if missing), plus project labels as useful.
- Protocol-update-only PRs: label protocol-update (create if missing), nothing else in them; JTS merges with scripts/merge-protocol-updates.sh. New versions are pushed to every repo on the protocol by scripts/push-protocol-update.sh (dry run first, then --apply); bots don't open these PRs by hand. To put an existing repo on the protocol, run `scripts/push-protocol-update.sh --repo qiqstart/<name>` (dry run), then add `--apply`; JTS/MPU merges the PR. Never open protocol PRs by hand. New web apps made with `scripts/new-web-project.sh` start on the protocol (template).
- Don't message JTS (chat, bots, DMs) about routine protocol-update PRs: opening, merging or version bumps. Tell him only if one fails, conflicts or needs his action.
- In-app feedback becomes issues; note the feedback id.
- Close duplicates with a link. Unclear? Ask JTS in the issue.
- Use real issue/PR links (qiqstart/<repo>#12 or URL). No made-up numbers; file the issue first.

Docs (designs, proposals, research, decisions, meeting notes)
- In the repo under docs/<topic>-YYYY-MM-DD.md, not only in chat.
- Line 1: "Status: current as of YYYY-MM-DD" (or "Status: proposal" / "Status: accepted").
- Never rewrite old docs. New dated file; old line 1 becomes "Status: superseded by docs/<new-file>.md (YYYY-MM-DD)".
- End with "## Decisions" (JTS's choices, dated). Link from the issue/PR. Docs go in via PR unless JTS explicitly asks for a direct push.

Claiming
- Comment "Claimed by <name>", add in-progress. One agent per issue.
- Check open PRs touching the same files; coordinate in issue comments.
- Blocked or stopping: comment why, remove in-progress.

PRs
- Never push to main. Never merge. JTS merges.
- PR finished (work complete, checks passing, no open questions)? Add the `ready-to-merge` label (create if missing) and log it in docs/progress-log.md. Remove it if you push more changes that need review or a blocker appears. Only JTS merges; the label is a signal, not permission.
- Branch off latest main: agent/<issue-number>-<short-name>. Match existing patterns.
- Small (under ~300 lines). No drive-by refactors or dependency upgrades.
- Off limits unless the issue says so: auth, CI workflows, prod env/secrets, migr. Schema changes: new numbered migr, JTS's explicit okay, and a backup before running in prod.
- Never commit secrets or .env files, or paste them into chat.
- Rebase on main; run lint, typecheck, tests; add tests.
- Deploy-safe server code: if shipped before its migr it must not fail (empty fallback or clear 409, never 5xx).
- Review: new commits, no force-push. Then send JTS the PR link and a 2-3 line summary (not for routine protocol-update PRs; see Issues).
- New script or workflow? Add a ~30-second plain blurb (what it does, when to use it, prerequisites like secrets or billing) to the repo's guide or README. No API docs needed.
- Changed a script or workflow? Add one dated line (YYYY-MM-DD: what changed) to docs/changelog.md, newest first.
- Title and body format: open docs/collaboration/pr-format.md when writing any PR.

DNM (migr or manual step)
- Needs a migr, prod env/secret, backfill, deploy-order step or other manual action? Draft PR; first body line "⚠️ DO NOT MERGE until: <steps>"; label needs-manual-step; ordered steps (who, before/after merge) under "Risks and follow-ups".
- Merging main auto-deploys to prod (Vercel). Code needing a migr must not merge before it runs.
- Steps done: you remove the DNM line and label, mark ready, comment what was done and when, tell JTS it's ready.
- Throwaway DB branches (e.g. Neon): list in PR; delete after merge with JTS's okay.
- Details and example: docs/collaboration/dnm-and-merge-order.md.

Merge order
- Dependent PRs/steps: write order in arrows, incl. non-merge steps, in PR body and chat.
- Every PR has "Merges with" (open PRs sharing files, incl. version bumps, and which goes first, or "none"), an "Installed" line (build to device, or "not installed"), and notes known CI noise.
- Every PR body has `Depends-on: #N, owner/repo#N` (all deps) or `Depends-on: none`; missing = incomplete. It is the machine-readable source; Order arrows stay for humans and non-merge steps.
- Depends on an open PR? Label blocked-by; you remove it when deps merge.
- Telling JTS a PR waits? Give the full chain: "tikkun-ios #8 is waiting: merge order is meal-tracker #17 → processing-ios #12 → tikkun-ios #8". Check with scripts/pr-dependencies.sh. After merges to main, scripts/pr-dependency-cleanup.sh (workflow) drops merged deps and syncs blocked-by.

Platform standards
- Read only the docs for your current task's platform (a web bot doesn't load iOS rules). This table lives only here.

| Platform | Doc | Covers |
|---|---|---|
| iOS | docs/collaboration/ios-standards.md | version in Settings, version bump every deploy, public in-app changelog, security-fix disclosure, Settings → changelog deep link |
| Web | docs/collaboration/web-standards.md (stub) | home screen icon and title (docs/collaboration/web-app-home-screen.md); rest TBD |

New projects: open docs/collaboration/new-projects.md when creating a repo.
