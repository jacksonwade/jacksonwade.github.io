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
