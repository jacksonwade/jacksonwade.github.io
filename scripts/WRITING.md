# Writing posts and research

Both sections are markdown files, one file per entry, same format:

    posts/on-mediocrity.md      ->  kamai.uk/blog/on-mediocrity
    research/titan.md           ->  kamai.uk/research/titan

Nothing in `_site/` is written by hand. `scripts/build-content.mjs` reads
`posts/*.md` and `research/*.md` and writes the whole site into `_site/`, which
is gitignored and rebuilt on every deploy.

## Obsidian, one-time setup

1. Open Obsidian, "Open folder as vault", pick this repo.
2. Settings, Files and links, "Default location for new attachments", choose
   "In the folder specified below", and set it to `assets/img`. Dragging an
   image into a note then puts the file where the site expects it.
3. Settings, Files and links, "Use [[Wikilinks]]" can be either way. Both forms
   work; the build translates Obsidian's form to the site's.

The Properties panel at the top of a note edits the front matter as form
fields rather than raw text. That is the point of using Obsidian here.

## Front matter

| Field | Notes |
|---|---|
| `title` | Required. Quote it if it contains a colon. |
| `date` | `2026-08-14`, `2026-08` or `2026`. Displayed as written out, sorted newest first. |
| `summary` | One line. Shows on the index under the title, and as the italic subtitle on the page. |
| `slug` | Optional. Defaults to the filename. |
| `draft` | `true` keeps it off the site entirely. |
| `links` | List of `Label \| https://url`, one per line. Shown under the subtitle. |

Research and posts use the same field names.

## What renders

Paragraphs, `##` headings, `>` quotes, `-` bullets, `1.` numbered lists, `---`
rules, `**bold**`, `*italic*`, `` `code` ``, ``` fenced code blocks, images with
captions, and `[label](url)` links.

Not supported: LaTeX math, tables, footnotes.

## Commands

    node scripts/serve.mjs

Builds, watches `posts/`, `research/` and `assets/`, and serves `_site/` on
http://localhost:4000. Save in Obsidian, reload the browser.

Restart the server, do not just reload, after editing anything under `scripts/`
or `site.config.mjs`. Node caches those modules when the server starts, so a
running server keeps rebuilding with the old code and silently overwrites a
correct build with a stale one.

    node scripts/build-content.mjs

Build only. A malformed entry fails here with the filename and line number.

## Publishing

Commit the `.md` file and push. The deploy workflow runs the build, which writes
`_site/`, and uploads only that directory. The markdown sources are never copied
into it, so drafts and unpublished writing are never served.
