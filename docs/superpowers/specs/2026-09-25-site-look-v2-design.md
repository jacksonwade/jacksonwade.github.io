# kamai.uk, second look

Date: 2026-09-25
Status: awaiting review
Supersedes the presentation half of `2026-09-25-site-redesign-design.md`

## Why there is a second spec

The first spec was executed faithfully and produced a site Kamai found bland. The fault was in the
brief, not the build: it was written from two references (stripe.dev, darioamodei.com) without ever
asking what the site was for. A bare index of titles is a famous person's design, and it asks a
stranger to care with no reason given.

The architecture from the first spec is sound and survives untouched. Only the presentation changes.

## Intent

Someone is evaluating Kamai and he wants to be taken very seriously. The mechanism is that they read
a piece of his writing and come away with a view of how he thinks. The writing does all the
persuading.

Three audiences, none traded away: a quant PM skimming in ninety seconds, an academic looking for
substance, a stranger who followed a link. The writing is a deliberate mix of personal, technical
and argumentative.

Nothing on the site says who he is. No bio, no institution (Warwick Physics), no research group
(Tausen Research), no credentials. This was decided twice, deliberately, with the cost stated: a
stranger cannot place him, so the prose carries the entire burden of credibility.

## What does not change

Everything in the first spec's "Build pipeline" section stands: the static build into `_site/`, the
flat `.html` files giving extensionless URLs, `/blog/<slug>` and `/research/<slug>`, the markdown
subset, the front matter fields, RSS, the sitemap, the passthrough files, the deploy workflow. The
47 tests covering `frontmatter`, `content`, `markdown`, `feeds` and `build` are unaffected.

What changes is `assets/css/style.css`, `assets/fonts/`, the two page templates in
`scripts/lib/templates.mjs`, and the template tests.

## Tokens

```
--bg       #12100e   warm near-black
--body     #ede8e0   warm off-white
--muted    #9a9188   dates, summaries, the ending
--line     #2b241d   bullets, the blockquote rule
--accent   #cc785c   clay. Hover only, plus links inside prose
--code-bg  #1a1613
```

Every colour is pushed warm in the same direction. Neutral grey on neutral black is the default that
reads as no decision at all, and avoiding it is most of what stops the page looking generic.

Contrast against `--bg`: body 15.6:1, muted 6.1:1, accent 5.8:1. All above 4.5:1.

## Typeface

Newsreader, variable, with the optical size axis. Self-hosted, two files, latin subset:

```
assets/fonts/Newsreader-Roman.woff2     opsz 6..72, wght 400..600
assets/fonts/Newsreader-Italic.woff2    opsz 6..72, wght 400..600
```

The italic face is required: `inlineLinks` renders `*emphasis*` as `<em>`.

