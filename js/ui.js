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
      if (el._nf) { el._nf = null; }
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
    el._nf.format = o.format || { maximumFractionDigits: o.d || 0, minimumFractionDigits: o.d || 0 };
    el._nf.numberSuffix = o.suffix || '';
    el._nf.numberPrefix = o.prefix || '';
    el._nf.update(value);
    el._sr.textContent = text;
  };
  KUI.css = function (v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); };
})();
