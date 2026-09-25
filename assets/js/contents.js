(function () {
  'use strict';

  var toc = document.getElementById('toc');
  var tab = document.getElementById('toc-tab');
  if (!toc || !tab) return;

  var KEY = 'kjw-toc-closed';
  var close = toc.querySelector('.toc-close');

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function store(v) {
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
  }
  function apply(closed) {
    toc.hidden = closed;
    tab.hidden = !closed;
    if (close) close.setAttribute('aria-expanded', String(!closed));
  }

  // Ships open in the markup so a reader without JavaScript still gets it. Closing
  // it on narrow screens, where there is no margin to hold it, is the one thing
  // done unasked.
  var narrow = window.matchMedia && window.matchMedia('(max-width: 1099px)').matches;
  var saved = stored();
  apply(saved === null ? Boolean(narrow) : saved === '1');

  if (close) close.addEventListener('click', function () { store(true); apply(true); });
  tab.addEventListener('click', function () { store(false); apply(false); });

  var links = Array.prototype.slice.call(toc.querySelectorAll('.toc-link'));
  var targets = links
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);

  if (!targets.length || !('IntersectionObserver' in window)) return;

  var seen = new Set();
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) seen.add(e.target.id); else seen.delete(e.target.id);
    });
    var first = targets.find(function (t) { return seen.has(t.id); });
    links.forEach(function (a) {
      a.classList.toggle('is-current', Boolean(first) && a.getAttribute('href') === '#' + first.id);
    });
  }, { rootMargin: '-10% 0px -70% 0px' });

  targets.forEach(function (t) { observer.observe(t); });
})();
