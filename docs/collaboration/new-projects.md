Status: current as of 2026-10-22 (collaboration 1.6)

> Web projects: `scripts/new-web-project.sh` does steps 1-2 plus Neon and Vercel. See [../new-project.md](../new-project.md).

# New projects

Open this when creating a repo.

1. `gh repo create qiqstart/<name> --private --template qiqstart/project-template`. This brings AGENTS.md (version line + pointer), CONTRIBUTING.md, `.github/pull_request_template.md`, docs/.
2. Create labels: `REPO=qiqstart/<name> scripts/create-labels.sh`, or manually:
   ```
   gh label create bug --color d73a4a --description "Something is broken" --force && gh label create feature --color a2eeef --description "New feature or improvement" --force && gh label create in-progress --color fbca04 --description "Claimed by an agent" --force
   ```
3. File the initial plan as issues.
4. To put an existing repo on the protocol, run `scripts/push-protocol-update.sh --repo qiqstart/<name>` (dry run), then add `--apply`; JTS/MPU merges the PR. Never open protocol PRs by hand. New web apps made with `scripts/new-web-project.sh` start on the protocol (template).
5. Never put anything private in the public qiqstart/.github repo.
