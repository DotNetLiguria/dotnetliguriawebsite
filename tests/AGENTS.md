# Tests

Read the repository root AGENTS.md first. One handwritten C# type per file and
_camelCase private fields apply to fixtures and tests too.
**xUnit.net v3 is mandatory:** test projects must reference `xunit.v3`. The
deprecated `xunit` package is prohibited; do not use it when creating or updating
tests.
Unit tests must not use browsers, databases, Keycloak, external network or sleeps.
Use fixed data, fake clocks and collaborators; restore any modified process state.
Keep repository-rule checks syntax-based, including implicit private fields and constants.
Only genuinely generated code is exempt. Exercise rejection and acceptance fixtures.

Run `pwsh -File scripts/verify.ps1` for the shared gate. Restore/build are outside
timed unit execution. Timing budgets are based on recorded green runs and must not
be increased without explaining the regression. Do not silently skip failing tests.