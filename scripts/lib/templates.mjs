import { esc } from './markdown.mjs';

export function footer(site) {
  return '<footer class="ftr">' +
    '<span class="ftr-mail">' + esc(site.email) + '</span>' +
    '<span class="ftr-dot">&middot;</span>' +
    '<a class="ftr-link" href="' + esc(site.github) + '" rel="me noopener">GitHub</a>' +
  '</footer>';
}

export function page({ site, title, description, canonical, bodyClass = '', extraHead = '', content, script = false }) {
  return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'<title>' + esc(title) + '</title>\n' +
'<meta name="author" content="' + esc(site.name) + '">\n' +
'<meta name="description" content="' + esc(description) + '">\n' +
'<meta name="color-scheme" content="dark">\n' +
'<link rel="canonical" href="' + esc(canonical) + '">\n' +
'<link rel="icon" href="/favicon.svg">\n' +
'<link rel="alternate" type="application/rss+xml" title="' + esc(site.name) + '" href="/feed.xml">\n' +
'<meta property="og:type" content="website">\n' +
'<meta property="og:url" content="' + esc(canonical) + '">\n' +
'<meta property="og:title" content="' + esc(title) + '">\n' +
'<meta property="og:description" content="' + esc(description) + '">\n' +
'<link rel="preload" href="/assets/fonts/Archivo-Regular.woff2" as="font" type="font/woff2" crossorigin>\n' +
'<style>html{background:#0d0d0f}</style>\n' +
'<link rel="stylesheet" href="/assets/css/style.css">\n' +
extraHead +
'</head>\n' +
'<body' + (bodyClass ? ' class="' + bodyClass + '"' : '') + '>\n' +
content + '\n' +
footer(site) + '\n' +
(script ? '<script src="/assets/js/contents.js" defer></script>\n' : '') +
'</body>\n' +
'</html>\n';
}

export function notFoundPage({ site }) {
  return page({
    site,
    title: 'Not found :: ' + site.name,
    description: 'That page does not exist.',
    canonical: site.url + '/404',
    content: '<main class="wrap"><h1 class="nf-h">Not found</h1>' +
      '<p class="nf-p">That page does not exist. <a class="link" href="/">Go home</a>.</p></main>',
  });
}

function personJsonLd(site) {
  return '<script type="application/ld+json">' + JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: site.name,
    url: site.url,
    sameAs: [site.github],
  }, null, 2) + '</script>\n';
}

function row(item) {
  return '<li class="row">' +
    '<a class="row-link" href="' + esc(item.url) + '">' +
      '<span class="row-title">' + esc(item.title) + '</span>' +
      (item.date ? '<span class="row-date">' + esc(item.date) + '</span>' : '') +
    '</a>' +
    (item.summary ? '<p class="row-sum">' + esc(item.summary) + '</p>' : '') +
  '</li>';
}

export function indexPage({ site, sections }) {
  const body = sections
    .filter(s => s.items.length)
    .map(s => '<section class="sec">' +
      '<h2 class="sec-h">' + esc(s.heading) + '</h2>' +
      '<ul class="rows">' + s.items.map(row).join('') + '</ul>' +
    '</section>')
    .join('');

  return page({
    site,
    title: site.name,
    description: site.description,
    canonical: site.url + '/',
    bodyClass: 'is-index',
    extraHead: personJsonLd(site),
    content: '<main class="wrap"><h1 class="name">' + esc(site.name) + '</h1>' + body + '</main>',
  });
}
