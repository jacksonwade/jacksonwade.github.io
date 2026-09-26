export function fail(file, line, msg) {
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

export function splitFrontMatter(raw, file) {
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

export function parseFrontMatter(fmLines, file) {
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
