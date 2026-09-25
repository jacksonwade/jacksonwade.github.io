# kamai.uk redesign

Date: 2026-09-25
Status: awaiting review

## Intent

Kamai does not like how the site currently looks and wants it simplified, with
writing given a better home. Two reference sites were named: stripe.dev for how
a list of posts is presented, and darioamodei.com for the front page shape and
the reading experience on a single post.

Both references resolve to the same underlying form, and it is close to the
opposite of the current site: a plain vertical index of things written, title and
date per row, no thumbnails, no cards, no decorative images, narrow measure, and
a contents block on long pieces with anchored headings.

Success means: the front page is an index of Kamai's writing and nothing else,
a post reads well over thousands of words, every URL is a real file, and there
is materially less code than there is today.

## Settled decisions

All of these were chosen by Kamai during brainstorming on 2026-09-25.

| Decision | Choice |
|---|---|
| Front page | The index of the writing, not a landing page |
| Text under the name | None. Name, then the lists |
| Draft research | Stays hidden until finished. No placeholder, no "in progress" state |
| Empty sections | Do not render at all. No heading, no "Nothing yet." |
| Page generation | Static HTML written at build time. No client-side router |
| URL shape | `/blog/on-mediocrity`, no trailing slash, no `.html` |
| Palette | Dark only. No toggle, no light palette, no system following |
| Header | Name only. No nav links |
| In-post navigation | Sticky contents block in the left margin, closable |
| Maths | Not supported. No KaTeX, no MathJax |
| RSS | Yes, a generated `feed.xml` |
| Summaries on the index | Kept, shown under the title |
| Typeface | Archivo throughout, at 18px with 1.8 line height and a 36rem measure |

### Why flat `.html` files rather than `dir/index.html`

Kamai asked for `/blog/name` in the address bar, not `/blog/name/`. Tested
against the live site on 2026-09-25:

```
/404                      status=200  redirects=0
/404.html                 status=200
/definitely-not-a-page    status=404
```

GitHub Pages serves `foo.html` at `/foo` with no redirect, while a genuinely
missing path 404s. So `blog/on-mediocrity.html` is served at
`/blog/on-mediocrity` exactly as asked. A `dir/index.html` layout would have
forced a trailing slash.

## Out of scope

- Rewriting how posts are authored. The markdown format, the front matter fields
  and the Obsidian workflow in `scripts/WRITING.md` stay as they are.
- Any change to DNS, the custom domain, or the GitHub Pages configuration.
- Writing content. No new posts, no rewriting of Kamai's prose, no invented
  self-description.
- Un-drafting the existing entries. That is Kamai's call, separately.

## Site structure

Three kinds of page:

```
/                       the index
/blog/<slug>         one essay,    generated from posts/<file>.md
/research/<slug>        one entry,    generated from research/<file>.md
/404.html               a real not-found page
```

Everything else is removed: `/about`, `/contact`, `/blog`, and `/research` as a
list page. A post page links back to the index through the name in its top left.

`404.html` becomes an ordinary page saying the thing is not there, with a link
home. The sessionStorage redirect it currently performs is deleted along with the
matching restore script in `index.html`.

## Build pipeline

`scripts/build-content.mjs` stops emitting JavaScript data files and starts
emitting finished HTML.

```
posts/*.md      ┐
research/*.md   ├→  build-content.mjs  →  index.html
site config     ┘                         blog/<slug>.html
                                          research/<slug>.html
                                          feed.xml
                                          sitemap.xml
```

What is reused from the existing script, unchanged in behaviour:

- `splitFrontMatter`, `parseFrontMatter`, `scalar`: the front matter reader.
- `slugify`, `assetPath`, `parseLinks`.
- `formatDate`: dates keep rendering as `18 September 2026`, `September 2026` or
  `2026` depending on how they are written.
- `readSection`: the draft skipping, duplicate-slug detection and sorting.
- The failure mode: a malformed entry still fails the build with filename and
  line number.

What changes in that script:

- `normalizeBody` needs no change. It already maps wikilinks in `posts/` to
  `/blog/<slug>`, which is the URL prefix being kept.
- The markdown-to-HTML renderer must move into the build. It does not live here
  today: `parseBody` and `blockMarkup` in `assets/js/app.js` (lines 266 to 338)
  do that work at runtime in the browser. Port them, do not rewrite them. The
  supported subset stays exactly as `scripts/WRITING.md` documents it:
  paragraphs, `##` headings, `>` quotes, `-` bullets, `1.` numbered lists, `---`
  rules, `**bold**`, `*italic*`, `` `code` ``, fenced code blocks, images with
  captions, and `[label](url)` links.
