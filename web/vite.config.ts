import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { hubDataApi } from './hub-data-api';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

// The hub whose content/ and assets/img/ this front-end reads. In a built hub the
// dist files sit next to content/, so the same relative URLs work without this.
const HUB_DIR = resolve(process.env.HUB_DIR || '..');
const PORT = Number(process.env.PORT || 8906);

const TYPES: Record<string, string> = {
  '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.pdf': 'application/pdf', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8',
};

function hubContent(): Plugin {
  const serve = (req: any, res: any, next: () => void) => {
    const path = decodeURIComponent((req.url || '').split('?')[0]);
    if (!path.startsWith('/content/') && !path.startsWith('/assets/img/')) return next();
    const file = normalize(join(HUB_DIR, path));
    if (!file.startsWith(HUB_DIR + '/') || file.includes('/test-data/')) { res.statusCode = 403; return res.end(); }
    try {
      if (!statSync(file).isFile()) return next();
    } catch { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    createReadStream(file).pipe(res);
  };
  return {
    name: 'hub-content',
    configureServer: (s) => { s.middlewares.use(serve); },
    configurePreviewServer: (s) => { s.middlewares.use(serve); },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), hubContent(), hubDataApi(HUB_DIR)],
  server: { host: '127.0.0.1', port: PORT, strictPort: true },
  preview: { host: '127.0.0.1', port: PORT, strictPort: true },
  // assets/app/ keeps the bundle apart from a hub's assets/img/; place.mjs puts index.html and assets/app/ at the hub root
  build: { outDir: 'dist', assetsDir: 'assets/app', emptyOutDir: true, chunkSizeWarningLimit: 900 },
});
