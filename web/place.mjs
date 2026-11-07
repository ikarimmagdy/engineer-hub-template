// Puts the built front-end at the template root (index.html, assets/app/), where tools/hub-update.sh copies it into hubs.
import { cpSync, rmSync } from 'node:fs';

const root = new URL('../', import.meta.url);
rmSync(new URL('assets/app', root), { recursive: true, force: true });
cpSync(new URL('dist/assets/app', import.meta.url), new URL('assets/app', root), { recursive: true });
cpSync(new URL('dist/index.html', import.meta.url), new URL('index.html', root));
console.log('placed index.html and assets/app/ at the template root');
