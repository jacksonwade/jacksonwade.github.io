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
