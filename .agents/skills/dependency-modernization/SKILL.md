---
name: dependency-modernization
description: "Use when updating .NET, React, npm or NuGet dependencies, migrating Vite hosting, or checking Linux and Windows compatibility in this repository."
---

# Dependency Modernization

1. Read root and scoped AGENTS.md. Record current versions and existing failures.
2. Resolve stable versions from official npm/NuGet/.NET release metadata. Reject
   previews and force/legacy-peer-deps. Pin supported .NET 10 and Node toolchains.
   For test projects, use `xunit.v3` only; never add or retain the deprecated
   `xunit` package.
3. Upgrade coupled families together: React/types, MUI/Emotion/Data Grid,
   EF providers/tools, MongoDB Driver/Bson, and auth/service-worker packages.
4. Preserve public contracts, routes, auth policies, EF mappings and historical assets.
   Document packages retained for compatibility and replacements of abandoned libraries.
5. Validate all affected solution builds and fast tests, clean npm ci and production
   assets. Validate Linux and Windows hosting; keep browser/DB checks separate.
6. Report unresolved compatibility gaps. Never run DataMigration, deploy, commit,
   rotate credentials or modify machine-wide tooling without approval.