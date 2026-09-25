import { esc, parseBody, renderBody } from './markdown.mjs';

export function footer(site, { home = false } = {}) {
  return '<footer class="ftr">' +
    (home ? '<a href="/">' + esc(site.name) + '</a>' : '') +
    '<span>' + esc(site.email) + '</span>' +
    '<a href="' + esc(site.github) + '" rel="me noopener">GitHub</a>' +
  '</footer>';
}

export function page({ site, title, description, canonical, bodyClass = '', extraHead = '', content }) {
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
'<link rel="preload" href="/assets/fonts/Newsreader-Roman.woff2" as="font" type="font/woff2" crossorigin>\n' +
'<style>html{background:#12100e}</style>\n' +
'<link rel="stylesheet" href="/assets/css/style.css">\n' +
extraHead +
'</head>\n' +
'<body' + (bodyClass ? ' class="' + bodyClass + '"' : '') + '>\n' +
content + '\n' +
'</body>\n' +
'</html>\n';
}

export function notFoundPage({ site }) {
  return page({
    site,
    title: 'Not found :: ' + site.name,
    description: 'That page does not exist.',
    canonical: site.url + '/404',
    bodyClass: 'is-index',
    content: '<main class="page"><h1 class="nf-h">Not found</h1>' +
      '<p class="nf-p">That page does not exist. <a class="link" href="/">Go home</a>.</p>' +
      '</main>' + footer(site),
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
      (item.year ? ' <span class="row-date">' + esc(item.year) + '</span>' : '') +
    '</a>' +
    (item.summary ? '<span class="row-sum">' + esc(item.summary) + '</span>' : '') +
  '</li>';
}

export function indexPage({ site, sections }) {
  const body = sections
    .filter(s => s.items.length)
    .map(s => '<section class="sec">' +
      '<h2 class="sec-h">' + esc(s.heading) + '</h2>' +
      '<ul class="rows" role="list">' + s.items.map(row).join('') + '</ul>' +
    '</section>')
    .join('');

  return page({
    site,
    title: site.name,
    description: site.description,
    canonical: site.url + '/',
    bodyClass: 'is-index',
    extraHead: personJsonLd(site),
    content: '<main class="page"><h1 class="nm">' + esc(site.name) + '</h1>' + body +
             '</main>' + footer(site),
  });
}

export function detailPage({ site, item }) {
  const { html: bodyHtml } = renderBody(parseBody(item.body));

  const links = (item.links || []).map(l =>
    '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.label) + '</a>'
  ).join('');

  const content =
    '<header class="top"><a class="brand" href="/">' + esc(site.name) + '</a></header>' +
    '<main class="wrap">' +
      '<article>' +
        '<h1 class="d-title">' + esc(item.title) + '</h1>' +
        (item.year ? '<p class="d-date">' + esc(item.year) + '</p>' : '') +
        (links ? '<div class="d-links">' + links + '</div>' : '') +
        '<div class="d-body">' + bodyHtml + '</div>' +
      '</article>' +
    '</main>' +
    footer(site, { home: true });

  return page({
    site,
    title: item.title + ' :: ' + site.name,
    description: item.summary || item.title,
    canonical: site.url + item.url,
    bodyClass: 'is-detail',
    content,
  });
}