- Heading rendering gains an `id`, derived with the existing `slugify`, and a
  collision suffix if two headings in one post slugify the same.
- New: an HTML page writer, a contents-block builder, a feed writer and a
  sitemap writer.

Generated output is gitignored. The Actions workflow already runs the build
before uploading, so nothing about deployment changes.

`assets/js/content.js` is currently loaded by the browser and holds a large
config object. Most of it describes pages that no longer exist (`hero`, `blurb`,
`news`, `about`, `aboutImage`, `contactImage`, `researchIntro`). It shrinks to
the values still used, which are the name, the email and the GitHub URL, and it
is read by the build rather than served to the browser.

## The index

```
Kamai Jackson-Wade

─────────────────────────────────────────────────
Writing

  On My Mediocrity Being My Only Motivator    18 September 2026
  the summary line, in muted grey

  Some Second Essay                                 July 2026
  its summary line

─────────────────────────────────────────────────
Research

  Titan                                                  2026
  its summary line

              kamaijacksonwade [at] gmail.com · GitHub
```

- The name is a heading, not a link, since the index is already home.
- A section renders only if it has at least one published entry. With every
  entry currently `draft: true`, the index today is the name and the footer.
- `posts/` renders under the heading "Writing", `research/` under "Research".
  The heading says Writing while the URL prefix stays `/blog/`. That mismatch is
  deliberate, chosen by Kamai on 2026-09-25, and is not to be tidied up.
- Each row is one link covering title and date. Title left, date right, on one
  line on desktop, stacked on a phone. The summary sits underneath in the muted
  colour and is not part of the link target.
- Ordering is whatever `readSection` already produces.
- The footer is one line: the email as plain text (not a `mailto:`, matching the
  current anti-scraping choice) and a GitHub link.

## A post page

```
Kamai Jackson-Wade                                    links home

           On My Mediocrity Being My Only Motivator
           18 September 2026
           the summary, as an italic subtitle

┌──────────┐
│ Contents×│   Body text, Archivo 18px, 1.8, 36rem measure
│          │
│ • Why it │   ## headings carry ids, so
│   starts │   /blog/on-mediocrity#what-it-costs works
│   What it│
│   costs  │
└──────────┘
                            Back to top
```

Research entries use the same template. Where an entry has `links` in its front
matter, they render as a small row of links under the subtitle.

The post footer carries the same one-line email and GitHub pair as the index,
with "Back to top" above it.

### The contents block

- Built into the HTML at build time, not assembled in the browser.
- Renders only when a post has three or more `##` headings.
- On viewports at least 1100px wide it sits in the left margin and is sticky,
  highlighting the section currently in view.
- Below 1100px there is no margin to occupy, so it becomes a collapsed block
  under the subtitle that expands on tap.
- Closable, as Kamai asked. An `×` collapses it to a small "Contents" tab in the
  same position; clicking the tab restores it. The closed state persists in
  `localStorage` so it stays closed while moving between posts.
- Every `##` heading also gets an anchor link revealed on hover, so a section URL
  can be copied without using the contents block.

### JavaScript

The contents block is the only JavaScript on the site, and it is progressive
enhancement, not a dependency. Budget roughly 40 lines for: close and restore,
persistence, and the scroll-position highlight.

With JavaScript disabled the page must render with the contents block open and
static, all links working, and nothing else different. This is a hard
requirement, not an aspiration: it is the entire reason for moving off the SPA.

## Type and colour

Archivo, from Google Fonts under the SIL OFL, self-hosted as woff2 in
`assets/fonts` exactly as the current fonts are. Weights to ship: 400, 600, and
400 italic.

| Role | Setting |
|---|---|
| Body | Archivo 400, 1.15rem, line height 1.8, measure 36rem |
| Post title | Archivo 600, 2.125rem, line height 1.15, tracking -0.02em |
| Section heading in a post | Archivo 600, 1.15rem |
| Name, dates, labels, contents | Archivo, smaller sizes, muted colour |

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0d0d0f` | page ground |
| `--body` | `#eaeaea` | body text |
| `--muted` | `#b7b7b7` | dates, summaries, footer |
| `--line` | `#26262a` | rules and section dividers |
| `--code-bg` | `#17171a` | code blocks |

