/* Shared UI helpers built on vendored libraries (see CREDITS.md).
   KUI.num: rolling digits from NumberFlow (number-flow 0.6.2, MIT, github.com/barvian/number-flow).
   The rolling element is decorative; a visually hidden copy keeps the text for screen readers and tests. */
(function () {
  'use strict';
  var ok = !!(window.customElements && customElements.get('number-flow'));
  var KUI = window.KUI = {};
  KUI.num = function (el, value, opts, text) {
    if (!el) return;
    if (value === null || value === undefined || !isFinite(value) || !ok) {
      if (el._nf) { el._nf = null; el._nfKey = null; }
      el.textContent = text; return;
    }
    if (!el._nf) {
      el.textContent = '';
      var nf = document.createElement('number-flow');
      nf.setAttribute('aria-hidden', 'true');
      nf.locales = 'en-GB';
      var sr = document.createElement('span'); sr.className = 'sr-only';
      el.appendChild(nf); el.appendChild(sr);
      el._nf = nf; el._sr = sr;
    }
    var o = opts || {};
    /* skip identical updates: NumberFlow re-runs its layout work on every update() call */
    var key = value + '|' + (o.d || 0) + '|' + (o.suffix || '') + '|' + (o.prefix || '');
    if (el._nfKey === key) { el._sr.textContent = text; return; }
    el._nfKey = key;
    el._nf.format = o.format || { maximumFractionDigits: o.d || 0, minimumFractionDigits: o.d || 0 };
    el._nf.numberSuffix = o.suffix || '';
    el._nf.numberPrefix = o.prefix || '';
    el._nf.update(value);
    el._sr.textContent = text;
  };
  /* Theme colours are read many times a frame; cache them per theme instead of calling getComputedStyle each time. */
  var cssCache = {}, cssTheme = null;
  KUI.css = function (v) {
    var t = document.documentElement.dataset.theme || '';
    if (t !== cssTheme) { cssCache = {}; cssTheme = t; }
    var r = cssCache[v];
    if (r === undefined) r = cssCache[v] = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    return r;
  };
  /* Number formatting: one Intl.NumberFormat per digit count (toLocaleString builds a new one per call). */
  var nfs = {};
  KUI.fmt = function (n, d) {
    d = d || 0; var f = nfs[d] || (nfs[d] = new Intl.NumberFormat('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d }));
    return f.format(n);
  };
  /* Canvas sizing without forcing layout every frame: sizes come from a ResizeObserver. */
  var sizes = new WeakMap(), ro = window.ResizeObserver ? new ResizeObserver(function (es) {
    es.forEach(function (e) { var s = sizes.get(e.target); if (s) { s.w = e.target.clientWidth; s.h = e.target.clientHeight; } });
  }) : null;
  KUI.size = function (c) {
    var s = sizes.get(c);
    if (!s) { s = { w: c.clientWidth, h: c.clientHeight, g: c.getContext('2d') }; sizes.set(c, s); if (ro) ro.observe(c); }
    else if (!ro) { s.w = c.clientWidth; s.h = c.clientHeight; }
    return s;
  };
})();
