import { slugify } from './content.mjs';

export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function inlineLinks(s) {
  // Code spans are lifted out before anything else runs, so markers inside them
  // survive as literal characters. The <cN> sentinel is safe only because esc()
  // has already turned every < into &lt;.
  const codes = [];
  let out = esc(s).replace(/`([^`]+)`/g, function (m, code) {
    return '<c' + (codes.push(code) - 1) + '>';
  });
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, url) {
    const external = /^https?:\/\//i.test(url);
    return '<a class="link" href="' + url + '"' +
      (external ? ' target="_blank" rel="noopener"' : '') +
      '>' + label + '</a>';
  });
  out = out
    .replace(/\*\*(\S(?:[^*]*\S)?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(\S(?:[^*]*\S)?)\*(?![*\w])/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(\S(?:[^_]*\S)?)_(?![_\w])/g, '$1<em>$2</em>');
  return out.replace(/<c(\d+)>/g, function (m, i) {
    return '<code class="d-code">' + codes[Number(i)] + '</code>';
  });
}

export function parseBody(body) {
  if (Array.isArray(body)) return body;
  if (typeof body !== 'string' || !body.trim()) return [];

  const lines = body.replace(/\r/g, '').split('\n');
  const blocks = [];
  let para = [];
  let list = null;
  let olist = null;
  let quote = null;

  function flushPara()  { if (para.length)  { blocks.push(para.join(' ').trim()); para = []; } }
  function flushList()  { if (list)  { blocks.push({ list: list }); list = null; } }
  function flushOl()    { if (olist) { blocks.push({ ol: olist }); olist = null; } }
  function flushQuote() { if (quote) { blocks.push({ quote: quote.join(' ').trim() }); quote = null; } }
  function flushAll()   { flushPara(); flushList(); flushOl(); flushQuote(); }

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();

    const fence = t.match(/^(`{3,}|~{3,})\s*(\S*)/);
    if (fence) {
      flushAll();
      const closer = fence[1].charAt(0) === '`' ? /^\s*`{3,}\s*$/ : /^\s*~{3,}\s*$/;
      const code = [];
      // Pushed from the raw line rather than the trimmed one, so indentation survives.
      for (i++; i < lines.length && !closer.test(lines[i]); i++) code.push(lines[i]);
      blocks.push({ code: code.join('\n'), lang: fence[2] });
      continue;
    }

    if (t === '') { flushAll(); continue; }

    const img = t.match(/^!\[(.*?)\]\((.+?)\)$/);
    if (img)                  { flushAll(); blocks.push({ img: img[2], cap: img[1] }); continue; }
    if (/^#{1,3}\s+/.test(t)) { flushAll(); blocks.push({ h: t.replace(/^#{1,3}\s+/, '') }); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flushAll(); blocks.push({ hr: true }); continue; }
    if (/^>\s?/.test(t))      { flushPara(); flushList(); flushOl(); (quote = quote || []).push(t.replace(/^>\s?/, '')); continue; }
    if (/^[-*]\s+/.test(t))   { flushPara(); flushOl(); flushQuote(); (list = list || []).push(t.replace(/^[-*]\s+/, '')); continue; }
    if (/^\d+[.)]\s+/.test(t)){ flushPara(); flushList(); flushQuote(); (olist = olist || []).push(t.replace(/^\d+[.)]\s+/, '')); continue; }

    flushList(); flushOl(); flushQuote(); para.push(t);
  }
  flushAll();
  return blocks;
}

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

function plainText(s) {
  return String(s)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
    .replace(/\*\*(\S(?:[^*]*\S)?)\*\*/g, '$1')
    .replace(/(^|[^*\w])\*(\S(?:[^*]*\S)?)\*(?![*\w])/g, '$1$2')
    .replace(/(^|[^_\w])_(\S(?:[^_]*\S)?)_(?![_\w])/g, '$1$2');
}

export function renderBody(blocks) {
  const counts = new Map();
  const taken = new Set();
  const headings = [];

  // The suffix can itself be a real slug, so an id is only settled once it is
  // not already taken: Why / Why / Why 2 must not all land on why-2.
  function headingId(text) {
    const plain = plainText(text);
    const base = slugify(plain) || 'section';
    let n = counts.get(base) || 0;
    let id;
    do { n += 1; id = n === 1 ? base : base + '-' + n; } while (taken.has(id));
    counts.set(base, n);
    taken.add(id);
    headings.push({ id, text: plain });
    return id;
  }

  const html = blocks.map(b => blockMarkup(b, headingId)).join('');
  return { html, headings };
}