Optical sizing is the point of choosing this face. `font-optical-sizing: auto` on `body`, with
`font-variation-settings: 'opsz' 60` set explicitly on display-sized text. This is what
darioamodei.com does (verified from its stylesheet: "Newsreader 24 Pt" for text, "Newsreader
Display" at 60pt for headings).

Fetch with the `opsz` axis in the range, not a pinned instance.

## Texture

A fixed grain layer over the whole viewport:

```css
body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 2;
  opacity: 0.14;
  mix-blend-mode: soft-light;
  background-image: url("…feTurbulence fractalNoise baseFrequency='0.65' numOctaves='4'…");
}
```

An inline 260x260 SVG, a few hundred bytes, no request. `soft-light` rather than `normal` is
load-bearing: at 0.14 a normal blend would wash the black out, where soft-light modulates and the
ground stays black.

`position: fixed` so it does not scroll with the content, which is what makes it read as grain on the
surface rather than a pattern printed on the page.

## The front page

```
Kamai Jackson-Wade

Writing
  • On My Mediocrity Being My Only Motivator   2026

Research
  • Going Critical: …                          2026
    the summary, muted, underneath
  • Tails You Lose: …                          2026
    the summary, muted, underneath

  kamai@kamai.uk
  GitHub
```

| Element | Value |
|---|---|
| Page | `max-width: 42rem`, centred, `padding: clamp(3rem, 7vw, 5rem) 0 6rem` |
| Body | 1.2rem, line-height 1.7 |
| Name | 2.125rem, weight 600, `opsz 60`, tracking -0.005em, 3.5rem below |
| Section heading | 1.5rem, weight 600, `opsz 40`, 1.1rem below |
| List item | `max-width: 36rem`, 1.35rem apart, 1.15rem left padding |
| Bullet | `•` via `::before` in `--line` |
| Title | inherits body size. Hover turns it `--accent` |
| Date | 0.9375rem, `--muted`, inline after the title, `white-space: nowrap` |
| Summary | 1.0625rem, line-height 1.6, `--muted`, on its own line |
| Ending | 1.0625rem, line-height 2.1, one link per line, no rule above |

Sections render only when they have a published entry, as in the first spec. `posts/` is headed
"Writing" (not "Blog") while its URLs stay `/blog/<slug>`; that mismatch is deliberate.

## The reading page

| Element | Value |
|---|---|
| Measure | 48rem (about 76 characters a line, knowingly just past the comfortable band) |
| Body | 1.35rem, line-height 1.7 |
| Name at top | 2.25rem, weight 600, `opsz 60`, `--body` colour, hover `--accent` |
| Title | 5rem, weight 600, `opsz 60`, line-height 1.04, tracking -0.012em |
| Date | 1rem, `--muted`, 3rem below |
| `h2` | 1.625rem, weight 600, `margin: 1.5rem 0 1rem` |
| Blockquote | upright, `--muted`, 1px left rule in `--line`, no italic |
| List | same bullet treatment as the front page |
| Inline code | `--code-bg`, 0.85em |
| Link in prose | `--accent`, hover `--body`. The only link marked at rest anywhere on the site |
| Ending | name, email, GitHub, one per line. The name is the way home |

## Rules that hold everywhere

- **No italics.** Not on dates, not on blockquotes, not on metadata. Italic metadata is a
  generated-design tell. The italic face exists only for `<em>` inside prose.
- **No underlines.** Links are plain at rest and turn clay on hover, except inside a paragraph.
- **No tracked uppercase.** No `text-transform: uppercase` with positive `letter-spacing` anywhere.
- **Nothing drawn** except the blockquote's left rule and the bullets.

## JavaScript

None. The contents block was specced in the first brief, built, and is now dropped: every other
piece of furniture (the rail, the bars, the lead frame, the grid) was rejected and this would have
gone the same way. `assets/js/contents.js` is deleted and `page()` loses its `script` parameter.

The site ships zero JavaScript.

## Deletions

| Path | Reason |
|---|---|
| `assets/fonts/Archivo-*.woff2` | Replaced by Newsreader |
| `assets/js/contents.js` | No contents block |
| `contentsBlock()` in `templates.mjs` | Same |
| The `script` parameter on `page()` | Nothing to load |
| The whole of `assets/css/style.css` | Rewritten |

## Out of scope

**Maths, tables and diagrams.** Technical writing is in scope for the site, and none of these render.
Adding LaTeX means a library, a stylesheet and font files, which would be this site's first real
dependency. Deferred until there is writing that needs it.

## Open

`h2` on the reading page is currently `opsz 60`. That came from an over-broad find-and-replace of
mine, not a decision. 40 is the value consistent with the front page's section headings and with the
face's intent at that size. Kamai approved the page as it rendered at 60. Resolve before building:
either confirm 60 deliberately or set it to 40.

## Verification

1. `node --test tests/` passes. Template tests are rewritten against the new markup; the other four
   files are untouched and must stay green.
2. A clean build emits an index with the name, the sections and the ending, and no JavaScript.
3. `grep -rE "text-transform|font-style: italic|text-decoration: underline" assets/css/style.css`
   returns only the `<em>` rule.
4. `grep -rn "contents.js\|Archivo" _site/` returns nothing.
5. Both fonts report as WOFF2 and carry an `fvar` table with an `opsz` axis.
6. Contrast holds: body, muted and accent all above 4.5:1 on `--bg`.
7. The rendered pages match `final-index.html` and `final-read.html` in the plan workspace.
