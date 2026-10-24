Status: current as of 2026-10-22 (collaboration 1.6)

# DNM warning and merge order: examples

Open this when a PR needs a migr or manual step, or depends on other PRs.

- DNM first line example: "⚠️ DO NOT MERGE until: migration 0013 runs on production (after a Neon backup and JTS's okay)".
- Why: merging main auto-deploys to prod on Vercel. Processing #88 merged before migration 0013 ran, and prod sign-in broke.
- Arrow order example: `backup → migrate 0014 → #92 → #29 → install`.
- Known CI noise example: "build check fails: Actions blocked by billing", so a red check isn't mistaken for broken code.
- Deploy-safe example: if a column doesn't exist yet, return empty values or a clear 409, never a 5xx.
