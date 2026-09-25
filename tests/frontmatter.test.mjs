import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitFrontMatter, parseFrontMatter } from '../scripts/lib/frontmatter.mjs';

test('splits front matter from body', () => {
  const { fmLines, body } = splitFrontMatter('---\ntitle: A\n---\nhello\n', 'x.md');
  assert.deepEqual(fmLines, ['title: A']);
  assert.equal(body.trim(), 'hello');
});

test('reads quoted values, booleans and lists', () => {
  const fm = parseFrontMatter(
    ['title: "A: B"', 'draft: true', 'links:', '  - View | https://e.com'],
    'x.md'
  );
  assert.equal(fm.title, 'A: B');
  assert.equal(fm.draft, true);
  assert.deepEqual(fm.links, ['View | https://e.com']);
});

test('names the file and line when front matter is missing', () => {
  assert.throws(() => splitFrontMatter('hello\n', 'bad.md'), /bad\.md:1/);
});

test('names the file and line when front matter never closes', () => {
  assert.throws(() => splitFrontMatter('---\ntitle: A\n', 'bad.md'), /bad\.md:1/);
});
