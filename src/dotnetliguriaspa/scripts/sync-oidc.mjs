import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const packageDirectory = dirname(require.resolve('@axa-fr/oidc-client-service-worker/package.json'));
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));
mkdirSync(publicDirectory, { recursive: true });
copyFileSync(join(packageDirectory, 'dist/OidcServiceWorker.js'), join(publicDirectory, 'OidcServiceWorker.js'));