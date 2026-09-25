# kamai.uk Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the client-side single-page app with static HTML generated at build time, redesigned dark-only in Archivo, whose front page is an index of Kamai's writing.

**Architecture:** `scripts/build-content.mjs` becomes an orchestrator over small modules in `scripts/lib/`. It reads markdown from `posts/` and `research/`, renders finished HTML, and writes everything into a `_site/` output directory that the deploy workflow uploads. The browser receives documents, not a renderer. The only client-side JavaScript is a contents block that can be closed.

**Tech Stack:** Node (no dependencies, no `package.json`), `node --test` with `node:assert/strict`, plain CSS, plain HTML.

**Spec:** `docs/superpowers/specs/2026-09-25-site-redesign-design.md`

## Global Constraints

- No npm dependencies and no `package.json`. Everything uses the Node standard library.
- Code must run on Node 20, which is what `.github/workflows/deploy.yml` pins. Do not use APIs newer than Node 20. Local development may be on a newer Node.
- `node` is broken in non-interactive shells on this machine because of an nvm lazy-load hook. Use the absolute path `/opt/homebrew/bin/node` in every command.
- No em dashes or en dashes anywhere, in source, in generated markup, or in copy. Use commas, periods or parentheses.
- No comment blocks above code explaining what it does. Rare inline comments only, for a genuine workaround or a subtle constraint. No comments in config files. No decorative banners.
- Post URL prefix is `/blog`, research is `/research`. The index heading above the posts says "Writing" while the URLs say `/blog`. This mismatch is deliberate and must not be tidied up.
- Palette tokens, exact values: `--bg: #0d0d0f`, `--body: #eaeaea`, `--muted: #b7b7b7`, `--line: #26262a`, `--code-bg: #17171a`.
- Body type, exact values: Archivo 400, `1.15rem`, `line-height: 1.8`, `max-width: 36rem`.
- Never invent biographical copy about Kamai. The only prose the site carries is what is already in `posts/`, `research/` and `site.config.mjs`.

## Review Focus

These are failure modes the spec implies but does not spell out. Each one has its test pinned to the task that owns the code.

1. Two `##` headings in one post whose text slugifies identically produce duplicate `id` attributes, so `#anchor` links silently jump to the wrong section. Owned by Task 2.
2. A title or summary containing `&`, `<` or a double quote breaks the `<title>` tag, the `meta description`, the canonical URL or the RSS XML. Owned by Tasks 3 and 6.
3. An entry with front matter but no body at all, which is exactly what `posts/mediocrity.md` is today, must render a page rather than crash or emit an empty `<article>`. Owned by Task 5.
4. Every entry drafted, which is the state the site is in right now, must still produce a valid index with no section headings and a valid feed with zero items. Owned by Tasks 4 and 6.
5. A `date` of just `2026`, or a missing `date`, must still produce a legal RFC-822 `pubDate` in RSS and a legal `lastmod` in the sitemap. Owned by Task 6.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `site.config.mjs` | Name, email, GitHub URL, site URL, index description. Replaces `assets/js/content.js` |
| `scripts/lib/frontmatter.mjs` | Reading `---` front matter into an object, with filename and line number on failure |
| `scripts/lib/content.mjs` | Slugs, asset paths, link lists, date formatting, reading a section directory into entries |
| `scripts/lib/markdown.mjs` | The markdown subset to HTML, and the heading list a contents block needs |
| `scripts/lib/templates.mjs` | The page shell and the three page types |
| `scripts/lib/feeds.mjs` | `feed.xml` and `sitemap.xml` |
| `assets/js/contents.js` | The contents block open/close behaviour. The only client-side script |
| `tests/*.test.mjs` | One test file per lib module, plus an end-to-end build test |

**Modified:**

| Path | Change |
|---|---|
| `scripts/build-content.mjs` | Becomes an orchestrator that writes `_site/` |
| `scripts/serve.mjs` | Serves `_site/`, drops the SPA fallback |
| `scripts/WRITING.md` | Documents the fields that still exist |
| `assets/css/style.css` | Rewritten |
| `.github/workflows/deploy.yml` | Uploads `_site/` instead of deleting sources from the repo root |
| `.gitignore` | Ignores `_site/` |

**Deleted:** `assets/js/app.js`, `assets/js/content.js`, `assets/img/`, and the tracked `index.html` and `404.html` (both become generated).

---

### Task 1: Extract the content pipeline into testable modules

Pure extraction. `scripts/build-content.mjs` keeps working exactly as it does today, but its parsing moves into modules with tests. One behaviour is added: `formatDate` also returns an ISO date, which RSS needs in Task 6.

**Files:**
- Create: `scripts/lib/frontmatter.mjs`
- Create: `scripts/lib/content.mjs`
- Create: `tests/frontmatter.test.mjs`
- Create: `tests/content.test.mjs`
- Modify: `scripts/build-content.mjs` (import from the new modules, delete the moved code)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `fail(file, line, msg)` throws `Error` with message `` `${file}:${line}  ${msg}` ``
  - `splitFrontMatter(raw, file) -> { fmLines: string[], body: string }`
  - `parseFrontMatter(fmLines, file) -> Record<string, unknown>`
  - `slugify(s) -> string`
  - `assetPath(p) -> string`
  - `parseLinks(raw) -> { label: string, url: string }[]`
  - `formatDate(v) -> { display: string, sort: number, iso: string }` where `iso` is `''` when there is no usable date
  - `normalizeBody(body, urlPrefix) -> string`
  - `readSection({ dir, urlPrefix }) -> { items: Entry[], drafts: number }`
  - `Entry = { title, slug, url, date, iso, summary?, links?, body }`

- [ ] **Step 1: Write the failing tests for front matter**

Create `tests/frontmatter.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `/opt/homebrew/bin/node --test tests/frontmatter.test.mjs`
Expected: FAIL, cannot find module `../scripts/lib/frontmatter.mjs`.

- [ ] **Step 3: Create the front matter module**

Create `scripts/lib/frontmatter.mjs` by moving `fail`, `scalar`, `splitFrontMatter` and `parseFrontMatter` out of `scripts/build-content.mjs` verbatim, adding `export` to each of `fail`, `splitFrontMatter` and `parseFrontMatter`. Do not change their behaviour.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `/opt/homebrew/bin/node --test tests/frontmatter.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing tests for content**

Create `tests/content.test.mjs`:

