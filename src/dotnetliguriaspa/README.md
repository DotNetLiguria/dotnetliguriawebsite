# React Frontend

This is the existing .NET Liguria public/admin UI, now using React 19, TypeScript,
Vite and Vitest instead of Create React App. Read [AGENTS.md](AGENTS.md) before editing.

## Local Development

Use Node 24.21.0 from the root [.node-version](../../.node-version), then run here:

```powershell
npm ci
npm start
```

HTTP development defaults to http://localhost:3000. `npm run start:https` uses
https://localhost:3443 and requires locally supplied `localhost.pem` and
`localhost-key.pem`. Do not commit or print certificate/private-key contents.
Provider registration and trusted origins must match the chosen frontend URL.

Set public API endpoints in local Vite environment configuration. `VITE_API_BASE_URL`
defaults to `https://localhost:64561/api`; explicitly match the backend URL you run.
`VITE_API_URL` optionally overrides the shared Axios base URL. The old
`REACT_APP_API_BASE_URL` and `REACT_APP_API_URL` names remain supported as fallbacks.
These values are embedded in browser code: never use them for secrets. `/Contents`
case is significant on Linux. The dev server does not start a backend or database.

## Checks And Publishing

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run build
```

Vitest runs 28 isolated behavior tests with mocked authentication/network and
reset state; `npm test` is a single run, not CRA watch mode.
Use `npm run test:unit -- --watch` for watch mode. The shared root verification script enforces discovery
counts and a measured process-time ceiling. See [test procedures](../../tests/Tests.md).

Build output goes to `dist`, not `build` or source `wwwroot`. Website `dotnet publish`
stages dist into the published `wwwroot`, preserving historical content. Build
the frontend before publishing, or use the root Dockerfile build workflow described
in [architecture](../../docs/architecture.md). There is no eject command.

`npm ci` runs `sync:oidc` to copy the installed AXA worker into public. Preserve
`OidcTrustedDomains.js`, callback/silent-callback routes and token-storage behavior.
Use `npm run sync:oidc` after an OIDC dependency change. Never use forced/legacy peer
resolution; keep stable compatible versions and the package lock together.

Existing unused-code lint warnings and Vite's large-bundle warning remain. Live
login/MFA, backend integration and browser layout are separate smoke checks, not
proven by the isolated unit suite.

 