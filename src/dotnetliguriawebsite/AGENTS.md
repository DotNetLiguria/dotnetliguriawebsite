# Website Backend

Read the repository root AGENTS.md first. Keep routes, OIDC/cookie/bearer schemes,
Keycloak acr/MFA policies, JSON/BSON names, MongoDB collections and EF mappings stable.
The website serves the SPA from wwwroot and workshop assets from Contents.
Never delete historical content when copying a frontend build.
DataMigration writes real data: build it and test pure mappings, but do not run it
or apply database migrations without explicit approval.

Build all projects: `dotnet build DotNetLiguria.slnx -c Release` from the repository root.
Tests: `dotnet test tests/DotNetLiguriaCore.Tests -c Release` from the repository root.
Use injected collaborators for tests; do not require MongoDB or Keycloak.