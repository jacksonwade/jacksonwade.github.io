import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../scripts/build-content.mjs';

test('a full build writes the pages, the feed and the sitemap', () => {
  const out = mkdtempSync(join(tmpdir(), 'site-'));
  build({ outDir: out, quiet: true });

  assert.ok(existsSync(join(out, 'index.html')), 'index.html');
  assert.ok(existsSync(join(out, '404.html')), '404.html');
  assert.ok(existsSync(join(out, 'feed.xml')), 'feed.xml');
  assert.ok(existsSync(join(out, 'sitemap.xml')), 'sitemap.xml');
  assert.ok(existsSync(join(out, 'assets', 'css', 'style.css')), 'css copied');
  assert.ok(existsSync(join(out, 'CNAME')), 'CNAME copied');
});

test('the built index carries no trace of the old single-page app', () => {
  const out = mkdtempSync(join(tmpdir(), 'site-'));
  build({ outDir: out, quiet: true });
  const html = readFileSync(join(out, 'index.html'), 'utf8');

  assert.doesNotMatch(html, /app\.js/);
  assert.doesNotMatch(html, /posts\.js/);
  assert.doesNotMatch(html, /research\.js/);
  assert.doesNotMatch(html, /spa_redirect/);
  assert.doesNotMatch(html, /data-theme/);
  assert.doesNotMatch(html, /assets\/img/);
});

test('markdown sources are never copied into the output', () => {
  const out = mkdtempSync(join(tmpdir(), 'site-'));
  build({ outDir: out, quiet: true });
  assert.equal(existsSync(join(out, 'posts')), false);
  assert.equal(existsSync(join(out, 'scripts')), false);
});

test('the build writes the writing library and lists it in the sitemap', () => {
  const out = mkdtempSync(join(tmpdir(), 'site-'));
  build({ outDir: out, quiet: true });
  assert.ok(existsSync(join(out, 'blog', 'index.html')), 'blog/index.html');
  assert.match(readFileSync(join(out, 'blog', 'index.html'), 'utf8'), /<h1 class="lib-h">Writing<\/h1>/);
  assert.match(readFileSync(join(out, 'sitemap.xml'), 'utf8'), /<loc>https:\/\/kamai\.uk\/blog<\/loc>/);
});
