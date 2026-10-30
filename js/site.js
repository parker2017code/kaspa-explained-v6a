/* Kaspa Explained. Plain JS on top of vendored d3, Observable Plot, interact.js and NumberFlow (see CREDITS.md). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = KUI.css;
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var params = new URLSearchParams(location.search);
  function setParam(k, v) {
    params.set(k, v);
    history.replaceState(null, '', location.pathname + '?' + params.toString() + location.hash);
  }
  function fit(c) {
    if (!c.dataset.h) { c.dataset.h = c.getAttribute('height') || ''; if (c.dataset.h) c.style.height = c.dataset.h + 'px'; }
    var dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.dataset.h ? +c.dataset.h : c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    var g = c._g || (c._g = c.getContext('2d')); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g: g, w: w, h: h };
  }
  var fmtShort = function (n) { var a = Math.abs(n); return a >= 1e9 ? +(n / 1e9).toPrecision(3) + 'B' : a >= 1e6 ? +(n / 1e6).toPrecision(3) + 'M' : a >= 1e3 ? +(n / 1e3).toPrecision(3) + 'k' : String(Math.round(n)); };
  var fmt = KUI.fmt;

  /* Charts draw when their chapter first comes near the screen, not all at once on load
     (the chapters below the fold are not even laid out yet; see content-visibility in site.css).
     After that, theme, resize and <details> changes redraw only the charts that have been drawn. */
  function kxSeen(s) {
    if (s._kxSeen) return; s._kxSeen = true;
    var q = s._kxQ || []; s._kxQ = null; q.forEach(function (f) { f(); });
  }
  var lazyIO = window.IntersectionObserver ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { lazyIO.unobserve(e.target); kxSeen(e.target); } });
  }, { rootMargin: '50% 0px' }) : null;
  var backIO = window.IntersectionObserver ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { backIO.unobserve(e.target); kxSeen(e.target); } });
  }) : null;
  /* A chapter with content-visibility:auto says when the browser starts rendering it; draw then, when it has real sizes. */
  var cvEvents = 'oncontentvisibilityautostatechange' in document.documentElement;
  function when(id, fn) {
    var el = $(id), s = el && (el.closest('section') || el);
    if (!s || !lazyIO || s._kxSeen) return fn();
    if (!s._kxQ) {
      s._kxQ = [];
      if (cvEvents && getComputedStyle(s).contentVisibility === 'auto') {
        s.addEventListener('contentvisibilityautostatechange', function h(e) { if (!e.skipped) { s.removeEventListener('contentvisibilityautostatechange', h); requestAnimationFrame(function () { backIO.unobserve(s); kxSeen(s); }); } });
        backIO.observe(s); /* backstop if the event never comes: on screen means rendered */
      } else lazyIO.observe(s);
    }
    if (s._kxQ.indexOf(fn) < 0) s._kxQ.push(fn);
  }

  /* Theme and nerd mode */
  var themeBtn = $('theme');
  /* Paper is the default; "dark" is the night palette. */
  function paintTheme() { themeBtn.textContent = document.documentElement.dataset.theme === 'dark' ? 'Day' : 'Night'; }
  themeBtn.addEventListener('click', function () {
    var night = document.documentElement.dataset.theme !== 'dark';
    if (night) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    try { if (night) localStorage.setItem('ke-theme2', 'dark'); else localStorage.removeItem('ke-theme2'); } catch (e) {}
    var mt = document.querySelectorAll('meta[name="theme-color"]'); mt.forEach(function (m) { m.setAttribute('content', night ? '#181612' : '#f5f1e8'); });
    paintTheme(); redrawAll();
  });
  paintTheme();
  var nerdBtn = $('nerd');
  function setNerd(on) {
    document.body.classList.toggle('nerd', on);
    nerdBtn.setAttribute('aria-pressed', String(on));
    var nst = nerdBtn.querySelector('.st'); if (nst) nst.textContent = on ? 'on' : 'off';
    document.querySelectorAll('details.nerd').forEach(function (d) { d.open = on; });
    store.set('ke-nerd', on);
  }
  nerdBtn.addEventListener('click', function () { setNerd(!document.body.classList.contains('nerd')); });
  setNerd(store.get('ke-nerd', false));

  /* Popovers for "i" buttons and glossary terms */
  var pop = null, popFor = null, pinned = false;
  function closePop() { if (pop) { pop.remove(); pop = null; if (popFor) { popFor.setAttribute('aria-expanded', 'false'); popFor.removeAttribute('aria-describedby'); } popFor = null; pinned = false; } }
  function openPop(btn) {
    closePop();
    pop = document.createElement('div'); pop.className = 'pop'; pop.id = 'pop'; pop.setAttribute('role', 'tooltip');
    pop.textContent = btn.getAttribute('data-pop');
    document.body.appendChild(pop);
    var r = btn.getBoundingClientRect(), pw = pop.offsetWidth;
    var left = Math.min(Math.max(8, r.left + window.scrollX + r.width / 2 - pw / 2), document.documentElement.clientWidth - pw - 8);
    pop.style.left = left + 'px'; pop.style.top = (r.bottom + window.scrollY + 8) + 'px';
    btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-describedby', 'pop'); popFor = btn;
  }
  document.querySelectorAll('[data-pop]').forEach(function (b) {
    b.setAttribute('aria-expanded', 'false');
    b.addEventListener('click', function (e) { e.stopPropagation(); if (popFor === b && pinned) closePop(); else { if (popFor !== b) openPop(b); pinned = true; } });
    b.addEventListener('mouseenter', function () { if (matchMedia('(hover: hover)').matches && !pinned) openPop(b); });
    b.addEventListener('mouseleave', function () { if (matchMedia('(hover: hover)').matches && !pinned) closePop(); });
  });
  document.addEventListener('click', closePop);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });
  window.addEventListener('scroll', closePop, { passive: true });

  /* Chapters, progress and resume */
  var chapters = Array.prototype.slice.call(document.querySelectorAll('section.chapter[id]'));
  var dots = $('dots'), seen = store.get('ke-seen', {});
  chapters.forEach(function (s, i) {
    var a = document.createElement('a'); a.href = '#' + s.id;
    a.title = s.dataset.title; a.setAttribute('aria-label', s.dataset.title);
    if (seen[s.id]) a.classList.add('seen');
    dots.appendChild(a); s._dot = a;
  });
  var chapSel = $('chapSel');
  if (chapSel) {
    var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Chapters'; chapSel.appendChild(o0);
    var n = 0;
    chapters.forEach(function (s) {
      var o = document.createElement('option'); o.value = s.id;
      o.textContent = (s.classList.contains('numbered') ? (++n) + '. ' : '') + s.dataset.title; chapSel.appendChild(o);
    });
    chapSel.addEventListener('change', function () {
      var t = chapSel.value && $(chapSel.value); if (!t) return;
      history.pushState(null, '', '#' + t.id);
      t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      var h = t.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    });
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var s = en.target;
      chapters.forEach(function (c) { c._dot.classList.toggle('here', c === s); });
      if (chapSel && document.activeElement !== chapSel) chapSel.value = s.id;
      seen[s.id] = 1; s._dot.classList.add('seen'); store.set('ke-seen', seen);
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  chapters.forEach(function (s) { io.observe(s); });
  var bar = $('progress');
  function onScroll() {
    var h = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (h > 0 ? Math.min(100, scrollY / h * 100) : 0) + '%';
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* Live facts (chapter 7), read-only */
  var API = 'https://api.kaspa.org';
  function getJSON(u) { return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  var liveReward = null;
  function facts() {
    Promise.all([getJSON(API + '/info/hashrate?stringOnly=false'), getJSON(API + '/info/coinsupply'), getJSON(API + '/info/blockreward'), getJSON(API + '/info/halving')]).then(function (r) {
      $('lfHash').textContent = fmt(r[0].hashrate / 1000, 1) + ' PH/s';
      $('lfSupply').textContent = fmt(+r[1].circulatingSupply / 1e8 / 1e9, 3) + ' billion';
      liveReward = r[2].blockreward;
      $('emitLive').textContent = 'Live now: ' + fmt(liveReward, 8) + ' KAS per block, about ' + fmt(liveReward * 10, 2) + ' KAS a second. Next step down: ' + fmt(r[3].nextHalvingAmount, 8) + ' KAS per block, around ' + new Date(r[3].nextHalvingTimestamp * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + '. Source: api.kaspa.org.';
    }).catch(function () { ['lfHash', 'lfSupply'].forEach(function (id) { $(id).textContent = 'not reachable'; }); });
  }
  facts();
  if (window.KLive) KLive.subs.push(function () { if (KLive.daa) $('lfScore').textContent = fmt(KLive.daa); });

  /* Chapter 3: grow a DAG, order it with GHOSTDAG (k = 3) */
  var K = 3, G = { blocks: [], secret: [], hidingSince: 0 };
  function mk(parents, hidden) {
    var b = { id: G.blocks.length + G.secret.length, parents: parents, hidden: !!hidden, past: new Set() };
    parents.forEach(function (p) { b.past.add(p); p.past.forEach(function (x) { b.past.add(x); }); });
    b.layer = parents.length ? Math.max.apply(null, parents.map(function (p) { return p.layer; })) + 1 : 0;
    return b;
  }
  function ghost(b) {
    if (b._gd) return b._gd;
    if (!b.parents.length) { b._gd = { score: 1, blue: new Set([b]), order: [b] }; return b._gd; }
    var sp = b.parents.slice().sort(function (x, y) { return ghost(y).score - ghost(x).score || x.id - y.id; })[0];
    var spd = ghost(sp), blue = new Set(spd.blue); blue.add(sp);
    var merge = []; b.past.forEach(function (x) { if (x !== sp && !sp.past.has(x)) merge.push(x); });
    merge.sort(function (x, y) { return ghost(x).score - ghost(y).score || x.id - y.id; });
    var inAnti = function (a, c) { return a !== c && !a.past.has(c) && !c.past.has(a); };
    var reds = [];
    merge.forEach(function (c) {
      var anti = []; blue.forEach(function (x) { if (inAnti(x, c)) anti.push(x); });
      var ok = anti.length <= K && anti.every(function (x) {
        var n = 1; blue.forEach(function (y) { if (inAnti(x, y)) n++; }); return n <= K;
      });
      if (ok) blue.add(c); else reds.push(c);
    });
    var bl = merge.filter(function (c) { return blue.has(c); });
    var order = spd.order.concat(bl, reds, [b]);
    b._gd = { score: blue.size, blue: blue, order: order, sp: sp };
    return b._gd;
  }
  function tips(list) {
    var hasChild = new Set(); list.forEach(function (b) { b.parents.forEach(function (p) { hasChild.add(p); }); });
    return list.filter(function (b) { return !hasChild.has(b); });
  }
  function gReset() {
    G.blocks = [mk([])]; G.secret = []; G.hidingSince = 0; G.released = null;
    /* start with a full window of history, the way streaming charts pre-fill their buffer */
    var cw = $('ghostCanvas').clientWidth || 600, rounds = Math.max(6, Math.floor(cw / 62)) - 1;
    for (var i = 0; i < rounds; i++) honestRound();
    $('gOut').textContent = 'Honest miners are working. Each block points at every block its miner had seen.';
    $('gHide').disabled = false; $('gRelease').disabled = true; drawGhost();
  }
  function width() { return 2; }
  function honestRound() {
    var t = tips(G.blocks), n = width(), add = [];
    for (var i = 0; i < n; i++) add.push(mk(t));
    add.forEach(function (b) { b.id = G.blocks.length; G.blocks.push(b); });
    if (G.secret.length) G.hidingSince += n;
  }
  var auto = null, hiding = false, atkAcc = 0;
  function q() { return +$('qAtk').value / 100; }
  $('qAtk').addEventListener('input', function () { $('qAtkVal').textContent = Math.round(q() * 100) + '%'; setParam('atk', Math.round(q() * 100)); });
  function autoStep() {
    if (G.blocks.length + G.secret.length > 140) {
      if (!hiding && !G.released) { gReset(); drawGhost(); return; }
      stopAuto(); $('gOut').textContent = 'That is enough history for one demo. Reset to play again.'; return;
    }
    honestRound();
    if (hiding) {
      atkAcc += width() * q() / (1 - q());
      while (atkAcc >= 1) { atkAcc -= 1; var prev = G.secret.length ? [G.secret[G.secret.length - 1]] : [G.base]; var b = mk(prev, true); G.secret.push(b); }
      $('gOut').textContent = 'Mining in secret: ' + G.secret.length + ' hidden blocks. The honest network has added ' + G.hidingSince + ' it can see. Release whenever you like.';
      $('gRelease').disabled = G.secret.length === 0;
    }
    drawGhost();
  }
  function startAuto() { if (!auto && !reduced) auto = setInterval(autoStep, 650); }
  function stopAuto() { clearInterval(auto); auto = null; }
  /* On a phone the buttons sit below the graph; bring the graph back into view so the attack is visible. */
  function showStage() {
    var c = $('ghostCanvas').getBoundingClientRect(), r = $('gRelease').getBoundingClientRect(), vh = window.innerHeight;
    if (r.bottom - c.top > vh - 24) return;
    if (c.top < 12 || r.bottom > vh - 12) window.scrollBy({ top: c.top - 12, behavior: reduced ? 'auto' : 'smooth' });
  }
  $('gHide').addEventListener('click', function () {
    showStage();
    G.base = tips(G.blocks)[0]; G.secret = []; G.released = null; G.hidingSince = 0; atkAcc = 0; hiding = true;
    $('gHide').disabled = true; $('gRelease').disabled = true;
    $('gOut').textContent = 'You went dark. Your blocks only point at each other now.';
    startAuto();
    if (reduced) { for (var i = 0; i < 6; i++) autoStep(); }
    drawGhost();
  });
  $('gRelease').addEventListener('click', function () {
    showStage();
    hiding = false;
    G.secret.forEach(function (b) { b.hidden = false; b.id = G.blocks.length; b.mine = true; G.blocks.push(b); });
    var released = G.secret; G.secret = [];
    honestRound(); G.flashAt = performance.now(); G.released = released;
    var v = ghost(mk(tips(G.blocks)));
    var red = released.filter(function (b) { return !v.blue.has(b); }).length;
    $('gOut').innerHTML = red ? '<b>' + red + ' of your ' + released.length + ' blocks came out red.</b> They stay in the DAG, but GHOSTDAG puts them at the back of the line, so any payment in them that conflicts with the honest history loses.'
      : 'Released fast enough to count as honest, so it isn’t an attack. Hide for longer.';
    $('gHide').disabled = false; $('gRelease').disabled = true;
    drawGhost();
  });
  $('gReset').addEventListener('click', function () { hiding = false; gReset(); startAuto(); });
  var gIO = new IntersectionObserver(function (e) { if (e[0].isIntersecting) when('ghostCanvas', startAuto); else stopAuto(); });
  gIO.observe($('ghost'));
  function drawGhost() {
    var c = $('ghostCanvas'), f = fit(c), g = f.g, w = f.w, h = f.h;
    G.blocks.forEach(function (b) { delete b._gd; });
    var v = ghost(mk(tips(G.blocks)));
    var all = G.blocks.concat(G.secret);
    var maxL = Math.max.apply(null, all.map(function (b) { return b.layer; }));
    var span = Math.max(6, Math.floor(w / 62)), minL = Math.max(0, maxL - span + 1), dx = (w - 60) / Math.max(1, span - 1);
    var laneY = [24, 24 + (h - 48) / 2, h - 24];
    var byLayer = {};
    all.forEach(function (b) { (byLayer[b.layer] = byLayer[b.layer] || []).push(b); });
    Object.keys(byLayer).forEach(function (L) {
      var arr = byLayer[L]; arr.sort(function (a, b) { return (a.hidden ? 1 : 0) - (b.hidden ? 1 : 0) || a.id - b.id; });
      /* fixed swim lanes (two honest, one yours), so the canvas is used top to bottom and your lane is visible before you mine */
      var hi = 0;
      arr.forEach(function (b) { var lane = (b.mine || b.hidden) ? 2 : Math.min(1, hi++); b.x = 30 + (L - minL) * dx; b.y = laneY[lane]; });
    });
    g.clearRect(0, 0, w, h);
    var anyMine = all.some(function (b) { return (b.mine || b.hidden) && b.layer >= minL - 1; });
    if (!anyMine) {
      g.save(); g.strokeStyle = css('--orange'); g.globalAlpha = 0.35; g.setLineDash([4, 5]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(18, laneY[2]); g.lineTo(w - 18, laneY[2]); g.stroke(); g.setLineDash([]);
      g.globalAlpha = 0.9; g.fillStyle = css('--orange'); g.font = '500 12px ' + css('--mono'); g.textAlign = 'left'; g.textBaseline = 'bottom';
      g.fillText(G.released ? (w < 480 ? 'Your lane: your blocks are now off to the left' : 'Your lane: the blocks you released have scrolled off to the left') : (w < 480 ? 'Your lane: start mining to fill it' : 'Your lane: blocks you mine in secret appear here'), 18, laneY[2] - 6);
      g.restore();
    }
    var vis = function (b) { return b.layer >= minL - 1; };
    g.lineWidth = 1.2;
    all.forEach(function (b) {
      if (!vis(b)) return;
      b.parents.forEach(function (p) {
        g.strokeStyle = b.hidden ? css('--orange') : css('--line-bright'); g.globalAlpha = b.hidden ? 0.6 : 0.7;
        g.setLineDash(b.hidden ? [4, 4] : []);
        g.beginPath(); g.moveTo(b.x - 12, b.y); g.lineTo(p.x + 12, p.y); g.stroke();
      });
    });
    g.setLineDash([]); g.globalAlpha = 1;
    all.forEach(function (b) {
      if (!vis(b)) return;
      var isBlue = v.blue.has(b);
      g.fillStyle = b.hidden ? 'transparent' : (isBlue ? css('--cyan') : css('--red'));
      g.strokeStyle = b.hidden ? css('--orange') : 'transparent'; g.lineWidth = 2;
      g.beginPath(); g.roundRect ? g.roundRect(b.x - 12, b.y - 12, 24, 24, 5) : g.rect(b.x - 12, b.y - 12, 24, 24);
      g.fill(); if (b.hidden) g.stroke();
      g.fillStyle = b.hidden ? css('--orange') : css('--bg'); g.font = '600 10px ' + css('--mono'); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(b.hidden ? '?' : String(b.id), b.x, b.y + 0.5);
      if (b.mine && !b.hidden) { g.strokeStyle = css('--orange'); g.lineWidth = 1.5; g.strokeRect(b.x - 15, b.y - 15, 30, 30); }
    });
    /* scoreboard and verdict live in the DOM so they roll (NumberFlow) and reflow */
    var honest = G.blocks.filter(function (b) { return !b.mine; }).length, youN = G.secret.length || (G.released ? G.released.length : 0);
    KUI.num($('gHonest'), honest, null, fmt(honest)); KUI.num($('gYou'), youN, null, fmt(youN));
    $('gYou').previousElementSibling.textContent = G.secret.length ? 'Your hidden blocks' : (G.released ? 'Your released blocks' : 'Your blocks');
    var vd = $('gVerdict');
    if (G.released) {
      var red = G.released.filter(function (b) { return !v.blue.has(b); }).length, el = G.flashAt ? performance.now() - G.flashAt : 1e9;
      if (el < 700 && !reduced) {
        g.globalAlpha = 1 - el / 700; g.strokeStyle = css('--red'); g.lineWidth = 3;
        G.released.forEach(function (b) { if (vis(b)) { g.strokeRect(b.x - 18 - el / 30, b.y - 18 - el / 30, 36 + el / 15, 36 + el / 15); } });
        g.globalAlpha = 1; g.lineWidth = 1; requestAnimationFrame(drawGhost);
      }
      var vt = red ? 'Outvoted. ' + red + ' of ' + G.released.length + ' came out red.' : 'Too short to be an attack.';
      if (vd.textContent !== vt) { vd.textContent = vt; vd.className = 'verdict' + (red ? ' bad' : ''); }
    } else if (vd.textContent) { vd.textContent = ''; vd.className = 'verdict'; }
    var ord = v.order.slice(0, -1);
    $('gOrder').innerHTML = ord.slice(-28).map(function (b) { return v.blue.has(b) ? String(b.id) : '<span style="color:var(--red)">' + b.id + ' red</span>'; }).join(' → ');
  }
  var a0 = +params.get('atk'); if (a0 >= 5 && a0 <= 45) $('qAtk').value = a0; $('qAtkVal').textContent = Math.round(q() * 100) + '%';
  when('ghostCanvas', gReset);

  /* Chapter 3: coins vs one balance */
  var coinsBtn = $('coinsGo');
  function drawCoins(t, order) {
    var c = $('coinsCanvas'), f = fit(c), g = f.g, w = f.w, h = f.h;
    g.clearRect(0, 0, w, h);
    var font = css('--font'), muted = css('--muted'), green = css('--green'), orange = css('--orange');
    g.font = '13px ' + font; g.fillStyle = muted; g.textBaseline = 'middle'; g.textAlign = 'left';
    /* narrow screens: row names sit above their row so the five coins never run into them */
    var stack = w < 520, lab = stack ? 12 : Math.min(120, w * 0.28), colW = (w - lab - (stack ? 12 : 0)) / 3, gap = Math.min(24, (colW - 4) / 5), rad = Math.min(10, gap / 2 - 0.5);
    if (stack) { g.font = '12px ' + font; g.fillText('Separate coins', 0, 33); g.fillText('One balance', 0, 103); }
    else { g.fillText('Separate coins', 0, 55); g.fillText('One balance', 0, 125); }
    g.textAlign = 'center'; g.font = '12px ' + font;
    ['on the way', 'waiting', 'done'].forEach(function (s, k) { g.fillText(s, lab + colW * (k + 0.5), 14); });
    order = order || [0, 1, 2, 3, 4];
    /* order[k] = which payment (0..4) lands k-th; one lands every 0.4 s */
    var arrive = [], doneAt = [], prev = 0;
    order.forEach(function (p, k) { arrive[p] = 0.3 + 0.4 * k; });
    for (var p = 0; p < 5; p++) { doneAt[p] = Math.max(arrive[p], prev); prev = doneAt[p] + 0.05; }
    function dot(x, y, col, n) {
      g.fillStyle = col; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
      g.fillStyle = css('--bg'); g.font = '600 11px ' + font; g.fillText(String(n + 1), x, y + 0.5);
    }
    for (var i = 0; i < 5; i++) {
      var dx = (i - 2) * gap;
      /* coins: each is done as soon as it lands */
      var cc = t < arrive[i] ? 0 : 2;
      dot(lab + colW * (cc + 0.5) + dx, 55, cc === 2 ? green : muted, i);
      var bc = t < arrive[i] ? 0 : (t < doneAt[i] ? 1 : 2);
      dot(lab + colW * (bc + 0.5) + dx, 125, bc === 2 ? green : bc === 1 ? orange : muted, i);
    }
  }
  var coinsState = { t: 0, order: null };
  coinsBtn.addEventListener('click', function () {
    var arr = [0, 1, 2, 3, 4].sort(function () { return Math.random() - 0.5; });
    var t0 = performance.now();
    $('coinsOut').textContent = 'Five payments land in five parallel blocks, in random order.';
    (function tick(now) {
      var t = (now - t0) / 1000; drawCoins(t, arr);
      if (t < 2.6 && !reduced) requestAnimationFrame(tick);
      else { drawCoins(9, arr); coinsState = { t: 9, order: arr }; var waited = 0;
        var arrivedAt = []; arr.forEach(function (q, k) { arrivedAt[q] = k; });
        for (var q = 1; q < 5; q++) { var mx = -1; for (var r = 0; r < q; r++) mx = Math.max(mx, arrivedAt[r]); if (mx > arrivedAt[q]) waited++; }
        $('coinsOut').textContent = 'They landed in the order ' + arr.map(function (p) { return p + 1; }).join(', ') + '. Separate coins: all five done on landing. One balance: ' + waited + ' of five had to wait for a lower number.';}
    })(t0);
  });

  /* Chapter 5: insiders at launch */
  var FAIR = [['XRP', 100], ['Ethereum', 16.7], ['Cardano', 11.52], ['Bitcoin', 0], ['Kaspa', 0]];
  /* Waffle charts: Observable Plot's waffleY mark (ISC), one small chart per coin, 100 cells each. */
  /* Plot labels its groups with aria-label; the chart is described once on its container instead. */
  function quiet(svg) { svg.setAttribute('aria-hidden', 'true'); svg.querySelectorAll('[aria-label]').forEach(function (n) { n.removeAttribute('aria-label'); }); return svg; }
  function drawFair() {
    var box = $('fairPlot'); if (!window.Plot) return;
    var ins = css('--orange'), rest = css('--line-bright');
    box.textContent = '';
    FAIR.forEach(function (r) {
      var cell = document.createElement('div'); cell.className = 'waffle';
      var data = [{ c: 'x', who: 'insiders', v: r[1] }, { c: 'x', who: 'everyone else', v: 100 - r[1] }];
      cell.appendChild(quiet(Plot.plot({ width: 120, height: 120, margin: 0, x: { axis: null, padding: 0 }, y: { axis: null, domain: [0, 100] },
        color: { domain: ['insiders', 'everyone else'], range: [ins, rest] }, style: { background: 'transparent' },
        marks: [Plot.waffleY(data, { x: 'c', y: 'v', fill: 'who', unit: 1, multiple: 10, gap: 2 })] })));
      var cap = document.createElement('p'); cap.innerHTML = '<b>' + r[0] + '</b><span class="num">' + (r[1] % 1 ? r[1].toFixed(1) : r[1]) + ' of 100</span>';
      cell.appendChild(cap); box.appendChild(cell);
    });
  }

  /* Chapter 5: emission */
  var STEP_S = 2629800, R_NOW = 20.60172230, STEP_START = 2026.757, SUPPLY_NOW = 27.779e9, T_SUPPLY = 2026.82;
  var ratio = Math.pow(0.5, 1 / 12);
  function rate(y) { var n = Math.floor((y - STEP_START) * 365.25 * 86400 / STEP_S); return R_NOW * Math.pow(ratio, n); }
  function supplyAt(y) { // exact sum over the monthly steps (a coarse Riemann sum overshot the 28.704B cap)
    var YS = 365.25 * 86400, s = SUPPLY_NOW, t = T_SUPPLY;
    while (t < y) {
      var n = Math.floor((t - STEP_START) * YS / STEP_S), end = Math.min(y, STEP_START + (n + 1) * STEP_S / YS);
      s += rate(t) * (end - t) * YS; t = end + 1e-9;
    }
    return s;
  }
  var monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  function monthOf(y) { return monthFmt.format(new Date(Date.UTC(Math.floor(y), Math.floor((y % 1) * 12 + 1e-6), 1))); }
  function drawEmit() {
    var y = +$('yIn').value; setParam('y', y.toFixed(2));
    var month = monthOf(y);
    $('yVal').textContent = month;
    var box = $('emitPlot');
    if (window.Plot) {
      var wv = box.clientWidth || 600, data = [];
      for (var yy = 2026.76; yy <= 2040.001; yy += 1 / 48) data.push({ y: yy, r: rate(yy) });
      var fg = css('--muted'), green = css('--green');
      var plot = Plot.plot({ width: wv, height: wv < 560 ? 220 : 260, marginLeft: 44, marginBottom: 30, style: { background: 'transparent', color: fg, fontFamily: css('--mono'), fontSize: '11px' },
        x: { domain: [2026.7, 2040], ticks: wv < 560 ? [2027, 2031, 2035, 2039] : [2027, 2029, 2031, 2033, 2035, 2037, 2039], tickFormat: function (d) { return String(d); }, label: null },
        y: { domain: [0, 22], grid: true, label: 'KAS a second', ticks: [0, 5, 10, 15, 20] },
        marks: [
          Plot.areaY(data, { x: 'y', y: 'r', curve: 'step-after', fill: green, fillOpacity: 0.12 }),
          Plot.lineY(data, { x: 'y', y: 'r', curve: 'step-after', stroke: green, strokeWidth: 2 }),
          Plot.ruleX([y], { stroke: css('--text'), strokeOpacity: 0.5 }),
          Plot.dot([{ y: y, r: rate(y) }], { x: 'y', y: 'r', r: 5, fill: css('--text') }),
          Plot.text([{ y: y, r: rate(y) }], { x: 'y', y: 'r', text: function (d) { return fmt(d.r, 2) + ' KAS/s'; }, dy: -14, textAnchor: y > 2036 ? 'end' : 'start', dx: y > 2036 ? -8 : 8, fill: css('--text'), fontSize: 13 }),
          Plot.tip(data, Plot.pointerX({ x: 'y', y: 'r', title: function (d) { return monthOf(d.y) + ': ' + fmt(d.r, 2) + ' KAS a second'; } }))
        ] });
      plot.addEventListener('click', function () { if (plot.value) { $('yIn').value = Math.max(+$('yIn').min, Math.min(2040, plot.value.y)).toFixed(4); drawEmit(); } });
      box.replaceChildren(quiet(plot));
    }
    var s = supplyAt(y);
    $('emitOut').innerHTML = month + ': about <b>' + fmt(rate(y), 2) + ' KAS a second</b> to miners, and about <b>' + fmt(s / 1e9, 2) + ' billion</b> KAS in total. Dates are approximate; steps follow block count, not the calendar.';
  }
  var y0 = +params.get('y'); if (y0 >= +$('yIn').min && y0 <= 2040) $('yIn').value = y0;
  $('yIn').addEventListener('input', drawEmit);

  /* Chapter 5: who pays miners */
  function drawMiners() {
    var tps = +$('tpsIn').value, fee = +$('feeIn').value;
    $('tpsVal').textContent = fmt(tps); $('feeVal').textContent = fee.toFixed(3);
    setParam('tps', tps); setParam('fee', fee);
    var sub = R_NOW * 86400, fees = tps * fee * 86400, share = fees / (sub + fees);
    var box = $('minersPlot');
    if (window.Plot) {
      /* dumbbell on a log axis, adapted from the Observable Plot arrow-variation example:
         a share bar hides a 0.2% slice; a log axis shows both amounts and the gap between them */
      var wv = box.clientWidth || 600, narrow = wv < 560, lo = 100, hi = 1e9;
      var fx = Math.max(lo, Math.min(hi, fees)), gapX = fees > 0 ? sub / fees : Infinity;
      var green = css('--green'), orange = css('--orange'), muted = css('--muted');
      var gapTxt = fees <= 0 ? 'no fees' : gapX >= 1.05 ? (narrow ? '×' : 'fees ×') + fmt(gapX, gapX < 10 ? 1 : 0) + ' to match' : gapX <= 0.95 ? (narrow ? '' : 'fees already ') + fmt(1 / gapX, 1) + '× new coins' : 'about level';
      var pts = [{ k: 'New coins', v: sub, c: green, t: (narrow ? 'New coins ' : 'New coins: ') + fmtShort(sub) + ' KAS' }];
      if (fees > 0) pts.push({ k: 'Fees', v: fx, c: orange, t: (narrow ? 'Fees ' : 'Fees: ') + (fees < lo ? 'under 100' : fmtShort(fees)) + ' KAS' });
      var marks = [
        Plot.ruleY([0], { stroke: css('--line'), x1: lo, x2: hi }),
        Plot.ruleX([sub], { stroke: green, strokeOpacity: 0.35, strokeDasharray: '3,3', y1: -1, y2: 0 })
      ];
      var frac = function (v) { return Math.log(v / lo) / Math.log(hi / lo); };
      var px = (wv - 16) * Math.abs(frac(sub) - frac(fx));
      if (fees > 0) marks.push(Plot.arrow([{ a: fx, b: sub }], { x1: 'a', x2: 'b', y1: 0, y2: 0, stroke: muted, strokeWidth: 1.5, headLength: 8, inset: 9, bend: false }));
      var gapMark = null;
      if (fees > 0 && px > (narrow ? 130 : 190)) marks.push(gapMark = Plot.text([{ x: Math.sqrt(fx * sub) }], { x: 'x', y: 0, dy: -12, text: function () { return gapTxt; }, fill: muted, fontSize: 12 }));
      marks.push(Plot.dot(pts, { x: 'v', y: 0, r: 7, fill: 'c', stroke: css('--bg'), strokeWidth: 2 }));
      /* each label opens away from the arrow so the gap note never collides; if that side has no room, it flips */
      var fs = narrow ? 12 : 13, cw = fs * 0.62, X = function (v) { return 12 + (wv - 24) * frac(v); };
      pts.forEach(function (d) {
        var other = d.k === 'Fees' ? sub : fx, dir = fees > 0 && d.v !== other ? (d.v > other ? 1 : -1) : 0, tw = d.t.length * cw, x = X(d.v);
        if (dir === 0) { dir = x + tw / 2 > wv - 2 ? -1 : x - tw / 2 < 2 ? 1 : 0; }
        if (dir > 0 && x + 4 + tw > wv - 2) dir = -1;
        if (dir < 0 && x - 4 - tw < 2) dir = 1;
        if (d.k !== 'Fees' && fees > 0 && dir !== (sub > fx ? 1 : -1) && gapMark) marks.splice(marks.indexOf(gapMark), 1);
        marks.push(Plot.text([d], { x: 'v', y: 0, dy: d.k === 'Fees' ? 21 : -19, dx: dir * 4, text: 't', fill: d.c, fontSize: fs, fontWeight: 600, textAnchor: dir > 0 ? 'start' : dir < 0 ? 'end' : 'middle' }));
      });
      box.replaceChildren(quiet(Plot.plot({ width: wv, height: 140, marginLeft: 12, marginRight: 12, marginTop: 30, marginBottom: 50,
        style: { background: 'transparent', color: muted, fontFamily: css('--mono'), fontSize: '11px', overflow: 'visible' },
        x: { type: 'log', domain: [lo, hi], ticks: narrow ? [1e2, 1e4, 1e6, 1e8] : [1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9], tickFormat: fmtShort, label: 'KAS a day (log scale: each step is ×10)', labelAnchor: 'left', labelOffset: 38 },
        y: { axis: null, domain: [-1, 1] },
        marks: marks })));
    }
    $('minersOut').innerHTML = 'Per day: <b>' + fmt(sub) + ' KAS</b> in new coins, <b>' + fmt(fees) + ' KAS</b> in fees. Fees are <b>' + fmt(share * 100, 1) + '%</b> of what miners earn. These are your guesses, not measurements.';
    $('minersGap').textContent = fee > 0 ? 'Arithmetic, not a forecast: at this fee, fees alone would match today’s new coins at about ' + fmt(R_NOW / fee) + ' transactions a second, every second.' : 'At a zero fee, no number of transactions replaces the new coins.';
  }
  ['tps', 'fee'].forEach(function (k) { var v = params.get(k); if (v !== null) $(k + 'In').value = v; $(k + 'In').addEventListener('input', drawMiners); });

  /* Chapter 6: read-only transaction lookup */
  $('txGo').addEventListener('click', function () {
    var id = $('txIn').value.trim().toLowerCase(), out = $('txOut');
    if (!/^[0-9a-f]{64}$/.test(id)) { out.textContent = 'That doesn’t look like a transaction id. It should be 64 characters, 0-9 and a-f.'; return; }
    out.textContent = 'Asking the network…';
    getJSON(API + '/transactions/' + id + '?resolve_previous_outpoints=no').then(function (tx) {
      var when = tx.block_time ? new Date(tx.block_time).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' }) + ' your time' : 'unknown time';
      var total = (tx.outputs || []).reduce(function (a, o) { return a + (+o.amount || 0); }, 0) / 1e8;
      out.innerHTML = (tx.is_accepted ? 'Accepted' : 'In a block, not yet accepted (give it a few seconds)') + ' · first in a block at ' + when +
        ' · outputs total ' + fmt(total, 4) + ' KAS · <a href="' + API + '/transactions/' + id + '">raw record on api.kaspa.org</a>';
    }).catch(function () { out.textContent = 'Not found, or the API could not be reached. New transactions can take a few seconds to show up.'; });
  });

  $('txRecent').addEventListener('click', function () {
    var K = window.KLive, best = null;
    if (K && K.ok && !K.sim) K.blocks.forEach(function (b) { if (b.tid && b.chain && b.t < K.newest - 20000 && (!best || b.t > best.t)) best = b; });
    if (!best) { $('txOut').textContent = 'Nothing real to hand yet: the live feed isn’t connected, or no block has settled long enough. Paste an id instead.'; return; }
    $('txIn').value = best.tid; $('txGo').click();
  });

  /* Chapter 4: the duel. Kaspa side counts real blocks; Bitcoin side waits for real Bitcoin blocks. */
  var duel = null, btcTip = null;
  function btcPoll() {
    getJSON('https://mempool.space/api/v1/blocks').then(function (r) { btcTip = { h: r[0].height, t: r[0].timestamp * 1000 }; }).catch(function () {});
  }
  btcPoll(); setInterval(btcPoll, 30000);
  /* One log-scale ruler for both clocks: d3 scaleLog + axis (ISC). 0.1 s to 2 h. */
  var TR = null;
  function buildTrack() {
    var fig = $('track'); if (!window.d3 || !fig) return;
    var w = fig.clientWidth, narrow = w < 560, h = narrow ? 132 : 120;
    if (w < 120) return; /* not laid out (closed or not yet rendered); drawn when it is */
    var svg = d3.select('#trackSvg').attr('viewBox', '0 0 ' + w + ' ' + h).attr('width', w).attr('height', h);
    svg.selectAll('*').remove();
    var x = d3.scaleLog().domain([0.1, 7200]).range([14, w - 14]), axisY = h - 26;
    var kY = narrow ? 40 : 38, bY = narrow ? 76 : 70;
    svg.append('rect').attr('x', x(1)).attr('width', x(3) - x(1)).attr('y', 6).attr('height', axisY - 6).attr('fill', 'var(--green)').attr('opacity', 0.18);
    svg.append('line').attr('x1', x(3600)).attr('x2', x(3600)).attr('y1', 6).attr('y2', axisY).attr('stroke', 'var(--orange)').attr('stroke-dasharray', '3 3');
    svg.append('text').attr('x', x(3) + 6).attr('y', 18).attr('class', 'tl').text(narrow ? 'Kaspa: 1 to 3 s' : 'Kaspa settles: 1 to 3 s');
    svg.append('text').attr('x', x(3600) - 6).attr('y', narrow ? 34 : 18).attr('text-anchor', 'end').attr('class', 'tl').text(narrow ? 'Bitcoin: ~1 h' : 'Bitcoin, six blocks: about 1 h');
    var ax = svg.append('g').attr('transform', 'translate(0,' + axisY + ')').attr('class', 'tax')
      .call(d3.axisBottom(x).tickValues([0.1, 1, 10, 60, 600, 3600]).tickFormat(function (v) { return { 0.1: '0.1 s', 1: '1 s', 10: '10 s', 60: '1 min', 600: '10 min', 3600: '1 h' }[v]; }).tickSizeOuter(0));
    ax.select('.domain').attr('stroke', 'var(--line-bright)'); ax.selectAll('line').attr('stroke', 'var(--line-bright)');
    var mk = function (y, col, name) {
      var g = svg.append('g').attr('class', 'tmark').attr('opacity', 0);
      g.append('line').attr('y1', y).attr('y2', axisY).attr('stroke', col).attr('stroke-width', 1.5);
      g.append('circle').attr('cy', y).attr('r', 6).attr('fill', col);
      g.append('text').attr('y', y - 10).attr('class', 'tl strong').text(name);
      return g;
    };
    TR = { x: x, w: w, k: mk(kY, 'var(--green)', 'Kaspa'), b: mk(bY, 'var(--orange)', 'Bitcoin') };
    if (TR.last) moveTrack.apply(null, TR.last);
  }
  function moveTrack(ks, bs) {
    if (!TR) return; TR.last = [ks, bs];
    [[TR.k, ks], [TR.b, bs]].forEach(function (p) {
      var xv = TR.x(Math.max(0.1, Math.min(7200, p[1]))), g = p[0];
      g.attr('opacity', 1).attr('transform', 'translate(' + xv + ',0)');
      g.select('text').attr('text-anchor', xv > TR.w - 70 ? 'end' : xv < 70 ? 'start' : 'middle');
    });
  }
  function mmss(ms) { var s = Math.floor(Math.max(0, ms) / 1000); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  $('dGo').addEventListener('click', function () {
    duel = { id: (duel ? duel.id : 0) + 1, t0: performance.now(), wall: Date.now(), fast: false, btcH0: btcTip ? btcTip.h : null };
    $('dFast').hidden = false; $('dGo').textContent = 'Pay again'; $('dKpile').textContent = ''; $('dBfastTag').textContent = '\u00a0';
    var run = duel.id;
    (function step(now) {
      if (!duel || duel.id !== run) return; var d = duel, t = Math.max(0, now - d.t0);
      var KS = 3000, k = Math.min(1, t / KS);
      $('dKclock').textContent = (Math.min(t, KS) / 1000).toFixed(1) + ' s';
      $('dKfill').style.width = (k * 100) + '%';
      var kBlocks = window.KLive && KLive.ok ? KLive.countSince(d.wall) : null;
      var kTxt = kBlocks === null ? '' : ' Real Kaspa blocks mined since you pressed: <b class="num">' + fmt(kBlocks) + '</b>' + (k < 1 || t < 9000 ? ' (they reach this page a few seconds late)' : '') + '.';
      var pile = $('dKpile'), have = pile.childElementCount, want = kBlocks === null ? 0 : Math.min(kBlocks, 900);
      for (; have < want; have++) pile.appendChild(document.createElement('i'));
      $('dKout').innerHTML = (k < 1 ? 'Confirming.' : '<b>Done.</b> Settled within Sompolinsky’s 1 to 3 seconds.') + kTxt;
      var bt = d.fast ? d.fastT + (now - d.fastAt) * 600 : t;
      var conf = d.fast ? Math.min(6, Math.floor(bt / 600000)) : (btcTip && d.btcH0 !== null ? Math.max(0, btcTip.h - d.btcH0) : 0);
      $('dBclock').textContent = mmss(Math.min(bt, 3600000)); $('dBfastTag').textContent = d.fast ? '×600 speed' : '\u00a0';
      $('dBfill').style.width = (Math.min(6, conf) / 6 * 100) + '%';
      document.querySelectorAll('#dBslots i').forEach(function (el, i) { el.classList.toggle('on', i < conf); });
      var since = btcTip ? (Date.now() - btcTip.t < 1000 ? 'moments' : mmss(Date.now() - btcTip.t)) : null;
      $('dBout').innerHTML = conf >= 6 ? '<b>Settled.</b> Six confirmations.' : (d.fast ? conf + ' of 6 confirmations. Simulated at the average pace, one block per ten minutes.' :
        'Waiting for the next real Bitcoin block' + (since ? ': the last one, #' + fmt(btcTip.h) + ', was ' + since + ' ago.' : '.') + ' Then five more.');
      moveTrack(Math.min(t, KS) / 1000, Math.min(bt, 3600000 * 2) / 1000);
      if (conf < 6) requestAnimationFrame(step);
    })(duel.t0);
  });
  $('dFast').addEventListener('click', function () { if (!duel) return; duel.fast = true; duel.fastAt = performance.now(); duel.fastT = performance.now() - duel.t0; $('dFast').hidden = true; });

  /* Chapter 7: rob the vault */
  var VAULT = {
    steal: 'Rejected. Every miner checked the rule: this coin may only go to the cold wallet before the lock date. Having the key was not enough.',
    split: 'Rejected. The rule wants all of it to go to cold storage. Half doesn’t count. Sneaky, though.',
    cold: 'Accepted. That is exactly what the rule allows. The owner is now very safe, and you have achieved nothing.',
    wait: 'Accepted, once the date has passed. That is the other path the owner wrote. Real vaults pair this with a long delay so the owner can react first.'
  };
  /* The coin is dragged with interact.js (MIT) onto drop zones; the zones are also plain buttons. */
  var RULES = { steal: ['fail', ''], split: ['fail', ''], cold: ['pass', ''], wait: ['', 'pass'] };
  var coin = $('vCoin'), cx = 0, cy = 0, dropped = false;
  function place(x, y, animate, sc) {
    var from = coin.style.transform || 'translate(0px,0px) scale(1)', to = 'translate(' + x + 'px,' + y + 'px) scale(' + (sc || 1) + ')';
    cx = x; cy = y; coin.style.transform = to;
    if (animate && !reduced && coin.animate) coin.animate([{ transform: from }, { transform: to }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  function judge(move, zone) {
    $('vaultOut').textContent = VAULT[move];
    var r = RULES[move];
    $('ruleCold').className = r[0]; $('ruleDate').className = r[1];
    document.querySelectorAll('.zone').forEach(function (z) { z.classList.toggle('picked', z === zone); z.classList.toggle('no', z === zone && r[0] === 'fail'); });
    var zr = zone.getBoundingClientRect();
    var op = (coin.offsetParent || coin.parentElement).getBoundingClientRect(), bx = op.left + coin.offsetLeft, by = op.top + coin.offsetTop;
    /* Land on the zone's right edge, shrunk, so the move's label stays readable. */
    var cw = coin.offsetWidth, chh = coin.offsetHeight;
    place(zr.right - 30 - cw / 2 - bx, zr.top + zr.height / 2 - chh / 2 - by, true, 0.56);
    if (r[0] === 'fail') setTimeout(function () { place(0, 0, true); }, reduced ? 0 : 700);
  }
  document.querySelectorAll('[data-try]').forEach(function (b) {
    b.addEventListener('click', function () { judge(b.dataset.try, b); });
  });
  if (window.interact) {
    interact(coin).draggable({ listeners: {
      start: function () { dropped = false; coin.classList.add('drag'); },
      move: function (e) { place(cx + e.dx, cy + e.dy, false); },
      end: function () { coin.classList.remove('drag'); setTimeout(function () { if (!dropped) place(0, 0, true); }, 0); }
    } });
    interact('.zone').dropzone({ accept: '#vCoin', overlap: 'pointer',
      ondragenter: function (e) { e.target.classList.add('over'); },
      ondragleave: function (e) { e.target.classList.remove('over'); },
      ondrop: function (e) { dropped = true; e.target.classList.remove('over'); judge(e.target.dataset.try, e.target); } });
  }

  /* Finish: copy the two sentences */
  $('copy').addEventListener('click', function () {
    var t = $('mine').value;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { $('copyOut').textContent = 'Copied.'; })
      .catch(function () { $('mine').select(); $('copyOut').textContent = 'Selected. Press copy on your keyboard.'; });
    store.set('ke-two', t);
  });
  var saved = store.get('ke-two', null); if (saved) $('mine').value = saved;

  /* Moose shelf: first-page covers, added by script so the guest section's HTML stays exactly as supplied. */
  (function () {
    var acts = document.querySelectorAll('#moose .actions');
    function covers(before, list) {
      if (!before) return;
      var ul = document.createElement('ul'); ul.className = 'covers';
      list.forEach(function (c) {
        var li = document.createElement('li'), a = document.createElement('a'), img = document.createElement('img');
        a.href = c[0]; img.src = c[1]; img.alt = 'First page of ' + c[2]; img.width = 132; img.height = 176; img.loading = 'lazy'; img.decoding = 'async';
        a.appendChild(img); a.appendChild(document.createTextNode(c[3])); li.appendChild(a); ul.appendChild(li);
      });
      before.parentNode.insertBefore(ul, before);
    }
    covers(acts[1], [['files/satoshis-engine.pdf', 'img/cover-satoshis-engine.jpg', 'Satoshi’s Engine, English edition', 'English, 89 pages'],
      ['files/satoshis-motor-svenska.pdf', 'img/cover-satoshis-motor-svenska.jpg', 'the Swedish edition', 'Svenska, 88 pages'],
      ['files/satoshis-engine-companion.pdf', 'img/cover-satoshis-engine-companion.jpg', 'The Loops Inside the Engine', 'Companion, 6 pages']]);
    covers(acts[2], [['files/the-instrument.pdf', 'img/cover-the-instrument.jpg', 'The Instrument', '279 pages']]);
  })();

  var drawCoinsNow = function () { drawCoins(coinsState.t, coinsState.order); };
  function redrawAll() { when('ghostCanvas', drawGhost); when('coinsCanvas', drawCoinsNow); when('fairPlot', drawFair); when('emitPlot', drawEmit); when('tpsIn', drawMiners); when('track', buildTrack); }
  document.querySelectorAll('details').forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) redrawAll(); }); });
  redrawAll();
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(redrawAll, 120); });
})();
