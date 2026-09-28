#!/usr/bin/env node
import { writeFileSync, existsSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import SITE from '../site.config.mjs';
import { readSection } from './lib/content.mjs';
import { indexPage, detailPage, notFoundPage, libraryPage } from './lib/templates.mjs';
import { rss, sitemap } from './lib/feeds.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const SECTIONS = [
  { dir: 'posts',    urlPrefix: 'blog',     heading: 'Writing', library: true, homeLimit: 3 },
  { dir: 'research', urlPrefix: 'research', heading: 'Research' },
];

const PASSTHROUGH = ['CNAME', 'robots.txt', 'favicon.svg', 'favicon.ico', '.nojekyll'];

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
    const url = section.library ? '/' + section.urlPrefix : '';
    sections.push({ heading: section.heading, url, limit: section.homeLimit || 0, items });
    if (url) {
      written.push(write(outDir, section.urlPrefix + '/index.html',
        libraryPage({ site: SITE, heading: section.heading, url, items })));
      sitemapEntries.push({ url, iso: '' });
    }
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
