#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, watch } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, SECTIONS } from './build-content.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4000);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function rebuild() {
  try {
    build();
  } catch (e) {
    console.error('\nbuild-posts failed:\n  ' + e.message + '\n');
  }
}

rebuild();

let pending = null;
for (const section of SECTIONS) {
  const dir = join(ROOT, section.dir);
  if (!existsSync(dir)) continue;
  watch(dir, () => {
    clearTimeout(pending);
    pending = setTimeout(rebuild, 120);
  });
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = normalize(url).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  let file = join(ROOT, rel);

  if (!file.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');

  // Any path the router owns (/blog/some-post) has no file on disk; GitHub Pages
  // answers those through 404.html, so mirror that here rather than 404-ing.
  let status = 200;
  if (!existsSync(file)) {
    status = extname(url) ? 404 : 200;
    file = join(ROOT, extname(url) ? '404.html' : 'index.html');
  }
  if (!existsSync(file)) { res.writeHead(404).end('not found'); return; }

  res.writeHead(status, {
    'content-type': TYPES[extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(readFileSync(file));
}).listen(PORT, () => {
  console.log('preview: http://localhost:' + PORT + '  (watching ' + SECTIONS.map(s => s.dir + '/').join(', ') + ')');
});