The light palette, the `data-theme` attribute, the `data-reading` state, the
stored reading preference and the toggle button are all removed. `<meta
name="color-scheme">` becomes `dark`, and the anti-flash inline style paints
`#0d0d0f` rather than white.

`assets/css/style.css` should land near 250 lines, down from 826. Around 60 of
the current 90 class names describe pages that no longer exist and go with them:
`contact-split`, `contact-art`, `contact-panel`, `contact-links`, `about-split`,
`about-art`, `entry-media`, `d-cover`, `featured`, `reveal`, and the rest of that
group.

## Page head

The current `index.html` carries metadata that must survive being generated, not
quietly disappear:

- `<title>`: the name alone on the index, and `<post title> :: Kamai
  Jackson-Wade` on a detail page, matching the pattern `app.js` uses today.
- `<meta name="description">`: the summary on a detail page, and a fixed line on
  the index.
- Canonical link, per page, at the real URL.
- Open Graph `type`, `url`, `title` and `description`, per page.
- The `schema.org` `Person` JSON-LD block stays, on the index only.
- `<meta name="color-scheme" content="dark">`.
- The font preloads, pointing at the Archivo files rather than the current ones.

## Content model

Front matter fields, and what happens to each:

| Field | Outcome |
|---|---|
| `title` | Kept. Still required |
| `date` | Kept. Same formatting rules |
| `summary` | Kept. Shown on the index and as the post subtitle |
| `slug` | Kept |
| `draft` | Kept. Still hides an entry entirely |
| `links` | Kept. Renders under the subtitle on a detail page |
| `tag` | No longer displayed. Sections already separate writing from research |
| `image` | No longer displayed. Index rows have no thumbnails. Images inside a post body still work |
| `featured` | Dropped. Ordering is newest first, full stop |

Parsing `tag`, `image` and `featured` should simply stop, and `scripts/WRITING.md`
must be updated to match so the documentation does not describe fields that do
nothing.

## Feeds

- `feed.xml`: RSS 2.0, the published `posts/` entries, newest first, with title,
  link, publication date and the summary as the description. Linked from the
  index with `<link rel="alternate">`.
- `sitemap.xml`: generated rather than hand-maintained, listing the index and
  every published page.

## Deletions

| Path | Reason |
|---|---|
| `assets/js/app.js` | 551 lines. The runtime router and renderer, replaced by the build |
| `assets/js/posts.js`, `assets/js/research.js` | Generated data files, no longer a thing |
| `assets/img/` | 29 files, 7.5MB. 25 are already referenced by nothing; the other four are the About page image and three thumbnails on draft research entries, and both of those uses are being cut |
| The `spa_redirect` script in `index.html` and `404.html` | No router to feed |

## Verification

The work is done when all of these hold, each checked by running something
rather than by inspection:

1. `node scripts/build-content.mjs` succeeds from a clean tree.
2. With all four entries still `draft: true`, the generated index contains the
   name and the footer and no section headings.
3. With an entry un-drafted temporarily, `/blog/<slug>` is a real file, and
   requesting the extensionless path on the deployed site returns 200 with no
   redirect.
4. A post with three or more `##` headings emits a contents block; one with
   fewer does not.
5. Every `##` heading in generated output has a unique `id`, and a
   `#some-heading` URL scrolls to it.
6. With JavaScript disabled, a post page renders fully, the contents block is
   visible and open, and every link works.
7. `feed.xml` parses as valid RSS.
8. No generated page references `assets/img/`, `app.js`, `posts.js`,
   `research.js`, or any `data-theme` attribute.
9. The deployed site still strips `posts/`, `research/` and `scripts/` before
   upload, so markdown sources and drafts are never served.

## Judgement calls to confirm

These were decided by inference rather than by an explicit answer, and are the
most likely things to want changing at review:

1. **Summaries on the index.** Kamai wrote "Summary is fine", read as keeping
   them. Worth noting the three research summaries currently run to three
   sentences each, which will dominate an index row. If that reads badly the
   alternative is title and date only, which is what both reference sites do.
2. **Dropping `tag`, `image` and `featured`.** Nothing asked for these to go.
   They are being removed because the pages that displayed them are gone.
3. **Deleting `assets/img/` entirely.** 7.5MB of art that nothing will reference
   after this change. Recoverable from git history if wanted later.
4. **Research entries keep their own URL prefix** (`/research/<slug>` rather
   than folding everything under `/blog/`), so the two kinds stay separable.
