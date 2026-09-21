
(function () {
  'use strict';

  var main = document.getElementById('main');
  var nav  = document.getElementById('nav');
  var root = document.documentElement;

  // ── reading-page theme (dark/light) ───────────────────────
  // Reading pages (individual paper/post) default to dark and offer a toggle;
  // the choice is remembered. Every other page is forced light. The toggle
  // button only shows while a reading page is open (see [data-reading] in CSS).
  var THEME_KEY = 'kjw-reading-theme';
  function readingPref() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function setReadingPref(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  function applyTheme(isReading) {
    if (isReading) {
      root.setAttribute('data-reading', '1');
      var pref = readingPref();
      // First visit: honour the OS preference, else default dark.
      if (!pref) {
        var prefersLight = window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: light)').matches;
        pref = prefersLight ? 'light' : 'dark';
      }
      root.setAttribute('data-theme', pref);
    } else {
      root.removeAttribute('data-reading');
      root.setAttribute('data-theme', 'dark');   // PREVIEW: whole site black
    }
    syncToggleGlyph();
  }
  function syncToggleGlyph() {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.innerHTML = root.getAttribute('data-theme') === 'dark' ? '☽' : '☀';
  }

  // ── helpers ───────────────────────────────────────────────
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  // Escape text, then apply inline markdown: `code`, [label](url), **bold**, *italic*.
  // Internal links ("/research") go through the SPA router; external links
  // ("https://...") open in a new tab.
  function inlineLinks(s) {
    // Code spans are lifted out before anything else runs, so markers inside
    // them (**, *, [ ]) survive to the page as literal characters. The <cN>
    // sentinel is safe because esc() has already turned every < into &lt;.
    var codes = [];
    var out = esc(s).replace(/`([^`]+)`/g, function (m, code) {
      return '<c' + (codes.push(code) - 1) + '>';
    });
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, label, url) {
      var external = /^https?:\/\//i.test(url);
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
  // Build the hero line: {word} becomes a Research link, and every word is
  // wrapped so it can fade+rise in sequence on first load (all within ~0.5s).
  function heroMarkup(s) {
    // Tokenise into words for the staggered entrance. A {linked phrase} may span
    // spaces (e.g. {mean-field games}) and keeps any trailing punctuation glued
    // to it (e.g. {mean-field games}:) so the colon hugs the link, not a gap.
    var tokens = s.match(/\{[^}]*\}\S*|\S+/g) || [];
    var total = tokens.length;
    // Total stagger window kept under ~0.45s so the whole line lands fast.
    var stepMs = Math.floor(450 / total);
    var html = tokens.map(function (tok, i) {
      var m = tok.match(/^\{([^}]*)\}([\s\S]*)$/);   // {phrase} + trailing punctuation
      var inner = m
        ? '<a class="hero-link" href="/research">' + esc(m[1]) + '</a>' + esc(m[2])
        : esc(tok);
      var delay = (i * stepMs) + 'ms';
      return '<span class="hero-word" style="animation-delay:' + delay + '">' + inner + '</span>';
    }).join(' ');
    return html;
  }

  // Posts and research are generated from markdown with one shared vocabulary
  // (tag/date/summary); entriesMarkup wants category/year/desc. Hand-written
  // entries using the older names still pass through unchanged.
  function entryShape(x) {
    return {
      title: x.title,
      category: x.category || x.tag,
      year: x.year || x.date,
      desc: x.desc || x.summary,
      url: x.url,
      image: x.image,
      slug: x.slug,
    };
  }

  // Render a list of research/work entries (image left, text right).
  // Each entry links to its on-site detail page: /<section>/<slug>.
  function entriesMarkup(items, section) {
    return '<div class="entries">' + items.map(function (r) {
      var href = r.slug ? '/' + section + '/' + r.slug : '';
      var media = r.image
        ? (href
            ? '<a class="entry-media" href="' + href + '">' +
                '<img src="' + esc(r.image) + '" alt="' + esc(r.title) + '" loading="lazy"></a>'
            : '<span class="entry-media">' +
                '<img src="' + esc(r.image) + '" alt="' + esc(r.title) + '" loading="lazy"></span>')
        : '';
      var cat  = r.category ? '<span class="entry-cat">' + esc(r.category) + '</span>' : '';
      var date = r.year ? '<span class="entry-date">' + esc(r.year) + '</span>' : '';
      var head = (cat || date) ? '<div class="entry-head">' + cat + date + '</div>' : '';
      var title = href
        ? '<a class="entry-title" href="' + href + '">' + esc(r.title) + '</a>'
        : '<span class="entry-title">' + esc(r.title) + '</span>';
      var desc = r.desc ? '<p class="entry-desc">' + esc(r.desc) + '</p>' : '';
      return '<article class="entry' + (r.image ? ' has-media' : '') + '">' +
               media +
               '<div class="entry-body">' + head + title + desc + '</div>' +
             '</article>';
    }).join('') + '</div>';
  }

  // Compact list of blog posts (title, date, summary) for the home page.
  function postsListMarkup(posts) {
    return '<div class="postlist">' + posts.map(function (p) {
      var href = p.slug ? '/blog/' + p.slug : '';
      var title = href
        ? '<a class="post-title" href="' + href + '">' + esc(p.title) + '</a>'
        : '<span class="post-title">' + esc(p.title) + '</span>';
      var date = p.date ? '<span class="post-date">' + esc(p.date) + '</span>' : '';
      var sum  = p.summary ? '<p class="post-sum">' + esc(p.summary) + '</p>' : '';
      return '<article class="post"><div class="post-head">' + title + date + '</div>' + sum + '</article>';
    }).join('') + '</div>';
  }

  // ── page renderers ────────────────────────────────────────
  // Landing = About-style: short blurb, then News, then Latest publications.
  function home() {
    var work = SITE.research || [];
    var news = SITE.news || [];

    // Blurb may be a string or an array of paragraphs.
    var blurbArr = Array.isArray(SITE.blurb) ? SITE.blurb : (SITE.blurb ? [SITE.blurb] : []);
    var blurb = blurbArr.length
      ? '<div class="landing-blurb">' +
          blurbArr.map(function (p) { return '<p>' + inlineLinks(p) + '</p>'; }).join('') +
        '</div>'
      : '';

    var newsSec = news.length
      ? '<section class="landing-sec reveal">' +
          '<h2 class="sec-h">News</h2>' +
          '<div class="newslist">' +
            news.map(function (n) {
              return '<div class="news-row">' +
                '<span class="news-date">' + esc(n.date || '') + '</span>' +
                '<span class="news-text">' + inlineLinks(n.text || '') + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</section>'
      : '';

    var pubsSec =
      '<section class="landing-sec reveal">' +
        '<h2 class="sec-h">Latest publications</h2>' +
        (work.length
          ? entriesMarkup(work.slice(0, 3).map(entryShape), 'research') +
            (work.length > 3 ? '<a class="more-link" href="/research">All publications &rarr;</a>' : '')
          : '<p class="note">Nothing yet.</p>') +
      '</section>';

    return '<section class="landing">' + blurb + newsSec + pubsSec + '</section>';
  }

  function about() {
    var paras = (SITE.about || []).map(function (p) {
      return '<p>' + inlineLinks(p) + '</p>';
    }).join('');
    // Full-bleed image + text split, same treatment as Contact (curtain reveal).
    var art = SITE.aboutImage
      ? '<div class="contact-art"><img src="' + esc(SITE.aboutImage) + '" alt=""></div>'
      : '';
    return '<section class="contact-split about-split">' +
        art +
        '<div class="contact-panel">' +
          '<h2>About</h2>' +
          '<div class="about-body">' + paras + '</div>' +
        '</div>' +
    '</section>';
  }

  function research() {
    var items = SITE.research || [];
    var intro = (SITE.researchIntro || []).map(function (p) {
      return '<p>' + inlineLinks(p) + '</p>';
    }).join('');
    var introBlock = intro ? '<div class="research-intro">' + intro + '</div>' : '';
    var body = items.length
      ? entriesMarkup(items.map(entryShape), 'research')
      : '<p class="note"></p>';
    return '<section class="research-page"><h2>Research</h2>' + introBlock + body + '</section>';
  }

  function blog() {
    var posts = SITE.posts || [];
    var body;
    if (!posts.length) {
      body = '<p class="note">No posts yet.</p>';
    } else {
      body = entriesMarkup(posts.map(entryShape), 'blog');
    }
    return '<section class="research-page"><h2>Writing</h2>' + body + '</section>';
  }

  function contact() {
    var links = [];
    if (SITE.github) {
      links.push('<a class="contact-link" href="' + esc(SITE.github) +
        '" target="_blank" rel="noopener">Code &nearr;</a>');
    }
    // Email is shown as plain text (not a mailto link), on purpose: the value is
    // a scraper-proof placeholder a human fills in, so it should not be clickable.
    var email = SITE.email
      ? '<p class="contact-email">' + esc(SITE.email) + '</p>'
      : '';
    // Image-dominant split: full-height artwork on the left (reveals with a
    // slow curtain-down), text panel on the right.
    var art = SITE.contactImage
      ? '<div class="contact-art"><img src="' + esc(SITE.contactImage) + '" alt=""></div>'
      : '';
    return '<section class="contact-split">' +
        art +
        '<div class="contact-panel">' +
          '<h2>Contact</h2>' +
          '<p class="contact-intro">You can reach me by email, or find me on GitHub.</p>' +
          email +
          '<div class="contact-links">' + links.join('') + '</div>' +
        '</div>' +
    '</section>';
  }

  // Turn a markdown body into blocks:
  //   blank line       -> new paragraph
  //   "## heading"     -> heading
  //   "> quote"        -> block quote (consecutive > lines join)
  //   "- item"         -> list item (consecutive - lines become one list)
  //   "1. item"        -> numbered list item
  //   "---"            -> horizontal rule
  //   "![cap](/src)"   -> figure with caption
  //   ``` fence ```    -> code block, inner lines kept verbatim
  // Anything else is prose. A body may also still be an array of block objects.
  function parseBody(body) {
    if (Array.isArray(body)) return body;                 // legacy/explicit blocks
    if (typeof body !== 'string' || !body.trim()) return [];

    var lines = body.replace(/\r/g, '').split('\n');
    var blocks = [];
    var para = [];        // buffered prose lines
    var list = null;      // buffered bullet items
    var olist = null;     // buffered numbered items
    var quote = null;     // buffered quote lines

    function flushPara()  { if (para.length)  { blocks.push(para.join(' ').trim()); para = []; } }
    function flushList()  { if (list)  { blocks.push({ list: list }); list = null; } }
    function flushOl()    { if (olist) { blocks.push({ ol: olist }); olist = null; } }
    function flushQuote() { if (quote) { blocks.push({ quote: quote.join(' ').trim() }); quote = null; } }
    function flushAll()   { flushPara(); flushList(); flushOl(); flushQuote(); }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var t = line.trim();

      // Fenced code is consumed raw off `line`, not `t`, so indentation survives.
      var fence = t.match(/^(`{3,}|~{3,})\s*(\S*)/);
      if (fence) {
        flushAll();
        var closer = fence[1].charAt(0) === '`' ? /^\s*`{3,}\s*$/ : /^\s*~{3,}\s*$/;
        var code = [];
        for (i++; i < lines.length && !closer.test(lines[i]); i++) code.push(lines[i]);
        blocks.push({ code: code.join('\n'), lang: fence[2] });
        continue;
      }

      if (t === '') { flushAll(); continue; }

      var img = t.match(/^!\[(.*?)\]\((.+?)\)$/);
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

  // Render one body block. A block is either a string (paragraph) or an
  // object: { h: 'Heading' } | { p: 'text' } | { img: '/path', cap: '...' } |
  // { quote: 'text' } | { list: ['a','b'] } | { ol: ['a','b'] } | { hr: true } |
  // { code: 'text', lang: 'js' }.
  function blockMarkup(b) {
    if (typeof b === 'string') return '<p>' + inlineLinks(b) + '</p>';
    if (b.h)     return '<h3 class="d-h">' + inlineLinks(b.h) + '</h3>';
    if (b.p)     return '<p>' + inlineLinks(b.p) + '</p>';
    if (b.hr)    return '<hr class="d-hr">';
    if (typeof b.code === 'string') return '<pre class="d-pre"><code>' + esc(b.code) + '</code></pre>';
    if (b.quote) return '<blockquote class="d-quote">' + inlineLinks(b.quote) + '</blockquote>';
    if (b.list)  return '<ul class="d-list">' + b.list.map(function (li) {
                    return '<li>' + inlineLinks(li) + '</li>'; }).join('') + '</ul>';
    if (b.ol)    return '<ol class="d-ol">' + b.ol.map(function (li) {
                    return '<li>' + inlineLinks(li) + '</li>'; }).join('') + '</ol>';
    if (b.img)   return '<figure class="d-fig"><img src="' + esc(b.img) + '" alt="' +
                    esc(b.cap || '') + '" loading="lazy">' +
                    (b.cap ? '<figcaption>' + inlineLinks(b.cap) + '</figcaption>' : '') + '</figure>';
    return '';
  }

  // Detail page for a single paper (research) or post (blog).
  // Calm dark hero (kicker + medium title + italic subtitle), then serif body.
  // No image behind or inside the article — the post/paper image is used only
  // on the list page thumbnail, not here.
  function detailPage(item, section) {
    var cat  = item.category || item.tag;
    var when = item.year || item.date;
    var meta = [];
    if (when) meta.push('<span class="d-date">' + esc(when) + '</span>');
    if (cat)  meta.push('<span class="d-tag">' + esc(cat) + '</span>');

    // External link buttons (e.g. { label: 'View on SSRN', url: '...' }).
    var linksArr = item.links || (item.url ? [{ label: 'View', url: item.url }] : []);
    var btns = linksArr.map(function (l) {
      return '<a class="d-btn" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
        esc(l.label) + ' &nearr;</a>';
    }).join('');

    // Subtitle: the summary line, shown in italic serif under the title.
    var sub = item.summary ? '<p class="d-sub">' + esc(item.summary) + '</p>' : '';

    // Body: a plain text block (parsed) or an array of block objects.
    var blocks = parseBody(item.body);
    var bodyBlocks = blocks.length
      ? blocks.map(blockMarkup).join('')
      : '<p class="note">' + esc(item.summary || item.desc || 'Coming soon.') + '</p>';

    return '<article class="detail">' +
      '<header class="d-cover">' +
        (meta.length ? '<div class="d-meta">' + meta.join('') + '</div>' : '') +
        '<h1 class="d-title">' + esc(item.title) + '</h1>' +
        sub +
        (btns ? '<div class="d-btns">' + btns + '</div>' : '') +
      '</header>' +
      '<div class="d-body">' + bodyBlocks + '</div>' +
    '</article>';
  }

  // ── routing ───────────────────────────────────────────────
  var ROUTES = {
    '':         { title: SITE.name,                render: home },
    'about':    { title: 'About',    render: about },
    'research': { title: 'Research', render: research },
    'blog':     { title: 'Writing',  render: blog },
    'contact':  { title: 'Contact',  render: contact }
  };

  // Parse the path into { section, slug }. e.g. "/research/titan".
  function parsePath() {
    var parts = location.pathname.replace(/^\/+|\/+$/g, '').split('/');
    return { section: parts[0] || '', slug: parts[1] || '' };
  }

  function notFound() {
    return '<section class="page"><h2>Not found</h2>' +
      '<p class="note">That page does not exist. <a class="link" href="/">Go home</a>.</p></section>';
  }

  function render() {
    var p = parsePath();
    var key = p.section;              // top-level section (drives nav highlight)
    var html, title;

    if (p.slug && (key === 'research' || key === 'blog')) {
      // Detail page: an individual paper or post.
      var list = key === 'research' ? (SITE.research || []) : (SITE.posts || []);
      var item = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].slug === p.slug) { item = list[i]; break; }
      }
      if (item) {
        html = detailPage(item, key);
        title = item.title + ' :: ' + SITE.name;
      } else {
        html = notFound(); title = 'Not found :: ' + SITE.name;
      }
    } else if (ROUTES.hasOwnProperty(key)) {
      var route = ROUTES[key];
      html = route.render();
      title = key === '' ? SITE.name : route.title + ' :: ' + SITE.name;
    } else {
      html = notFound(); title = 'Not found :: ' + SITE.name;
    }

    main.innerHTML = '<div class="page">' + html + '</div>';
    document.title = title;

    // Home centers its hero; Contact is a full-bleed split (no page padding).
    main.classList.toggle('is-home', key === '');
    main.classList.toggle('is-contact', key === 'contact');
    main.classList.toggle('is-about', key === 'about');

    // Reading pages (a paper or post) get the dark theme + a light/dark toggle;
    // every other page is always light.
    var isReading = !!(p.slug && (key === 'research' || key === 'blog'));
    applyTheme(isReading);

    // Reset the smooth-scroll easer to the top on each page switch.
    if (window.__resetScrollEaser) window.__resetScrollEaser();

    // active nav state
    var links = nav.querySelectorAll('.nl');
    for (var i = 0; i < links.length; i++) {
      var page = links[i].getAttribute('data-page') || '';
      links[i].classList.toggle('active', page === key);
    }
    window.scrollTo(0, 0);

    // Wire up scroll-reveal for entries on the freshly-rendered page.
    setupReveal();
  }

  // ── scroll reveal ─────────────────────────────────────────
  // Fade + rise elements as they enter the viewport, and fade them back out
  // when they leave (so scrolling up re-hides what scrolling down revealed).
  // Entries get the effect automatically; anything with class "reveal" too.
  var revealObserver = null;
  function setupReveal() {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var targets = main.querySelectorAll('.entry, .reveal');
    if (reduce || !('IntersectionObserver' in window)) {
      for (var i = 0; i < targets.length; i++) targets[i].classList.add('is-in');
      return;
    }
    if (revealObserver) revealObserver.disconnect();
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        // Toggle both ways: reveal when it enters, re-hide when it leaves.
        en.target.classList.toggle('is-in', en.isIntersecting);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    for (var j = 0; j < targets.length; j++) {
      targets[j].classList.add('reveal');
      revealObserver.observe(targets[j]);
    }
  }

  // Intercept internal link clicks for instant switching.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || a.target === '_blank' || a.hasAttribute('download')) return;
    if (a.host !== location.host) return;          // external
    if (href.indexOf('mailto:') === 0) return;
    if (href.charAt(0) !== '/') return;            // only site-root links
    e.preventDefault();
    if (href !== location.pathname) history.pushState(null, '', href);
    render();
  });

  window.addEventListener('popstate', render);

  // Theme toggle: flip the reading theme and remember it.
  (function () {
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      setReadingPref(next);
      syncToggleGlyph();
    });
  })();

  render();

  // ── smooth "gravity" scrolling ────────────────────────────
  // Intercepts wheel input and eases the page toward a target position, giving
  // a weighted, momentum-like glide in both directions. Runs for mouse AND
  // trackpad. Touch devices keep native scrolling. Skipped for reduced-motion.
  (function () {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (reduce || coarse) return;   // leave touch/phones on native momentum

    var target  = window.scrollY;
    var current = target;
    var running = false;

    // Lower EASE = heavier, longer glide (more "gravity"). MULT scales how far
    // one wheel notch throws the target so the glide has distance to travel.
    // Tuning: EASE 0.05 = floatier, 0.06 = balanced, 0.08 = snappy. MULT up = more travel per notch.
    var EASE = 0.07;
    var MULT = 1.2;

    function maxScroll() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }
    function tick() {
      var diff = target - current;
      current += diff * EASE;
      if (Math.abs(diff) < 0.4) { current = target; running = false; }
      window.scrollTo(0, Math.round(current * 100) / 100);
      if (running) requestAnimationFrame(tick);
    }
    function onWheel(e) {
      if (e.ctrlKey) return;                    // let pinch-zoom pass through
      var delta = e.deltaMode === 1 ? e.deltaY * 16
                : e.deltaMode === 2 ? e.deltaY * window.innerHeight
                : e.deltaY;
      target = Math.min(maxScroll(), Math.max(0, target + delta * MULT));
      e.preventDefault();
      if (!running) { running = true; requestAnimationFrame(tick); }
    }
    // Keep target in sync when scroll changes by other means (keyboard, drag).
    function resync() { if (!running) { target = current = window.scrollY; } }

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', resync);
    window.addEventListener('keydown', function () { setTimeout(resync, 0); });

    // Router calls this after a page switch (which scrolls to top).
    window.__resetScrollEaser = function () { running = false; target = current = 0; };
  })();
})();
