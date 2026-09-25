import { test } from 'node:test';
import assert from 'node:assert/strict';
import { page, indexPage, detailPage, notFoundPage } from '../scripts/lib/templates.mjs';

const site = {
  name: 'Kamai Jackson-Wade',
  email: 'k [at] example.com',
  github: 'https://github.com/jacksonwade',
  url: 'https://kamai.uk',
  description: 'Writing.',
};

function article(html) {
  return (html.match(/<article>[\s\S]*?<\/article>/) || [''])[0];
}

const post = {
  title: 'On My Mediocrity', slug: 'mediocrity', url: '/blog/mediocrity',
  date: '18 September 2026', iso: '2026-09-18', year: '2026', summary: 'A summary.', body: '',
};

test('the shell is a complete dark document', () => {
  const html = page({ site, title: 'T', description: 'D', canonical: 'https://kamai.uk/', content: '<p>x</p>' });
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="color-scheme" content="dark">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/kamai\.uk\/">/);
  assert.match(html, /Newsreader-Roman\.woff2/);
  assert.doesNotMatch(html, /data-theme/);
  assert.doesNotMatch(html, /spa_redirect/);
  assert.doesNotMatch(html, /Archivo/);
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

test('the not found page links home', () => {
  const html = notFoundPage({ site });
  assert.match(html, /href="\/"/);
  assert.match(html, /<title>Not found/);
  assert.match(html, /k \[at\] example\.com/);
});

test('the index renders a section per non-empty group', () => {
  const html = indexPage({ site, sections: [
    { heading: 'Writing', items: [post] },
    { heading: 'Research', items: [] },
  ] });
  assert.match(html, /<h2 class="sec-h">Writing<\/h2>/);
  assert.doesNotMatch(html, />Research</);
  assert.match(html, /href="\/blog\/mediocrity"/);
  assert.match(html, /A summary\./);
});

test('the index shows the year alone, never a full date', () => {
  const html = indexPage({ site, sections: [{ heading: 'Writing', items: [post] }] });
  assert.match(html, /<span class="row-date">2026<\/span>/);
  assert.doesNotMatch(html, /September/);
  assert.doesNotMatch(html, /18\.09/);
});

test('an item with no year emits no date element at all', () => {
  const html = indexPage({ site, sections: [
    { heading: 'Writing', items: [{ ...post, year: '' }] },
  ] });
  assert.doesNotMatch(html, /row-date/);
});

test('an index with nothing published has the name and the ending and no sections', () => {
  const html = indexPage({ site, sections: [
    { heading: 'Writing', items: [] },
    { heading: 'Research', items: [] },
  ] });
  assert.match(html, /Kamai Jackson-Wade/);
  assert.doesNotMatch(html, /class="sec-h"/);
  assert.match(html, /k \[at\] example\.com/);
  assert.match(html, /<\/html>/);
});

test('the index carries the person structured data', () => {
  const html = indexPage({ site, sections: [{ heading: 'Writing', items: [] }] });
  assert.match(html, /"@type": "Person"/);
});

test('a title and a summary with markup characters are escaped', () => {
  const html = indexPage({ site, sections: [
    { heading: 'Writing', items: [{ ...post, title: 'A & B <c>', summary: 'x & y "z"' }] },
  ] });
  assert.match(html, /A &amp; B &lt;c&gt;/);
  assert.match(html, /x &amp; y &quot;z&quot;/);
  assert.doesNotMatch(html, /<c>/);
});

test('the ending stacks the links with nothing joining them', () => {
  const html = indexPage({ site, sections: [{ heading: 'Writing', items: [post] }] });
  assert.match(html, /k \[at\] example\.com/);
  assert.doesNotMatch(html, /mailto:/);
  assert.match(html, /href="https:\/\/github\.com\/jacksonwade"/);
  assert.doesNotMatch(html, /&middot;/);
});

test('the page shell no longer loads any script', () => {
  const html = indexPage({ site, sections: [{ heading: 'Writing', items: [post] }] });
  assert.doesNotMatch(html, /<script src=/);
  assert.doesNotMatch(html, /contents\.js/);
});

test('a post with many headings gets no contents block and no script', () => {
  const html = detailPage({ site, item: {
    ...post, body: '## One\n\ntext\n\n## Two\n\ntext\n\n## Three\n\ntext\n',
  } });
  assert.doesNotMatch(html, /class="toc"/);
  assert.doesNotMatch(html, /contents\.js/);
  assert.doesNotMatch(html, /<script src=/);
  assert.match(html, /id="one"/);
});

test('an entry with no body renders its title and date and nothing else', () => {
  const html = detailPage({ site, item: { ...post, body: '', summary: 'A summary.' } });
  const art = article(html);
  assert.match(art, /<h1 class="d-title">On My Mediocrity<\/h1>/);
  assert.match(art, /<p class="d-date">2026<\/p>/);
  assert.match(art, /<div class="d-body"><\/div>/);
  assert.doesNotMatch(art, /A summary\./);
  assert.match(html, /name="description" content="A summary\."/);
});

test('a research entry with no body behaves the same way', () => {
  const html = detailPage({ site, item: {
    title: 'Titan', url: '/research/titan', year: '2026', summary: 'An abstract.', body: '',
  } });
  const art = article(html);
  assert.match(art, /<div class="d-body"><\/div>/);
  assert.doesNotMatch(art, /An abstract\./);
});

test('an entry with no year emits no date element', () => {
  const html = detailPage({ site, item: { ...post, year: '', body: 'text\n' } });
  assert.doesNotMatch(html, /d-date/);
});

test('front matter links render under the date', () => {
  const html = detailPage({ site, item: {
    ...post, links: [{ label: 'View on SSRN', url: 'https://ssrn.com/x' }],
  } });
  assert.match(html, /class="d-links"/);
  assert.match(html, /View on SSRN/);
  assert.match(html, /href="https:\/\/ssrn\.com\/x"/);
});

test('a title with markup characters is escaped on a post page', () => {
  const html = detailPage({ site, item: { ...post, title: 'A & B <c>' } });
  assert.match(html, /A &amp; B &lt;c&gt;/);
  assert.doesNotMatch(html, /<h1 class="d-title">A & B <c>/);
});

test('the title tag pairs the post with the site name', () => {
  const html = detailPage({ site, item: post });
  assert.match(html, /<title>On My Mediocrity :: Kamai Jackson-Wade<\/title>/);
});
