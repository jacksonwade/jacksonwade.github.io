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
