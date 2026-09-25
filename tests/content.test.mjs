import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { slugify, assetPath, parseLinks, formatDate, normalizeBody, readSection }
  from '../scripts/lib/content.mjs';

test('slugify lowercases, strips apostrophes and joins on hyphens', () => {
  assert.equal(slugify("Kamai's Big Idea"), 'kamais-big-idea');
});

test('assetPath leaves absolute and remote paths alone', () => {
  assert.equal(assetPath('https://e.com/a.jpg'), 'https://e.com/a.jpg');
  assert.equal(assetPath('/assets/img/a.jpg'), '/assets/img/a.jpg');
  assert.equal(assetPath('a.jpg'), '/assets/img/a.jpg');
});

test('parseLinks splits a label from a url on the bar', () => {
  assert.deepEqual(parseLinks(['View on SSRN | https://ssrn.com/x']),
    [{ label: 'View on SSRN', url: 'https://ssrn.com/x' }]);
});

test('parseLinks defaults the label when there is only a url', () => {
  assert.deepEqual(parseLinks(['https://e.com']),
    [{ label: 'View', url: 'https://e.com' }]);
});

test('formatDate handles full dates, months, years and nothing', () => {
  assert.equal(formatDate('2026-09-18').display, '18 September 2026');
  assert.equal(formatDate('2026-09-18').iso, '2026-09-18');
  assert.equal(formatDate('2026-09').display, 'September 2026');
  assert.equal(formatDate('2026-09').iso, '2026-09-01');
  assert.equal(formatDate('2026').display, '2026');
  assert.equal(formatDate('2026').iso, '2026-01-01');
  assert.equal(formatDate('').display, '');
  assert.equal(formatDate('').iso, '');
});

test('normalizeBody rewrites wikilinks to the section prefix', () => {
  assert.equal(normalizeBody('see [[Some Post]]', 'blog'),
    'see [Some Post](/blog/some-post)');
});

test('readSection skips drafts and builds urls', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sec-'));
  writeFileSync(join(dir, 'a.md'), '---\ntitle: A\ndate: 2026-01-02\n---\nbody\n');
  writeFileSync(join(dir, 'b.md'), '---\ntitle: B\ndraft: true\n---\n');
  const { items, drafts } = readSection({ dir, urlPrefix: 'blog' });
  assert.equal(drafts, 1);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, '/blog/a');
  assert.equal(items[0].date, '2 January 2026');
});

test('readSection refuses two entries with the same slug', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dup-'));
  writeFileSync(join(dir, 'a.md'), '---\ntitle: A\nslug: same\n---\n');
  writeFileSync(join(dir, 'b.md'), '---\ntitle: B\nslug: same\n---\n');
  assert.throws(() => readSection({ dir, urlPrefix: 'blog' }), /already used by/);
});

test('readSection sorts newest first', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ord-'));
  writeFileSync(join(dir, 'old.md'), '---\ntitle: Old\ndate: 2025-01-01\n---\n');
  writeFileSync(join(dir, 'new.md'), '---\ntitle: New\ndate: 2026-01-01\n---\n');
  const { items } = readSection({ dir, urlPrefix: 'blog' });
  assert.deepEqual(items.map(i => i.title), ['New', 'Old']);
});
