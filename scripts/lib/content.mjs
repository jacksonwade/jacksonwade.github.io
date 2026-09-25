import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fail, splitFrontMatter, parseFrontMatter } from './frontmatter.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

export function assetPath(p) {
  let t = String(p).trim();
  if (/^(https?:|data:|\/)/i.test(t)) return t;
  t = t.replace(/^(\.\.?\/)+/, '');
  return t.startsWith('assets/') ? '/' + t : '/assets/img/' + t;
}

export function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeBody(body, urlPrefix) {
  return body
    .replace(/!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
      (m, target, cap) => '![' + (cap || '').trim() + '](' + assetPath(target) + ')')
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
      (m, target, label) => '[' + (label || target).trim() + '](/' + urlPrefix + '/' + slugify(target) + ')')
    .replace(/(!\[[^\]]*\]\()([^)]+)(\))/g,
      (m, open, path, close) => open + assetPath(path) + close);
}

export function parseLinks(raw) {
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return arr.map(entry => {
    const s = String(entry);
    const bar = s.lastIndexOf('|');
    if (bar === -1) return { label: 'View', url: s.trim() };
    return { label: s.slice(0, bar).trim() || 'View', url: s.slice(bar + 1).trim() };
  }).filter(l => l.url);
}

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
