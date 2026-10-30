/* Section -> deep page -> back, as one continuous move.
   Cross-document View Transitions (Chrome 126+, Safari 18.2+): the clicked "Go deeper" title and the
   deep page's h1 share the name "topic", so the title grows into the headline and shrinks back on return.
   Pattern from the Chrome team's guide (developer.chrome.com/docs/web-platform/view-transitions/cross-document).
   Browsers without it simply navigate. */
(function () {
  'use strict';
  var links = Array.prototype.slice.call(document.querySelectorAll('a.deeper'));
  links.forEach(function (a, i) { a.addEventListener('click', function () { try { sessionStorage.setItem('ke-deeper', String(i)); } catch (e) {} }); });
  function picked(url) {
    var i = -1; try { i = +sessionStorage.getItem('ke-deeper'); } catch (e) {}
    var a = links[i];
    if (a && url && a.href.split('#')[0] === url.split('#')[0]) return a;
    return links.filter(function (l) { return url && l.href.split('#')[0] === url.split('#')[0]; })[0] || null;
  }
  function name(a, vt) {
    var t = a && a.querySelector('.t'); if (!t || !vt) return;
    t.style.viewTransitionName = 'topic';
    vt.finished.finally(function () { t.style.viewTransitionName = ''; });
  }
  addEventListener('pageswap', function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    name(picked(e.activation.entry.url), e.viewTransition);
  });
  addEventListener('pagereveal', function (e) {
    if (!e.viewTransition || !window.navigation || !navigation.activation || !navigation.activation.from) return;
    var from = navigation.activation.from.url || '';
    if (from.indexOf('/learn/') < 0) { e.viewTransition.skipTransition(); return; }
    name(picked(from), e.viewTransition);
  });
})();
