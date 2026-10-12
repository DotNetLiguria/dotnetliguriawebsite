# React Frontend

Read the repository root AGENTS.md first. Preserve public/admin routes, API payloads,
OIDC callback/silent-callback routes and service-worker URLs.
Use pinned Node and npm ci. Resolve peer dependencies without force flags.
Client VITE variables are public; never put secrets in them.
Keep API and content URLs distinct and preserve their case for Linux hosting.

## UI
Read the root PRODUCT.md for audience, brand and tone before changing public pages.
Public pages live in `src/site` (plus the public questionnaire components) and use
Tailwind CSS 4 with React Aria Components; design tokens are in `src/site/site.css`
and the logos in `src/assets/logo` (for now the historic dotnetliguria.net logo; the
vector set is ready for the new identity). The admin (`src/admin`: shell, kit in
`ui.tsx`, pages) and the questionnaire designer/results use the same tokens through
utilities; public-only rules stay under the `.site` scope. Do not add MUI, Emotion or
styled-components.
Public copy is Italian. Meet WCAG 2.2 AA mobile first: full keyboard and screen-reader
use, visible focus, 44px touch targets and `prefers-reduced-motion`.
Mark sections without backend data "Da completare" instead of inventing content.
Sanitise HTML from the API with DOMPurify before rendering it.

## Verification
From this folder run `npm run typecheck`, `npm run lint`, `npm run test:unit`
and `npm run build`. Tests must stub all network/auth collaborators and reset state.
Use fake timers for delayed actions. Add focused behavior tests, not mount-only tests.
Run `npm run sync:oidc` after changing OIDC dependencies.
