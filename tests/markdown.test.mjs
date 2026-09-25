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
