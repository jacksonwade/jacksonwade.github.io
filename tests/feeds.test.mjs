import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rss, sitemap, rfc822 } from '../scripts/lib/feeds.mjs';

const site = { name: 'Kamai Jackson-Wade', url: 'https://kamai.uk', description: 'Writing.' };
const now = new Date('2026-09-25T00:00:00Z');

test('rfc822 formats a date and falls back when there is none', () => {
  assert.match(rfc822('2026-09-18', now), /^Fri, 18 Sep 2026 00:00:00 GMT$/);
  assert.match(rfc822('', now), /^Fri, 25 Sep 2026 00:00:00 GMT$/);
});

test('a year-only date still produces a legal pubDate', () => {
  const xml = rss({ site, now, items: [
    { title: 'T', url: '/blog/t', iso: '2026-01-01', summary: 'S' },
  ] });
  assert.match(xml, /<pubDate>Thu, 01 Jan 2026 00:00:00 GMT<\/pubDate>/);
});

test('an empty feed is still valid rss', () => {
  const xml = rss({ site, now, items: [] });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0"/);
  assert.match(xml, /<\/channel>\s*<\/rss>/);
  assert.doesNotMatch(xml, /<item>/);
});

test('titles with markup characters are escaped in the feed', () => {
  const xml = rss({ site, now, items: [
    { title: 'A & B <c>', url: '/blog/t', iso: '2026-01-01', summary: 'x & y' },
  ] });
  assert.match(xml, /<title>A &amp; B &lt;c&gt;<\/title>/);
  assert.doesNotMatch(xml, /<c>/);
});

test('feed links are absolute', () => {
  const xml = rss({ site, now, items: [
    { title: 'T', url: '/blog/t', iso: '2026-01-01', summary: 'S' },
  ] });
  assert.match(xml, /<link>https:\/\/kamai\.uk\/blog\/t<\/link>/);
});

test('the sitemap lists absolute urls with lastmod', () => {
  const xml = sitemap({ site, entries: [
    { url: '/', iso: '2026-09-25' },
    { url: '/blog/t', iso: '' },
  ] });
  assert.match(xml, /<loc>https:\/\/kamai\.uk\/<\/loc>/);
  assert.match(xml, /<lastmod>2026-09-25<\/lastmod>/);
  assert.match(xml, /<loc>https:\/\/kamai\.uk\/blog\/t<\/loc>/);
});
