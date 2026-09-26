#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, watch } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, SECTIONS } from './build-content.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_site');
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
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function rebuild() {
  try {
    build();
  } catch (e) {
    console.error('\nbuild-content failed:\n  ' + e.message + '\n');
  }
}

rebuild();

// site.config.mjs is deliberately absent: the ES module registry caches it, so
// rebuilding after an edit would still read the old values. It needs a restart.
const WATCHED = [...SECTIONS.map(s => s.dir), 'assets'];

let pending = null;
for (const rel of WATCHED) {
  const target = join(ROOT, rel);
  if (!existsSync(target)) continue;
  watch(target, { recursive: statSync(target).isDirectory() }, () => {
    clearTimeout(pending);
    pending = setTimeout(rebuild, 120);
  });
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = normalize(url).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  let file = join(OUT, rel);
  if (!file.startsWith(OUT)) { res.writeHead(403).end('forbidden'); return; }

  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file) && !extname(file) && existsSync(file + '.html')) file += '.html';

  let status = 200;
  if (!existsSync(file)) { status = 404; file = join(OUT, '404.html'); }
  if (!existsSync(file)) { res.writeHead(404).end('not found'); return; }

  res.writeHead(status, {
    'content-type': TYPES[extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(readFileSync(file));
}).listen(PORT, () => {
  console.log('preview: http://localhost:' + PORT + '  (watching ' + WATCHED.join(', ') + ')');
});
