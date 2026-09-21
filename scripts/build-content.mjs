#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'js');

export const SECTIONS = [
  { dir: 'posts',    key: 'posts',    out: 'posts.js' },
  { dir: 'research', key: 'research', out: 'research.js' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

function fail(file, line, msg) {
  throw new Error(file + ':' + line + '  ' + msg);
}

function scalar(raw) {
  const t = String(raw).trim();
  if (t.length > 1 && t.charAt(0) === '"' && t.endsWith('"')) return t.slice(1, -1).replace(/\\"/g, '"');
  if (t.length > 1 && t.charAt(0) === "'" && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null' || t === '~') return null;
  if (t.charAt(0) === '[' && t.endsWith(']')) {
    return t.slice(1, -1).split(',').map(scalar).filter(v => v !== '');
  }
  return t;
}

function splitFrontMatter(raw, file) {
  const lines = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n');
  if (lines[0].trim() !== '---') {
    fail(file, 1, 'missing front matter. The file must start with a line containing only ---');
  }
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { close = i; break; }
  }
  if (close === -1) fail(file, 1, 'front matter is opened but never closed with a --- line');
  return { fmLines: lines.slice(1, close), body: lines.slice(close + 1).join('\n') };
}

function parseFrontMatter(fmLines, file) {
  const data = {};
  let key = null;
  for (let i = 0; i < fmLines.length; i++) {
    const lineNo = i + 2;
    const line = fmLines[i];
    if (!line.trim() || line.trim().charAt(0) === '#') continue;

    const item = line.match(/^\s*-\s+(.*)$/);
    if (item) {
      if (!key) fail(file, lineNo, 'list item with no property name above it');
      if (!Array.isArray(data[key])) data[key] = [];
      data[key].push(scalar(item[1]));
      continue;
    }

    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:(.*)$/);
    if (!kv) fail(file, lineNo, 'cannot read as "name: value" -> ' + line.trim());
    key = kv[1];
    const rest = kv[2].trim();
    data[key] = rest === '' ? '' : scalar(rest);
  }
  return data;
}

function assetPath(p) {
  let t = String(p).trim();
  if (/^(https?:|data:|\/)/i.test(t)) return t;
  t = t.replace(/^(\.\.?\/)+/, '');
  return t.startsWith('assets/') ? '/' + t : '/assets/img/' + t;
}

function slugify(s) {
  return String(s).toLowerCase().trim()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeBody(body, section) {
  return body
    .replace(/!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
      (m, target, cap) => '![' + (cap || '').trim() + '](' + assetPath(target) + ')')
    .replace(/\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/g,
      (m, target, label) => '[' + (label || target).trim() + '](/' + section + '/' + slugify(target) + ')')
    .replace(/(!\[[^\]]*\]\()([^)]+)(\))/g,
      (m, open, path, close) => open + assetPath(path) + close);
}

function parseLinks(raw) {
  const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return arr.map(entry => {
    const s = String(entry);
    const bar = s.lastIndexOf('|');
    if (bar === -1) return { label: 'View', url: s.trim() };
    return { label: s.slice(0, bar).trim() || 'View', url: s.slice(bar + 1).trim() };
  }).filter(l => l.url);
}

function formatDate(v) {
  if (v === undefined || v === null || v === '') return { display: '', sort: 0 };
  const s = String(v).trim();

  const full = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (full && MONTHS[Number(full[2]) - 1]) {
    return {
      display: Number(full[3]) + ' ' + MONTHS[Number(full[2]) - 1] + ' ' + full[1],
      sort: Date.UTC(Number(full[1]), Number(full[2]) - 1, Number(full[3])),
    };
  }
  const month = s.match(/^(\d{4})-(\d{2})$/);
  if (month && MONTHS[Number(month[2]) - 1]) {
    return {
      display: MONTHS[Number(month[2]) - 1] + ' ' + month[1],
      sort: Date.UTC(Number(month[1]), Number(month[2]) - 1, 1),
    };
  }
  const year = s.match(/^(\d{4})$/);
  if (year) return { display: year[1], sort: Date.UTC(Number(year[1]), 0, 1) };

  return { display: s, sort: 0 };
}

// featured ranks ahead of everything, lowest number first; the rest is newest first.
function byRank(a, b) {
  if (a._rank !== b._rank) {
    if (a._rank === null) return 1;
    if (b._rank === null) return -1;
    return a._rank - b._rank;
  }
  return (b._sort - a._sort) || a.title.localeCompare(b.title);
}

function readSection(section) {
  const dir = join(ROOT, section.dir);
  const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.md')).sort() : [];

  const items = [];
  const seen = new Map();
  let drafts = 0;

  for (const name of files) {
    const rel = section.dir + '/' + name;
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

    const rank = Number(fm.featured);
    const when = formatDate(fm.date);

    const item = {
      title,
      slug,
      date: when.display,
      _sort: when.sort,
      _rank: (fm.featured === '' || fm.featured === undefined || Number.isNaN(rank)) ? null : rank,
    };
    if (fm.tag) item.tag = String(fm.tag);
    if (fm.summary) item.summary = String(fm.summary);
    if (fm.image) item.image = assetPath(fm.image);
    const links = parseLinks(fm.links);
    if (links.length) item.links = links;
    item.body = normalizeBody(body, section.dir === 'posts' ? 'blog' : 'research').trim();

    items.push(item);
  }

  items.sort(byRank);
  items.forEach(i => { delete i._sort; delete i._rank; });
  return { items, drafts };
}

export function build({ quiet = false } = {}) {
  mkdirSync(OUT_DIR, { recursive: true });
  const summary = [];

  for (const section of SECTIONS) {
    const { items, drafts } = readSection(section);

    // U+2028 and U+2029 are legal inside a JSON string but end a line in JS source.
    const SEPS = new RegExp(String.fromCharCode(91, 0x2028, 0x2029, 93), 'g');
    const json = JSON.stringify(items, null, 2).replace(SEPS, function (ch) {
      return String.fromCharCode(92) + 'u' + ch.charCodeAt(0).toString(16);
    });

    writeFileSync(join(OUT_DIR, section.out),
      '// Generated by scripts/build-content.mjs. Do not edit; edit ' + section.dir + '/*.md instead.\n' +
      'SITE.' + section.key + ' = ' + json + ';\n');

    summary.push(section.dir + ': ' + items.length + ' published, ' + drafts + ' draft');
  }

  if (!quiet) console.log(summary.join('  |  '));
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    build();
  } catch (e) {
    console.error('\nbuild-content failed:\n  ' + e.message + '\n');
    process.exit(1);
  }
}
