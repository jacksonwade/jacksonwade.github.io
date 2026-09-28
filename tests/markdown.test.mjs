import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, inlineLinks, parseBody, renderBody } from '../scripts/lib/markdown.mjs';

test('esc neutralises markup characters', () => {
  assert.equal(esc('a & b < c "d"'), 'a &amp; b &lt; c &quot;d&quot;');
});

test('inline code survives bold and bracket markers inside it', () => {
  assert.equal(inlineLinks('use `a**b**c` here'),
    'use <code class="d-code">a**b**c</code> here');
});

test('external links open in a new tab, internal ones do not', () => {
  assert.match(inlineLinks('[a](https://e.com)'), /target="_blank"/);
  assert.doesNotMatch(inlineLinks('[a](/blog/x)'), /target="_blank"/);
});

test('parseBody groups consecutive bullets into one list', () => {
  assert.deepEqual(parseBody('- a\n- b\n'), [{ list: ['a', 'b'] }]);
});

test('parseBody keeps fenced code verbatim, indentation included', () => {
  const blocks = parseBody('```js\n  indented\n```\n');
  assert.deepEqual(blocks, [{ code: '  indented', lang: 'js' }]);
});

test('headings render as h2 with an id and are reported', () => {
  const { html, headings } = renderBody(parseBody('## Why It Starts\n\ntext\n'));
  assert.match(html, /<h2 class="d-h" id="why-it-starts">/);
  assert.deepEqual(headings, [{ id: 'why-it-starts', text: 'Why It Starts' }]);
});

test('headings that slugify the same get unique ids', () => {
  const { html, headings } = renderBody(parseBody('## Why\n\n## Why\n\n## Why\n'));
  assert.deepEqual(headings.map(h => h.id), ['why', 'why-2', 'why-3']);
  assert.match(html, /id="why-2"/);
  assert.match(html, /id="why-3"/);
});

test('an empty body renders to empty html and no headings', () => {
  assert.deepEqual(renderBody(parseBody('')), { html: '', headings: [] });
});

test('a heading whose slug collides with an existing suffix still gets a unique id', () => {
  const { headings } = renderBody(parseBody('## Why\n\n## Why\n\n## Why 2\n'));
  const ids = headings.map(h => h.id);
  assert.equal(new Set(ids).size, ids.length, 'ids must be unique, got ' + ids.join(', '));
});

test('inline markdown in a heading is stripped from its id and its contents label', () => {
  const { html, headings } = renderBody(parseBody('## **Bold** and [a link](https://e.com)\n'));
  assert.deepEqual(headings, [{ id: 'bold-and-a-link', text: 'Bold and a link' }]);
  assert.match(html, /<strong>Bold<\/strong>/);
});

test('a heading carries no link, so clicking it never changes the address', () => {
  const { html } = renderBody(parseBody('## The Point\n\ntext\n'));
  assert.equal(html.match(/<h2[\s\S]*?<\/h2>/)[0], '<h2 class="d-h" id="the-point">The Point</h2>');
  assert.doesNotMatch(html, /d-anchor|href="#/);
});

test('a quote renders as a figure holding the blockquote', () => {
  const { html } = renderBody(parseBody('> We suffer more in imagination\n> than in reality.\n'));
  assert.equal(html, '<figure class="d-quote"><blockquote><p>We suffer more in imagination than in reality.</p></blockquote></figure>');
});

test('a bare > line splits a quote into paragraphs', () => {
  const { html } = renderBody(parseBody('> First.\n>\n> Second.\n'));
  assert.match(html, /<blockquote><p>First\.<\/p><p>Second\.<\/p><\/blockquote>/);
});

test('a last line starting with -- becomes the attribution, outside the quoted words', () => {
  const { html } = renderBody(parseBody('> We suffer more in imagination than in reality.\n> -- Seneca, *Letters*\n'));
  assert.equal(html, '<figure class="d-quote"><blockquote><p>We suffer more in imagination than in reality.</p></blockquote>' +
    '<figcaption class="d-cite">Seneca, <em>Letters</em></figcaption></figure>');
});
