# iOS standards
Collaboration version: 1.7. Linked from the Platform standards table in COLLABORATION.md.

Version
- Every Settings screen shows the app version and build (e.g. "Version 1.4.2 (57)"), read from the bundle, never hardcoded.
- Every deploy (TestFlight or App Store) bumps the version; build number always increases. Note the new version in the PR's "Installed" line.

Changelog
- Public in-app update log listing every release, newest first: version, date, short user-facing notes. Update it in the same PR as the bump.
- Security fixes: never describe them. Write only "Security fixes and improvements" so users know to update without giving attackers a map (Chrome's pattern). Details stay in private issues.
- Use that line only when a security-tagged issue drove the update (DECISIONS.md, 2026-10-22).

Deep link
- The Settings version entry is tappable and opens the changelog at the matching version's entry. The app documents itself.
