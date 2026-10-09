# React Frontend

Read the repository root AGENTS.md first. Preserve the existing UI, public/admin
routes, API payloads, OIDC callback/silent-callback routes and service-worker URLs.
Use pinned Node and npm ci. Resolve peer dependencies without force flags.
Client VITE variables are public; never put secrets in them.
Keep API and content URLs distinct and preserve their case for Linux hosting.

From this folder run `npm run typecheck`, `npm run lint`, `npm run test:unit`
and `npm run build`. Tests must stub all network/auth collaborators and reset state.
Use fake timers for delayed actions. Add focused behavior tests, not mount-only tests.
Run `npm run sync:oidc` after changing OIDC dependencies.