```js
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

test('parseLinks splits on the last bar', () => {
  assert.deepEqual(parseLinks(['View | https://e.com/a|b']),
    [{ label: 'View', url: 'b' }]);
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
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `/opt/homebrew/bin/node --test tests/content.test.mjs`
Expected: FAIL, cannot find module `../scripts/lib/content.mjs`.

- [ ] **Step 7: Create the content module**

Create `scripts/lib/content.mjs`. Move `assetPath`, `slugify`, `normalizeBody`, `parseLinks`, `formatDate`, `MONTHS` and `readSection` out of `scripts/build-content.mjs`, and export `slugify`, `assetPath`, `parseLinks`, `formatDate`, `normalizeBody` and `readSection`.

Four changes to the moved code, everything else stays as it is:

```js
// formatDate gains iso on each branch
function pad(n) { return String(n).padStart(2, '0'); }

export function formatDate(v) {
  if (v === undefined || v === null || v === '') return { display: '', sort: 0, iso: '' };
  const s = String(v).trim();

  const full = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (full && MONTHS[Number(full[2]) - 1]) {
    return {
      display: Number(full[3]) + ' ' + MONTHS[Number(full[2]) - 1] + ' ' + full[1],
      sort: Date.UTC(Number(full[1]), Number(full[2]) - 1, Number(full[3])),
      iso: full[1] + '-' + full[2] + '-' + full[3],
    };
  }
  const month = s.match(/^(\d{4})-(\d{2})$/);
  if (month && MONTHS[Number(month[2]) - 1]) {
    return {
      display: MONTHS[Number(month[2]) - 1] + ' ' + month[1],
      sort: Date.UTC(Number(month[1]), Number(month[2]) - 1, 1),
      iso: month[1] + '-' + month[2] + '-01',
    };
  }
  const year = s.match(/^(\d{4})$/);
  if (year) {
    return { display: year[1], sort: Date.UTC(Number(year[1]), 0, 1), iso: year[1] + '-01-01' };
  }
  return { display: s, sort: 0, iso: '' };
}
```

`normalizeBody` takes the URL prefix directly instead of deriving it:

```js
export function normalizeBody(body, urlPrefix) {
  return body
    .replace(/!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
      (m, target, cap) => '![' + (cap || '').trim() + '](' + assetPath(target) + ')')
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
      (m, target, label) => '[' + (label || target).trim() + '](/' + urlPrefix + '/' + slugify(target) + ')')
    .replace(/(!\[[^\]]*\]\()([^)]+)(\))/g,
      (m, open, path, close) => open + assetPath(path) + close);
}
```

`readSection` takes a directory path and a URL prefix, drops `tag`, `image` and `featured`, and adds `url` and `iso`:

```js
export function readSection({ dir, urlPrefix }) {
  const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.md')).sort() : [];
  const items = [];
  const seen = new Map();
  let drafts = 0;

  for (const name of files) {
    const rel = urlPrefix + '/' + name;
    const { fmLines, body } = splitFrontMatter(readFileSync(join(dir, name), 'utf8'), rel);
    const fm = parseFrontMatter(fmLines, rel);

    if (fm.draft === true) { drafts++; continue; }

    const title = typeof fm.title === 'string' ? fm.title.trim() : '';
    if (!title) fail(rel, 1, 'front matter needs a non-empty "title"');

    const slug = (typeof fm.slug === 'string' && fm.slug.trim())
      ? slugify(fm.slug)
      : slugify(basename(name, '.md'));
    if (seen.has(slug)) fail(rel, 1, 'slug "' + slug + '" is already used by ' + seen.get(slug));
    seen.set(slug, rel);

    const when = formatDate(fm.date);
    const item = {
      title,
      slug,
      url: '/' + urlPrefix + '/' + slug,
      date: when.display,
      iso: when.iso,
      _sort: when.sort,
      body: normalizeBody(body, urlPrefix).trim(),
    };
    if (fm.summary) item.summary = String(fm.summary);
    const links = parseLinks(fm.links);
    if (links.length) item.links = links;

    items.push(item);
  }

  items.sort((a, b) => (b._sort - a._sort) || a.title.localeCompare(b.title));
  items.forEach(i => { delete i._sort; });
  return { items, drafts };
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `/opt/homebrew/bin/node --test tests/content.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 9: Point the old build script at the new modules**

In `scripts/build-content.mjs`, delete the moved functions and import what it still needs. It must keep emitting `assets/js/posts.js` and `assets/js/research.js` for now, so the site keeps working until Task 7 replaces it. Update its `SECTIONS` to carry `urlPrefix`:

```js
export const SECTIONS = [
  { dir: 'posts',    key: 'posts',    urlPrefix: 'blog',     out: 'posts.js' },
  { dir: 'research', key: 'research', urlPrefix: 'research', out: 'research.js' },
];
```

and call `readSection({ dir: join(ROOT, section.dir), urlPrefix: section.urlPrefix })`.

- [ ] **Step 10: Verify the old build still runs**

Run: `/opt/homebrew/bin/node scripts/build-content.mjs`
Expected: `posts: 0 published, 1 draft  |  research: 0 published, 3 draft`

- [ ] **Step 11: Commit**

```bash
git add scripts/lib/frontmatter.mjs scripts/lib/content.mjs tests/ scripts/build-content.mjs
git commit -m "extract front matter and content parsing into tested modules"
```

---

### Task 2: Port the markdown renderer, with heading ids

The renderer currently runs in the browser inside `assets/js/app.js`. Move it, do not rewrite it. The one addition is that headings get unique ids and are returned as a list, which the contents block needs.

**Files:**
- Create: `scripts/lib/markdown.mjs`
- Create: `tests/markdown.test.mjs`
- Reference: `assets/js/app.js:44-75` (`esc`, `inlineLinks`), `assets/js/app.js:266-338` (`parseBody`, `blockMarkup`)

**Interfaces:**
- Consumes: `slugify` from `scripts/lib/content.mjs`.
- Produces:
  - `esc(s) -> string`
  - `inlineLinks(s) -> string`
  - `parseBody(body) -> Block[]`
  - `renderBody(blocks) -> { html: string, headings: { id: string, text: string }[] }`

- [ ] **Step 1: Write the failing tests**

Create `tests/markdown.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `/opt/homebrew/bin/node --test tests/markdown.test.mjs`
Expected: FAIL, cannot find module `../scripts/lib/markdown.mjs`.

- [ ] **Step 3: Create the markdown module**

Create `scripts/lib/markdown.mjs`. Copy `esc` (`app.js:44-49`), `inlineLinks` (`app.js:52-75`) and `parseBody` (`app.js:266-317`) across unchanged except for adding `export` and converting `var` to `const`/`let`. Then replace `blockMarkup` with a version that takes an id allocator, and add `renderBody`:

```js
import { slugify } from './content.mjs';

function blockMarkup(b, headingId) {
  if (typeof b === 'string') return '<p>' + inlineLinks(b) + '</p>';
  if (b.h) {
    const id = headingId(b.h);
    return '<h2 class="d-h" id="' + id + '">' + inlineLinks(b.h) +
      '<a class="d-anchor" href="#' + id + '" aria-label="Link to this section">#</a></h2>';
  }
  if (b.p)     return '<p>' + inlineLinks(b.p) + '</p>';
  if (b.hr)    return '<hr class="d-hr">';
  if (typeof b.code === 'string') return '<pre class="d-pre"><code>' + esc(b.code) + '</code></pre>';
  if (b.quote) return '<blockquote class="d-quote">' + inlineLinks(b.quote) + '</blockquote>';
  if (b.list)  return '<ul class="d-list">' + b.list.map(li => '<li>' + inlineLinks(li) + '</li>').join('') + '</ul>';
  if (b.ol)    return '<ol class="d-ol">' + b.ol.map(li => '<li>' + inlineLinks(li) + '</li>').join('') + '</ol>';
  if (b.img)   return '<figure class="d-fig"><img src="' + esc(b.img) + '" alt="' +
                  esc(b.cap || '') + '" loading="lazy">' +
                  (b.cap ? '<figcaption>' + inlineLinks(b.cap) + '</figcaption>' : '') + '</figure>';
  return '';
}

export function renderBody(blocks) {
  const used = new Map();
  const headings = [];

  function headingId(text) {
    const base = slugify(text) || 'section';
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    const id = n === 1 ? base : base + '-' + n;
    headings.push({ id, text });
    return id;
  }

  const html = blocks.map(b => blockMarkup(b, headingId)).join('');
  return { html, headings };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `/opt/homebrew/bin/node --test tests/markdown.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/markdown.mjs tests/markdown.test.mjs
git commit -m "port the markdown renderer out of the browser into the build"
```

---

### Task 3: The page shell and the not-found page

**Files:**
- Create: `site.config.mjs`
- Create: `scripts/lib/templates.mjs`
- Create: `tests/templates.test.mjs`

**Interfaces:**
- Consumes: `esc` from `scripts/lib/markdown.mjs`.
- Produces:
  - `SITE` default export from `site.config.mjs`: `{ name, email, github, url, description }`
  - `page({ site, title, description, canonical, bodyClass, extraHead, content, script }) -> string`
  - `footer(site) -> string`
  - `notFoundPage({ site }) -> string`

- [ ] **Step 1: Write the failing tests**

Create `tests/templates.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `/opt/homebrew/bin/node --test tests/templates.test.mjs`
Expected: FAIL, cannot find module `../scripts/lib/templates.mjs`.

- [ ] **Step 3: Create the site config**

Create `site.config.mjs`. Carry over only the values still used, taken verbatim from `assets/js/content.js`:

```js
export default {
  name:        'Kamai Jackson-Wade',
  email:       'kamaijacksonwade [at] gmail.com',
  github:      'https://github.com/jacksonwade',
  url:         'https://kamai.uk',
  description: 'Writing and research by Kamai Jackson-Wade.',
};
```

- [ ] **Step 4: Create the templates module**

Create `scripts/lib/templates.mjs` with the shell, the footer and the not-found page:

```js
import { esc } from './markdown.mjs';

export function footer(site) {
  return '<footer class="ftr">' +
    '<span class="ftr-mail">' + esc(site.email) + '</span>' +
    '<span class="ftr-dot">&middot;</span>' +
    '<a class="ftr-link" href="' + esc(site.github) + '" rel="me noopener">GitHub</a>' +
  '</footer>';
}

export function page({ site, title, description, canonical, bodyClass = '', extraHead = '', content, script = false }) {
  return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'<title>' + esc(title) + '</title>\n' +
'<meta name="author" content="' + esc(site.name) + '">\n' +
'<meta name="description" content="' + esc(description) + '">\n' +
'<meta name="color-scheme" content="dark">\n' +
'<link rel="canonical" href="' + esc(canonical) + '">\n' +
'<link rel="icon" href="/favicon.svg">\n' +
'<link rel="alternate" type="application/rss+xml" title="' + esc(site.name) + '" href="/feed.xml">\n' +
'<meta property="og:type" content="website">\n' +
'<meta property="og:url" content="' + esc(canonical) + '">\n' +
'<meta property="og:title" content="' + esc(title) + '">\n' +
'<meta property="og:description" content="' + esc(description) + '">\n' +
'<link rel="preload" href="/assets/fonts/Archivo-Regular.woff2" as="font" type="font/woff2" crossorigin>\n' +
'<style>html{background:#0d0d0f}</style>\n' +
'<link rel="stylesheet" href="/assets/css/style.css">\n' +
extraHead +
'</head>\n' +
'<body' + (bodyClass ? ' class="' + bodyClass + '"' : '') + '>\n' +
content + '\n' +
footer(site) + '\n' +
(script ? '<script src="/assets/js/contents.js" defer></script>\n' : '') +
'</body>\n' +
'</html>\n';
}

export function notFoundPage({ site }) {
  return page({
    site,
    title: 'Not found :: ' + site.name,
    description: 'That page does not exist.',
    canonical: site.url + '/404',
    content: '<main class="wrap"><h1 class="nf-h">Not found</h1>' +
      '<p class="nf-p">That page does not exist. <a class="link" href="/">Go home</a>.</p></main>',
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `/opt/homebrew/bin/node --test tests/templates.test.mjs`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add site.config.mjs scripts/lib/templates.mjs tests/templates.test.mjs
git commit -m "add the page shell, the site config and the not-found page"
```

---

### Task 4: The index page

**Files:**
- Modify: `scripts/lib/templates.mjs`
- Modify: `tests/templates.test.mjs`

**Interfaces:**
- Consumes: `page`, `esc`.
- Produces: `indexPage({ site, sections }) -> string` where `sections` is `{ heading: string, items: Entry[] }[]`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/templates.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `/opt/homebrew/bin/node --test tests/templates.test.mjs`
Expected: FAIL, `indexPage` is not exported.

- [ ] **Step 3: Implement the index page**

Add to `scripts/lib/templates.mjs`:

```js
function personJsonLd(site) {
  return '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.name,
    url: site.url,
    sameAs: [site.github],
  }) + '</script>\n';
}

function row(item) {
  return '<li class="row">' +
    '<a class="row-link" href="' + esc(item.url) + '">' +
      '<span class="row-title">' + esc(item.title) + '</span>' +
      (item.date ? '<span class="row-date">' + esc(item.date) + '</span>' : '') +
    '</a>' +
    (item.summary ? '<p class="row-sum">' + esc(item.summary) + '</p>' : '') +
  '</li>';
}

export function indexPage({ site, sections }) {
  const body = sections
    .filter(s => s.items.length)
    .map(s => '<section class="sec">' +
      '<h2 class="sec-h">' + esc(s.heading) + '</h2>' +
      '<ul class="rows">' + s.items.map(row).join('') + '</ul>' +
    '</section>')
    .join('');

  return page({
    site,
    title: site.name,
    description: site.description,
    canonical: site.url + '/',
    bodyClass: 'is-index',
    extraHead: personJsonLd(site),
    content: '<main class="wrap"><h1 class="name">' + esc(site.name) + '</h1>' + body + '</main>',
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `/opt/homebrew/bin/node --test tests/templates.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/templates.mjs tests/templates.test.mjs
git commit -m "add the index page template"
```

---

### Task 5: The detail page and the contents block

**Files:**
- Modify: `scripts/lib/templates.mjs`
- Modify: `tests/templates.test.mjs`

**Interfaces:**
- Consumes: `page`, `esc`, `parseBody`, `renderBody`.
- Produces:
  - `contentsBlock(headings) -> string`, empty string when fewer than three headings
  - `detailPage({ site, item }) -> string`

- [ ] **Step 1: Write the failing tests**

Append to `tests/templates.test.mjs`:

```js
import { detailPage, contentsBlock } from '../scripts/lib/templates.mjs';

test('the contents block needs three headings to appear', () => {
  assert.equal(contentsBlock([{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }]), '');
  const html = contentsBlock([
    { id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' },
  ]);
  assert.match(html, /href="#a"/);
  assert.match(html, /toc-close/);
});

test('a post with three headings gets a contents block and the script', () => {
  const html = detailPage({ site, item: {
    ...post, body: '## One\n\ntext\n\n## Two\n\ntext\n\n## Three\n\ntext\n',
  } });
  assert.match(html, /class="toc"/);
  assert.match(html, /contents\.js/);
  assert.match(html, /id="one"/);
});

test('a post with one heading gets neither', () => {
  const html = detailPage({ site, item: { ...post, body: '## One\n\ntext\n' } });
  assert.doesNotMatch(html, /class="toc"/);
  assert.doesNotMatch(html, /contents\.js/);
});

test('an entry with no body at all still renders a page', () => {
  const html = detailPage({ site, item: { ...post, body: '' } });
  assert.match(html, /<h1 class="d-title">On My Mediocrity<\/h1>/);
  assert.match(html, /A summary\./);
  assert.match(html, /<\/html>/);
});

test('front matter links render under the subtitle', () => {
  const html = detailPage({ site, item: {
    ...post, links: [{ label: 'View on SSRN', url: 'https://ssrn.com/x' }],
  } });
  assert.match(html, /View on SSRN/);
  assert.match(html, /href="https:\/\/ssrn\.com\/x"/);
});

test('the title tag pairs the post with the site name', () => {
  const html = detailPage({ site, item: post });
  assert.match(html, /<title>On My Mediocrity :: Kamai Jackson-Wade<\/title>/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `/opt/homebrew/bin/node --test tests/templates.test.mjs`
Expected: FAIL, `detailPage` is not exported.

- [ ] **Step 3: Implement the detail page**

Add to `scripts/lib/templates.mjs`, importing `parseBody` and `renderBody` from `./markdown.mjs`:

```js
export function contentsBlock(headings) {
  if (headings.length < 3) return '';
  return '<nav class="toc" id="toc" aria-label="Contents">' +
    '<div class="toc-head">' +
      '<span class="toc-h">Contents</span>' +
      '<button class="toc-close" type="button" aria-label="Hide contents" aria-expanded="true">&times;</button>' +
    '</div>' +
    '<ol class="toc-list">' + headings.map(h =>
      '<li><a class="toc-link" href="#' + esc(h.id) + '">' + esc(h.text) + '</a></li>'
    ).join('') + '</ol>' +
  '</nav>' +
  '<button class="toc-tab" id="toc-tab" type="button" aria-label="Show contents" hidden>Contents</button>';
}

export function detailPage({ site, item }) {
  const { html: bodyHtml, headings } = renderBody(parseBody(item.body));
  const toc = contentsBlock(headings);

  const links = (item.links || []).map(l =>
    '<a class="d-btn" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
      esc(l.label) + ' &nearr;</a>'
  ).join('');

  const content =
    '<header class="hdr"><a class="brand" href="/">' + esc(site.name) + '</a></header>' +
    '<main class="wrap d-wrap">' +
      '<article class="detail">' +
        '<header class="d-head">' +
          '<h1 class="d-title">' + esc(item.title) + '</h1>' +
          (item.date ? '<p class="d-date">' + esc(item.date) + '</p>' : '') +
          (item.summary ? '<p class="d-sub">' + esc(item.summary) + '</p>' : '') +
          (links ? '<div class="d-btns">' + links + '</div>' : '') +
        '</header>' +
        toc +
        '<div class="d-body">' + bodyHtml + '</div>' +
      '</article>' +
      '<p class="d-top"><a class="link" href="#">Back to top</a></p>' +
    '</main>';

  return page({
    site,
    title: item.title + ' :: ' + site.name,
    description: item.summary || item.title,
    canonical: site.url + item.url,
    bodyClass: 'is-detail' + (toc ? ' has-toc' : ''),
    content,
    script: Boolean(toc),
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `/opt/homebrew/bin/node --test tests/templates.test.mjs`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/templates.mjs tests/templates.test.mjs
git commit -m "add the detail page template and the contents block"
```

---

### Task 6: RSS and the sitemap

**Files:**
- Create: `scripts/lib/feeds.mjs`
- Create: `tests/feeds.test.mjs`

**Interfaces:**
- Consumes: `esc`.
- Produces:
  - `rfc822(iso) -> string`, falling back to the build time when `iso` is empty
  - `rss({ site, items, now }) -> string`
  - `sitemap({ site, entries }) -> string` where `entries` is `{ url: string, iso: string }[]`

- [ ] **Step 1: Write the failing tests**

Create `tests/feeds.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `/opt/homebrew/bin/node --test tests/feeds.test.mjs`
Expected: FAIL, cannot find module `../scripts/lib/feeds.mjs`.

- [ ] **Step 3: Implement the feeds module**

Create `scripts/lib/feeds.mjs`:

```js
import { esc } from './markdown.mjs';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON  = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n) { return String(n).padStart(2, '0'); }

export function rfc822(iso, now = new Date()) {
  const d = iso ? new Date(iso + 'T00:00:00Z') : now;
  const safe = Number.isNaN(d.getTime()) ? now : d;
  return DAYS[safe.getUTCDay()] + ', ' + pad(safe.getUTCDate()) + ' ' +
    MON[safe.getUTCMonth()] + ' ' + safe.getUTCFullYear() + ' ' +
    pad(safe.getUTCHours()) + ':' + pad(safe.getUTCMinutes()) + ':' +
    pad(safe.getUTCSeconds()) + ' GMT';
}

export function rss({ site, items, now = new Date() }) {
  const entries = items.map(i =>
    '  <item>\n' +
    '    <title>' + esc(i.title) + '</title>\n' +
    '    <link>' + esc(site.url + i.url) + '</link>\n' +
    '    <guid isPermaLink="true">' + esc(site.url + i.url) + '</guid>\n' +
    '    <pubDate>' + rfc822(i.iso, now) + '</pubDate>\n' +
    (i.summary ? '    <description>' + esc(i.summary) + '</description>\n' : '') +
    '  </item>\n'
  ).join('');

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n' +
'<channel>\n' +
'  <title>' + esc(site.name) + '</title>\n' +
'  <link>' + esc(site.url) + '/</link>\n' +
'  <description>' + esc(site.description) + '</description>\n' +
'  <language>en</language>\n' +
'  <lastBuildDate>' + rfc822('', now) + '</lastBuildDate>\n' +
'  <atom:link href="' + esc(site.url) + '/feed.xml" rel="self" type="application/rss+xml"/>\n' +
entries +
'</channel>\n' +
'</rss>\n';
}

export function sitemap({ site, entries }) {
  const urls = entries.map(e =>
    '  <url>\n' +
    '    <loc>' + esc(site.url + e.url) + '</loc>\n' +
    (e.iso ? '    <lastmod>' + e.iso + '</lastmod>\n' : '') +
    '  </url>\n'
  ).join('');

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
urls +
'</urlset>\n';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `/opt/homebrew/bin/node --test tests/feeds.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/feeds.mjs tests/feeds.test.mjs
git commit -m "generate rss and the sitemap"
```

---

### Task 7: The build orchestrator writes `_site/`

This is the task that switches the site over. Output goes to `_site/` rather than the repo root, because generated research pages would otherwise land in `research/`, the same directory as the markdown sources, which the deploy workflow currently deletes.

**Files:**
- Modify: `scripts/build-content.mjs` (rewritten)
- Modify: `.github/workflows/deploy.yml`
- Modify: `.gitignore`
- Create: `tests/build.test.mjs`
- Delete: `index.html`, `404.html` (both now generated)

**Interfaces:**
- Consumes: everything from `scripts/lib/`.
- Produces: `build({ outDir, quiet }) -> { written: string[], counts: string[] }`

- [ ] **Step 1: Write the failing end-to-end test**

Create `tests/build.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `/opt/homebrew/bin/node --test tests/build.test.mjs`
Expected: FAIL, `build` does not accept `outDir` and writes JS data files.

- [ ] **Step 3: Rewrite the build script**

Replace the contents of `scripts/build-content.mjs`:

```js
#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, rmSync }
  from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import SITE from '../site.config.mjs';
import { readSection } from './lib/content.mjs';
import { indexPage, detailPage, notFoundPage } from './lib/templates.mjs';
import { rss, sitemap } from './lib/feeds.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const SECTIONS = [
  { dir: 'posts',    urlPrefix: 'blog',     heading: 'Writing' },
  { dir: 'research', urlPrefix: 'research', heading: 'Research' },
];

const PASSTHROUGH = ['CNAME', 'robots.txt', 'favicon.svg', '.nojekyll'];

function write(outDir, rel, contents) {
  const file = join(outDir, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
  return rel;
}

export function build({ outDir = join(ROOT, '_site'), quiet = false } = {}) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const written = [];
  const counts = [];
  const sections = [];
  const sitemapEntries = [{ url: '/', iso: '' }];
  let posts = [];

  for (const section of SECTIONS) {
    const { items, drafts } = readSection({
      dir: join(ROOT, section.dir),
      urlPrefix: section.urlPrefix,
    });
    sections.push({ heading: section.heading, items });
    if (section.urlPrefix === 'blog') posts = items;

    for (const item of items) {
      written.push(write(outDir, section.urlPrefix + '/' + item.slug + '.html',
        detailPage({ site: SITE, item })));
      sitemapEntries.push({ url: item.url, iso: item.iso });
    }
    counts.push(section.dir + ': ' + items.length + ' published, ' + drafts + ' draft');
  }

  written.push(write(outDir, 'index.html', indexPage({ site: SITE, sections })));
  written.push(write(outDir, '404.html', notFoundPage({ site: SITE })));
  written.push(write(outDir, 'feed.xml', rss({ site: SITE, items: posts })));
  written.push(write(outDir, 'sitemap.xml', sitemap({ site: SITE, entries: sitemapEntries })));

  cpSync(join(ROOT, 'assets'), join(outDir, 'assets'), { recursive: true });
  for (const name of PASSTHROUGH) {
    if (existsSync(join(ROOT, name))) cpSync(join(ROOT, name), join(outDir, name));
  }

  if (!quiet) console.log(counts.join('  |  ') + '  ->  ' + written.length + ' files');
  return { written, counts };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    build();
  } catch (e) {
    console.error('\nbuild-content failed:\n  ' + e.message + '\n');
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `/opt/homebrew/bin/node --test tests/build.test.mjs`
Expected: PASS, 3 tests.

- [ ] **Step 5: Stop tracking the now-generated pages**

```bash
git rm --cached index.html 404.html
```

Add to `.gitignore`, after the existing `assets/js/posts.js` and `assets/js/research.js` lines. The leading slashes matter: without them these patterns would also ignore any `index.html` nested anywhere in the tree.

```
_site/
/index.html
/404.html
```

- [ ] **Step 6: Point the deploy workflow at `_site`**

In `.github/workflows/deploy.yml`, delete the "Drop sources that must not be served" step entirely and change the upload path:

```yaml
      - run: node scripts/build-content.mjs
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: '_site'
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 7: Run a real build and confirm the output**

```bash
/opt/homebrew/bin/node scripts/build-content.mjs
find _site -type f | sort
```

Expected: `_site/index.html`, `_site/404.html`, `_site/feed.xml`, `_site/sitemap.xml`, `_site/CNAME`, `_site/robots.txt`, `_site/favicon.svg`, `_site/.nojekyll`, and `_site/assets/**`. No `blog/` or `research/` pages yet, because every entry is still a draft.

- [ ] **Step 8: Commit**

```bash
git add -A scripts/build-content.mjs tests/build.test.mjs .gitignore .github/workflows/deploy.yml
git commit -m "build static pages into _site and upload that instead of the repo root"
```

---

### Task 8: Install Archivo

**Files:**
- Create: `assets/fonts/Archivo-Regular.woff2`, `assets/fonts/Archivo-Italic.woff2`
- Delete: `assets/fonts/IBMPlexSans-400.woff2`, `IBMPlexSans-500.woff2`, `IBMPlexSans-700.woff2`, `Newsreader-Regular.woff2`, `Newsreader-Italic.woff2`
- Modify: `assets/fonts/OFL.txt`

- [ ] **Step 1: Fetch the stylesheet Google serves to a modern browser**

The `css2` endpoint returns different formats depending on the user agent. Without a browser user agent it returns TTF, so the user agent below is required, not decoration.

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
curl -s -A "$UA" "https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400..700;1,400..700&display=swap" > /tmp/archivo.css
grep -c "@font-face" /tmp/archivo.css
```

Expected: a count of several font faces, one per unicode subset per style.

- [ ] **Step 2: Extract the two latin faces and download them**

Each `@font-face` block is preceded by a comment naming its subset. Take the block commented `/* latin */` for each style.

```bash
awk '/\/\* latin \*\//{f=1} f{print} /}/{if(f)f=0}' /tmp/archivo.css > /tmp/archivo-latin.css
grep -E "font-style|src:" /tmp/archivo-latin.css

NORMAL=$(awk '/font-style: normal/{n=1} n&&/src:/{match($0,/https:[^)]*/); print substr($0,RSTART,RLENGTH); exit}' /tmp/archivo-latin.css)
ITALIC=$(awk '/font-style: italic/{n=1} n&&/src:/{match($0,/https:[^)]*/); print substr($0,RSTART,RLENGTH); exit}' /tmp/archivo-latin.css)
echo "$NORMAL"; echo "$ITALIC"

curl -s -o assets/fonts/Archivo-Regular.woff2 "$NORMAL"
curl -s -o assets/fonts/Archivo-Italic.woff2  "$ITALIC"
ls -l assets/fonts/Archivo-*.woff2
```

Expected: both variables print a `https://fonts.gstatic.com/...woff2` URL, and both files land non-empty at tens of kilobytes. If either variable is empty, read `/tmp/archivo-latin.css` and pull the two URLs out by hand rather than guessing.

- [ ] **Step 3: Verify they are real woff2 files**

```bash
file assets/fonts/Archivo-Regular.woff2 assets/fonts/Archivo-Italic.woff2
```

Expected: both reported as Web Open Font Format (Version 2). If either says "ASCII text", the download captured an error page rather than a font. Stop and re-check the URL.

- [ ] **Step 4: Remove the old fonts and record the licence**

```bash
git rm assets/fonts/IBMPlexSans-400.woff2 assets/fonts/IBMPlexSans-500.woff2 \
       assets/fonts/IBMPlexSans-700.woff2 assets/fonts/Newsreader-Regular.woff2 \
       assets/fonts/Newsreader-Italic.woff2
```

Replace `assets/fonts/OFL.txt` with the Archivo copy from https://github.com/Omnibus-Type/Archivo/blob/master/OFL.txt

- [ ] **Step 5: Commit**

```bash
git add assets/fonts
git commit -m "swap IBM Plex Sans and Newsreader for Archivo"
```

---

### Task 9: Rewrite the stylesheet

**Files:**
- Modify: `assets/css/style.css` (rewritten, 826 lines down to roughly 250)

- [ ] **Step 1: Replace the stylesheet**

Write `assets/css/style.css` from scratch. It must contain no `data-theme` selector, no light palette, no `.reveal`, and none of the class names belonging to deleted pages. Structure it in this order: font faces, tokens, reset, layout, index, detail, contents block, footer, narrow screens.

```css
@font-face {
  font-family: 'Archivo';
  src: url('/assets/fonts/Archivo-Regular.woff2') format('woff2');
  font-weight: 400 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Archivo';
  src: url('/assets/fonts/Archivo-Italic.woff2') format('woff2');
  font-weight: 400 700;
  font-style: italic;
  font-display: swap;
}

:root {
  --bg:      #0d0d0f;
  --body:    #eaeaea;
  --muted:   #b7b7b7;
  --line:    #26262a;
  --code-bg: #17171a;
  --sans:    'Archivo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --mono:    ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  --measure: 36rem;
  --pad:     clamp(1.25rem, 5vw, 3rem);
}

*, *::before, *::after { box-sizing: border-box; }
html { background: var(--bg); -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--body);
  font-family: var(--sans);
  font-size: 1.15rem;
  line-height: 1.8;
  padding: 0 var(--pad);
}
img { max-width: 100%; height: auto; }
[hidden] { display: none !important; }
a { color: inherit; }

.wrap { max-width: var(--measure); margin: 0 auto; padding: clamp(4rem, 10vw, 7rem) 0 5rem; }

.name { font-size: 1.5rem; font-weight: 600; letter-spacing: -0.015em; margin: 0 0 3.5rem; }

.sec { margin: 0 0 3.5rem; border-top: 1px solid var(--line); padding-top: 1.75rem; }
.sec-h { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em;
         text-transform: uppercase; color: var(--muted); margin: 0 0 1.5rem; }
.rows { list-style: none; margin: 0; padding: 0; }
.row { margin: 0 0 1.75rem; }
.row-link { display: flex; justify-content: space-between; align-items: baseline;
            gap: 1.5rem; text-decoration: none; }
.row-title { font-size: 1.15rem; font-weight: 500; line-height: 1.35;
             text-decoration: underline; text-decoration-color: var(--line);
             text-underline-offset: 0.25em; }
.row-link:hover .row-title { text-decoration-color: var(--body); }
.row-date { font-size: 0.8125rem; color: var(--muted); white-space: nowrap; flex: none; }
.row-sum { font-size: 0.9375rem; line-height: 1.6; color: var(--muted); margin: 0.4rem 0 0; }

.hdr { max-width: var(--measure); margin: 0 auto; padding: 2rem 0 0; }
.brand { font-size: 0.875rem; font-weight: 600; color: var(--muted); text-decoration: none; }
.brand:hover { color: var(--body); }

.d-head { margin: 0 0 3rem; }
.d-title { font-size: 2.125rem; font-weight: 600; line-height: 1.15;
           letter-spacing: -0.02em; margin: 0 0 0.5rem; }
.d-date { font-size: 0.8125rem; color: var(--muted); margin: 0; }
.d-sub { font-style: italic; color: var(--muted); margin: 1rem 0 0; }
.d-btns { margin: 1.25rem 0 0; display: flex; flex-wrap: wrap; gap: 1rem; }
.d-btn { font-size: 0.875rem; color: var(--muted); }

.d-body > :first-child { margin-top: 0; }
.d-h { font-size: 1.15rem; font-weight: 600; letter-spacing: -0.01em;
       margin: 2.75rem 0 1rem; scroll-margin-top: 2rem; }
.d-anchor { margin-left: 0.4em; color: var(--line); text-decoration: none; opacity: 0; }
.d-h:hover .d-anchor { opacity: 1; }
.d-quote { margin: 2rem 0; padding-left: 1.25rem; border-left: 2px solid var(--line);
           color: var(--muted); font-style: italic; }
.d-list, .d-ol { padding-left: 1.25rem; }
.d-hr { border: 0; border-top: 1px solid var(--line); margin: 3rem 0; }
.d-code { font-family: var(--mono); font-size: 0.875em; background: var(--code-bg);
          padding: 0.15em 0.35em; border-radius: 3px; }
.d-pre { background: var(--code-bg); padding: 1rem 1.25rem; border-radius: 6px;
         overflow-x: auto; font-size: 0.875rem; line-height: 1.6; }
.d-pre code { font-family: var(--mono); }
.d-fig { margin: 2.5rem 0; }
.d-fig figcaption { font-size: 0.8125rem; color: var(--muted); margin-top: 0.6rem; }
.d-top { margin: 4rem 0 0; font-size: 0.875rem; }
.link { color: var(--muted); }
.link:hover { color: var(--body); }

.toc { margin: 0 0 2.5rem; border-left: 2px solid var(--line); padding-left: 1rem; }
.toc-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.toc-h { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.1em;
         text-transform: uppercase; color: var(--muted); }
.toc-close { background: none; border: 0; color: var(--muted); cursor: pointer;
             font-size: 1.1rem; line-height: 1; padding: 0.25rem; }
.toc-close:hover { color: var(--body); }
.toc-list { list-style: none; margin: 0.75rem 0 0; padding: 0;
            font-size: 0.875rem; line-height: 1.5; }
.toc-list li { margin: 0 0 0.5rem; }
.toc-link { color: var(--muted); text-decoration: none; }
.toc-link:hover, .toc-link.is-current { color: var(--body); }
.toc-tab { position: fixed; left: 1rem; top: 40vh; background: none; border: 0;
           color: var(--muted); cursor: pointer; font-family: var(--sans);
           font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.1em;
           text-transform: uppercase; writing-mode: vertical-rl; padding: 0.5rem; }
.toc-tab:hover { color: var(--body); }

.ftr { max-width: var(--measure); margin: 0 auto; padding: 2.5rem 0 4rem;
       border-top: 1px solid var(--line); font-size: 0.8125rem; color: var(--muted); }
.ftr-dot { margin: 0 0.5rem; }
.ftr-link { color: var(--muted); }
.ftr-link:hover { color: var(--body); }

.nf-h { font-size: 1.5rem; font-weight: 600; margin: 0 0 0.75rem; }
.nf-p { color: var(--muted); margin: 0; }

@media (min-width: 1100px) {
  .has-toc .toc {
    position: fixed;
    left: max(1.5rem, calc(50vw - 36rem));
    top: 8rem;
    width: 12rem;
    margin: 0;
    max-height: 70vh;
    overflow-y: auto;
  }
  .has-toc .toc-tab { left: max(1.5rem, calc(50vw - 36rem)); }
}

@media (max-width: 480px) {
  .row-link { flex-direction: column; gap: 0.2rem; }
  .row-date { order: -1; }
}
```

- [ ] **Step 2: Verify no forbidden selectors survive**

```bash
grep -nE "data-theme|data-reading|\.reveal|contact-|about-|entry-|d-cover|featured|theme-toggle|Newsreader|IBMPlex" assets/css/style.css
```

Expected: no output at all. Any hit is a leftover from the old design.

- [ ] **Step 3: Rebuild and check the stylesheet reaches the output**

```bash
/opt/homebrew/bin/node scripts/build-content.mjs && grep -c . _site/assets/css/style.css
```

Expected: a line count in the low hundreds.

- [ ] **Step 4: Commit**

```bash
git add assets/css/style.css
git commit -m "rewrite the stylesheet dark-only in Archivo"
```

---

### Task 10: The contents block behaviour

The only client-side script. The page must be complete without it.

**Files:**
- Create: `assets/js/contents.js`

- [ ] **Step 1: Write the script**

Create `assets/js/contents.js`:

```js
(function () {
  'use strict';

  var toc = document.getElementById('toc');
  var tab = document.getElementById('toc-tab');
  if (!toc || !tab) return;

  var KEY = 'kjw-toc-closed';
  var close = toc.querySelector('.toc-close');

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function store(v) {
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
  }
  function apply(closed) {
    toc.hidden = closed;
    tab.hidden = !closed;
    if (close) close.setAttribute('aria-expanded', String(!closed));
  }

  // The spec wants it collapsed by default on narrow screens, where there is no
  // margin for it to sit in. It ships open in the markup so a reader without
  // JavaScript still gets it; this is the only thing that closes it unasked.
  var narrow = window.matchMedia && window.matchMedia('(max-width: 1099px)').matches;
  var saved = stored();
  apply(saved === null ? Boolean(narrow) : saved === '1');

  if (close) close.addEventListener('click', function () { store(true); apply(true); });
  tab.addEventListener('click', function () { store(false); apply(false); });

  var links = Array.prototype.slice.call(toc.querySelectorAll('.toc-link'));
  var targets = links
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  if (!targets.length || !('IntersectionObserver' in window)) return;

  var seen = new Set();
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) seen.add(e.target.id); else seen.delete(e.target.id);
    });
    var first = targets.find(function (t) { return seen.has(t.id); });
    links.forEach(function (a) {
      a.classList.toggle('is-current', Boolean(first) && a.getAttribute('href') === '#' + first.id);
    });
  }, { rootMargin: '-10% 0px -70% 0px' });

  targets.forEach(function (t) { observer.observe(t); });
})();
```

- [ ] **Step 2: Verify the page still works without it**

Temporarily un-draft one post with three or more `##` headings, rebuild, and confirm the contents block is present and visible in the generated HTML before any JavaScript runs:

```bash
/opt/homebrew/bin/node scripts/build-content.mjs
grep -c 'class="toc"' _site/blog/*.html
grep -c 'hidden' _site/blog/*.html
```

Expected: the `toc` nav is present, and the only `hidden` attribute in the output is on `toc-tab`. The `toc` itself must not be hidden in the markup, because a reader without JavaScript has to see it.

- [ ] **Step 3: Commit**

```bash
git add assets/js/contents.js
git commit -m "add the closable contents block behaviour"
```

---

### Task 11: Dev server, deletions and documentation

**Files:**
- Modify: `scripts/serve.mjs`
- Modify: `scripts/WRITING.md`
- Delete: `assets/js/app.js`, `assets/js/content.js`, `assets/img/`

- [ ] **Step 1: Point the dev server at `_site`**

Rewrite the request handler in `scripts/serve.mjs`. It serves from `_site`, resolves an extensionless path to `<path>.html` the way GitHub Pages does, and falls back to `404.html` with a real 404 status. Delete the SPA fallback that returned `index.html` for unknown paths.

```js
const OUT = join(ROOT, '_site');

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
  console.log('preview: http://localhost:' + PORT);
});
```

The watcher must also watch `assets/` and `site.config.mjs`, not just the markdown directories, since those now feed the build too.

- [ ] **Step 2: Check the server serves extensionless paths**

```bash
/opt/homebrew/bin/node scripts/serve.mjs &
sleep 1
curl -s -o /dev/null -w "root %{http_code}\n" http://localhost:4000/
curl -s -o /dev/null -w "missing %{http_code}\n" http://localhost:4000/nope
kill %1
```

Expected: `root 200`, `missing 404`.

- [ ] **Step 3: Delete what the redesign replaced**

```bash
git rm assets/js/app.js assets/js/content.js
git rm -r assets/img
```

- [ ] **Step 4: Rebuild and confirm nothing references the deleted files**

```bash
/opt/homebrew/bin/node scripts/build-content.mjs
grep -rn "app\.js\|content\.js\|assets/img" _site/ || echo "clean"
```

Expected: `clean`.

- [ ] **Step 5: Update the writing documentation**

Three edits to `scripts/WRITING.md`. Keep the Obsidian setup section exactly as it is.

Replace the paragraph beginning "Nothing in `assets/js/` is written by hand" with:

```
Nothing in `_site/` is written by hand. `scripts/build-content.mjs` reads
`posts/*.md` and `research/*.md` and writes the whole site into `_site/`, which
is gitignored and rebuilt on every deploy.
```

Replace the front matter table with this one, which drops `tag`, `image` and `featured`:

```
| Field | Notes |
|---|---|
| `title` | Required. Quote it if it contains a colon. |
| `date` | `2026-08-14`, `2026-08` or `2026`. Displayed as written out, sorted newest first. |
| `summary` | One line. Shows on the index under the title, and as the italic subtitle on the page. |
| `slug` | Optional. Defaults to the filename. |
| `draft` | `true` keeps it off the site entirely. |
| `links` | List of `Label \| https://url`, one per line. Shown under the subtitle. |
```

Replace the Publishing section with:

```
Commit the `.md` file and push. The deploy workflow runs the build, which writes
`_site/`, and uploads only that directory. The markdown sources are never copied
into it, so drafts and unpublished writing are never served.
```

- [ ] **Step 6: Run the whole test suite**

Run: `/opt/homebrew/bin/node --test tests/`
Expected: PASS, all tests across all five files.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "serve _site in development, delete the SPA and the unused art"
```

---

### Task 12: Verification against the spec

No new code. Run the spec's checklist and record the results.

- [ ] **Step 1: Clean build from a clean tree**

```bash
rm -rf _site && /opt/homebrew/bin/node scripts/build-content.mjs
```

Expected: exits 0, reports `posts: 0 published, 1 draft  |  research: 0 published, 3 draft`.

- [ ] **Step 2: The all-drafts index is the name and the footer**

```bash
grep -c 'class="sec-h"' _site/index.html
grep -o 'Kamai Jackson-Wade' _site/index.html | head -1
```

Expected: `0` section headings, and the name present.

- [ ] **Step 3: A published post produces a real file with working anchors**

Temporarily set `draft: false` in `posts/mediocrity.md`, add three `##` headings to it, rebuild, then:

```bash
ls _site/blog/
grep -o 'id="[a-z0-9-]*"' _site/blog/mediocrity.html
```

Expected: `mediocrity.html` exists, and every `##` heading has a unique id. Revert the file afterwards.

- [ ] **Step 4: The feed parses as XML**

```bash
xmllint --noout _site/feed.xml && echo "feed ok"
xmllint --noout _site/sitemap.xml && echo "sitemap ok"
```

Expected: both `ok`. If `xmllint` is missing, use `python3 -c "import xml.dom.minidom,sys; xml.dom.minidom.parse('_site/feed.xml')"`.

- [ ] **Step 5: No trace of the old site in the output**

```bash
grep -rn "data-theme\|app\.js\|posts\.js\|research\.js\|assets/img\|spa_redirect\|Newsreader\|IBMPlex" _site/ || echo "clean"
```

Expected: `clean`.

- [ ] **Step 6: Look at it**

```bash
/opt/homebrew/bin/node scripts/serve.mjs
```

Open http://localhost:4000 and read a post. Confirm: dark ground, Archivo, the contents block sits in the margin above 1100px wide, the close button collapses it to a tab, the tab restores it, and the state survives a reload. Narrow the window below 1100px and confirm the block moves inline above the body.

- [ ] **Step 7: Commit the verification**

```bash
git add -A
git commit -m "verify the redesign against the spec checklist"
```
