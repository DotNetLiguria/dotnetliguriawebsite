---
name: fast-verification
description: "Use when validating changes, running fast unit tests, checking C# field naming or one-type-per-file rules, or preparing a pull request in this repository."
---

# Fast Verification

1. Read root and scoped AGENTS.md and inspect the diff without reverting other work.
2. Run the smallest relevant test first. Unit tests must not need network, databases,
   browsers or sleeps. Fake time and collaborators.
3. Run `pwsh -File scripts/verify.ps1` from the repository root for the shared gate.
   Restore and builds are not part of unit execution budgets. Recorded counts and
   deadlines live in scripts/timing-budgets.json; skips and reduced discovery fail.
4. For frontend changes, also run npm ci, typecheck, lint and build in
   src/dotnetliguriaspa. Browser/native smoke checks are separate.
5. Report commands, test counts, timings, failures and unverified platform/browser
   requirements. Never call instructions alone enforcement. Do not deploy or migrate data.
6. Run repository standards and backend/questionnaire/migration units from
   tests/RepositoryRules.Tests and tests/DotNetLiguriaCore.Tests. QR generation is
   browser-side; no native imaging or legacy browser-test projects remain.
7. Run `pwsh -File scripts/verify-publish.ps1` after the shared gate for deployment
   changes. It checks website and DataMigration publish artifacts and static assets
   without running hosts.