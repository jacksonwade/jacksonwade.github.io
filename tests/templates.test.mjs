import { test } from 'node:test';
import assert from 'node:assert/strict';
import { page, notFoundPage } from '../scripts/lib/templates.mjs';

const site = {
  name: 'Kamai Jackson-Wade',
  email: 'k [at] example.com',
  github: 'https://github.com/jacksonwade',
  url: 'https://kamai.uk',
  description: 'Writing.',
};

test('the shell is a complete dark document', () => {
  const html = page({ site, title: 'T', description: 'D', canonical: 'https://kamai.uk/', content: '<p>x</p>' });
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="color-scheme" content="dark">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/kamai\.uk\/">/);
  assert.doesNotMatch(html, /data-theme/);
  assert.doesNotMatch(html, /spa_redirect/);
});

test('titles and descriptions with markup characters are escaped', () => {
  const html = page({
    site, title: 'A & B <c> "d"', description: 'x & y',
    canonical: 'https://kamai.uk/', content: '',
  });
  assert.match(html, /<title>A &amp; B &lt;c&gt; &quot;d&quot;<\/title>/);
  assert.match(html, /content="x &amp; y"/);
  assert.doesNotMatch(html, /<title>[^<]*<c>/);
});

test('the footer carries the email as text and github as a link', () => {
  const html = page({ site, title: 'T', description: 'D', canonical: 'https://kamai.uk/', content: '' });
  assert.match(html, /k \[at\] example\.com/);
  assert.doesNotMatch(html, /mailto:/);
  assert.match(html, /href="https:\/\/github\.com\/jacksonwade"/);
});

test('the not found page links home', () => {
  const html = notFoundPage({ site });
  assert.match(html, /href="\/"/);
  assert.match(html, /<title>Not found/);
});

import { indexPage } from '../scripts/lib/templates.mjs';

const post = {
  title: 'On My Mediocrity', slug: 'mediocrity', url: '/blog/mediocrity',
  date: '18 September 2026', iso: '2026-09-18', summary: 'A summary.', body: '',
};

test('the index renders a section per non-empty group', () => {
  const html = indexPage({ site, sections: [
    { heading: 'Writing', items: [post] },
    { heading: 'Research', items: [] },
  ] });
  assert.match(html, />Writing</);
  assert.doesNotMatch(html, />Research</);
  assert.match(html, /href="\/blog\/mediocrity"/);
  assert.match(html, /18 September 2026/);
  assert.match(html, /A summary\./);
});

test('an index with nothing published has the name and no sections', () => {
  const html = indexPage({ site, sections: [
    { heading: 'Writing', items: [] },
    { heading: 'Research', items: [] },
  ] });
  assert.match(html, /Kamai Jackson-Wade/);
  assert.doesNotMatch(html, /class="sec-h"/);
  assert.match(html, /<\/html>/);
});

test('the index carries the person structured data', () => {
  const html = indexPage({ site, sections: [{ heading: 'Writing', items: [] }] });
  assert.match(html, /"@type": "Person"/);
});

test('a title with markup characters is escaped in a row', () => {
  const html = indexPage({ site, sections: [
    { heading: 'Writing', items: [{ ...post, title: 'A & B <c>' }] },
  ] });
  assert.match(html, /A &amp; B &lt;c&gt;/);
  assert.doesNotMatch(html, /<c>/);
});
