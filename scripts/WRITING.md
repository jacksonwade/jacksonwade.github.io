# Writing posts and research

Both sections are markdown files, one file per entry, same format:

    posts/on-mediocrity.md      ->  kamai.uk/blog/on-mediocrity
    research/titan.md           ->  kamai.uk/research/titan

Nothing in `assets/js/` is written by hand. `scripts/build-content.mjs` reads
`posts/*.md` and `research/*.md` and generates `assets/js/posts.js` and
`assets/js/research.js`.

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
| `tag` | Short label, shown next to the title. `Essay`, `ML`, `Q-Fin`. |
| `summary` | One line. Shows on the list page and as the italic subtitle. |
| `slug` | Optional. Defaults to the filename. |
| `image` | Thumbnail on the list page. A bare filename means `assets/img/`. |
| `draft` | `true` keeps it off the site entirely. |
| `featured` | A number. Featured entries lead the page, lowest number first, ahead of the date order. Leave it blank for normal newest-first placement. |
| `links` | List of `Label \| https://url`, one per line. Becomes buttons. |

Research and posts use the same field names. The renderer calls them
`category`/`year`/`desc` internally; you never have to.

## What renders

Paragraphs, `##` headings, `>` quotes, `-` bullets, `1.` numbered lists, `---`
rules, `**bold**`, `*italic*`, `` `code` ``, ``` fenced code blocks, images with
captions, and `[label](url)` links.

Not supported: LaTeX math, tables, footnotes.

## Commands

    node scripts/serve.mjs

Builds, watches `posts/` and `research/`, and serves on http://localhost:4000
with the routing fallback the SPA needs. Save in Obsidian, reload the browser.

    node scripts/build-content.mjs

Build only. A malformed entry fails here with the filename and line number.

## Publishing

Commit the `.md` file and push. The deploy workflow runs the build itself, then
deletes `posts/`, `research/` and `scripts/` before uploading, so the markdown
sources and any drafts are never served. The two generated files are gitignored;
Actions regenerates them every deploy.
