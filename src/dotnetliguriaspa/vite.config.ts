import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { loadEnv, type Plugin } from 'vite';

// Speaker photos shipped with the website (/Contents/speakers and /Contents/profile), listed at build time so the
// avatars request only files that exist: a guessed name that is missing would cost a 404 in the browser console.
function contentPhotos(): Plugin {
  const id = 'virtual:content-photos';
  const resolved = `\0${id}`;
  const root = fileURLToPath(new URL('../dotnetliguriawebsite/DotNetLiguriaCore/Contents/', import.meta.url));
  const list = (folder: string) => {
    try { return readdirSync(root + folder).filter(file => /\.(jpe?g|png|webp)$/i.test(file)).map(file => `${folder}/${file}`); } catch { return []; }
  };
  return {
    name: 'content-photos',
    resolveId: source => (source === id ? resolved : undefined),
    load: source => (source === resolved ? `export default ${JSON.stringify([...list('speakers'), ...list('profile')].sort())};` : undefined),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'REACT_APP_']);
  return {
  plugins: [react(), tailwindcss(), contentPhotos()],
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || env.REACT_APP_API_BASE_URL || ''),
    'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || env.REACT_APP_API_URL || ''),
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : mode === 'https' ? 3443 : 3000,
    strictPort: true,
    https: mode === 'https' ? {
      cert: readFileSync(fileURLToPath(new URL('./localhost.pem', import.meta.url))),
      key: readFileSync(fileURLToPath(new URL('./localhost-key.pem', import.meta.url))),
    } : undefined,
  },
  test: {
    pool: 'vmThreads',
    // Two workers keep the timed gate (scripts/timing-budgets.json) well under its ceiling on the
    // 4-vCPU CI runners now that the admin pages are covered; each file still gets its own context.
    maxWorkers: 2,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['src/toMerge/**'],
    passWithNoTests: false,
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
  };
});