/* Deep-dive pages: theme, glossary popovers, the back link, reading progress, and one interactive per page.
   Plain JS and canvas, no libraries. Every number is either computed from a stated rule or read from a
   recorded, dated file in /data. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  function css(v) { return getComputedStyle(root).getPropertyValue(v).trim(); }
  function fmt(n, d) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  var redraws = [];
  function redrawAll() { redraws.forEach(function (f) { f(); }); }
  function fit(c) {
    var h = +c.getAttribute('height'); c.style.height = h + 'px';
    var dpr = window.devicePixelRatio || 1, w = c.clientWidth;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g: g, w: w, h: h };
  }

  /* Theme */
  var themeBtn = $('theme');
  function paintTheme() { themeBtn.textContent = root.dataset.theme === 'dark' ? 'Day' : 'Night'; }
  themeBtn.addEventListener('click', function () {
    var night = root.dataset.theme !== 'dark';
    if (night) root.dataset.theme = 'dark'; else delete root.dataset.theme;
    try { if (night) localStorage.setItem('ke-theme2', 'dark'); else localStorage.removeItem('ke-theme2'); } catch (e) {}
    document.querySelector('meta[name="theme-color"]').setAttribute('content', night ? '#181612' : '#f5f1e8');
    paintTheme(); redrawAll();
  });
  paintTheme();

  /* Back: return to the exact scroll spot when we came from the main page. */
  var back = document.querySelector('[data-back]');
  if (back) back.addEventListener('click', function (e) {
    try {
      var ref = new URL(document.referrer);
      var main = new URL('../../', location.href);
      if (ref.origin === location.origin && ref.pathname === main.pathname && history.length > 1) { e.preventDefault(); history.back(); }
    } catch (err) {}
  });

  /* Reading progress (transform only) */
  var prog = $('progress');
  function onScroll() { var m = document.documentElement.scrollHeight - innerHeight; prog.style.transform = 'scaleX(' + (m > 0 ? Math.min(1, scrollY / m) : 0) + ')'; }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  /* Glossary popovers, same behaviour as the main page */
  var pop = null, popFor = null, pinned = false;
  function closePop() { if (pop) { pop.remove(); pop = null; if (popFor) { popFor.setAttribute('aria-expanded', 'false'); popFor.removeAttribute('aria-describedby'); } popFor = null; pinned = false; } }
  function openPop(btn) {
    closePop();
    pop = document.createElement('div'); pop.className = 'pop'; pop.id = 'pop'; pop.setAttribute('role', 'tooltip');
    pop.textContent = btn.getAttribute('data-pop'); document.body.appendChild(pop);
    var r = btn.getBoundingClientRect(), pw = pop.offsetWidth;
    pop.style.left = Math.min(Math.max(8, r.left + scrollX + r.width / 2 - pw / 2), root.clientWidth - pw - 8) + 'px';
    pop.style.top = (r.bottom + scrollY + 8) + 'px';
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
  addEventListener('scroll', closePop, { passive: true });

  /* Shared emission maths: the same constants as the main page (js/site.js). */
  var STEP_S = 2629800, R_NOW = 20.60172230, STEP_START = 2026.757, SUPPLY_NOW = 27.779e9, T_SUPPLY = 2026.82, MAX = 28704035605;
  var ratio = Math.pow(0.5, 1 / 12), YS = 365.25 * 86400;
  function rate(y) { var n = Math.floor((y - STEP_START) * YS / STEP_S); return R_NOW * Math.pow(ratio, n); }
  function supplyAt(y) {
    var s = SUPPLY_NOW, t = T_SUPPLY;
    while (t < y) { var n = Math.floor((t - STEP_START) * YS / STEP_S), end = Math.min(y, STEP_START + (n + 1) * STEP_S / YS); s += rate(t) * (end - t) * YS; t = end + 1e-9; }
    return Math.min(s, MAX);
  }
  var NOW_Y = 2026.83;
  function yLabel(y) { return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Math.floor(y), Math.floor((y % 1) * 12 + 1e-6), 1))); }
  function axes(g, w, h, pad, xt, yt) {
    g.strokeStyle = css('--line-bright'); g.lineWidth = 1;
    g.beginPath(); g.moveTo(pad.l, pad.t); g.lineTo(pad.l, h - pad.b); g.lineTo(w - pad.r, h - pad.b); g.stroke();
    g.fillStyle = css('--faint'); g.font = '12px ' + css('--mono');
    xt.forEach(function (t) { g.textAlign = 'center'; g.fillText(t[1], t[0], h - pad.b + 16); g.fillRect(t[0], h - pad.b, 1, 4); });
    yt.forEach(function (t) { g.textAlign = 'right'; g.fillText(t[1], pad.l - 6, t[0] + 4); });
  }
  function onResize(f) { var tm; addEventListener('resize', function () { clearTimeout(tm); tm = setTimeout(f, 120); }); redraws.push(f); }
  /* Pointer helper: drag or tap on a canvas without hijacking vertical scroll on touch. */
  function pointer(c, fn) {
    var down = false;
    c.style.touchAction = 'pan-y';
    c.addEventListener('pointerdown', function (e) { down = true; fn(e); });
    c.addEventListener('pointermove', function (e) { if (down || e.pointerType === 'mouse') fn(e); });
    addEventListener('pointerup', function () { down = false; });
  }

  var inter = {};

  /* ---------- DAG: past, future, anticone on real blocks ---------- */
  inter.cone = function () {
    var c = $('coneCanvas'), win = $('coneWin'), out = $('coneOut'), B = null, sel = -1, view = null;
    fetch('../../data/order-sample.json').then(function (r) { return r.json(); }).then(function (d) {
      var LANES = 9, busy = [];
      B = d.b.map(function (r, i) {
        var t = d.t0 + r[1], seed = parseInt(r[0].slice(0, 6), 16) % LANES, ln = seed;
        for (var k = 0; k < LANES; k++) { var cc = (seed + (k % 2 ? 1 : -1) * Math.ceil(k / 2) + LANES * 4) % LANES; if (!busy[cc] || Math.abs(busy[cc] - t) > 260) { ln = cc; break; } }
        busy[ln] = t;
        return { i: i, h: r[0], t: r[1], p: r[3].filter(function (x) { return x >= 0; }), lane: ln, kids: [] };
      });
      B.forEach(function (b) { b.p.forEach(function (x) { B[x].kids.push(b.i); }); });
      $('coneTag').textContent = B.length + ' real blocks recorded from api.kaspa.org, ' + new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(d.t0)) + '.';
      /* Start on a block with a typical, non-empty anticone near the middle. */
      var mid = B.filter(function (b) { return b.t > 11000 && b.t < 14000; });
      sel = mid.length ? mid[Math.floor(mid.length / 2)].i : Math.floor(B.length / 2);
      win.value = Math.round((B[sel].t - 3000) / (B[B.length - 1].t - 6000) * 1000);
      draw();
    }).catch(function () { out.textContent = 'The recorded blocks didn’t load. Reload the page to try again.'; });
    function reach(i, key) { var seen = new Set(), st = [i]; while (st.length) { var x = st.pop(); B[x][key].forEach(function (y) { if (!seen.has(y)) { seen.add(y); st.push(y); } }); } return seen; }
    function draw() {
      if (!B) return;
      var f = fit(c), g = f.g, w = f.w, h = f.h, span = w < 560 ? 4000 : 7000;
      var t0 = +win.value / 1000 * (B[B.length - 1].t - span), t1 = t0 + span;
      var X = function (t) { return 14 + (t - t0) / span * (w - 28); }, Y = function (b) { return 18 + b.lane * (h - 36) / 8; };
      /* Scrubbing keeps a block selected: if it slides out of view, pick the one nearest the middle. */
      if (B[sel].t < t0 || B[sel].t > t1) { var m = (t0 + t1) / 2, bi = sel, bd2 = Infinity; B.forEach(function (b) { var d = Math.abs(b.t - m); if (d < bd2) { bd2 = d; bi = b.i; } }); sel = bi; }
      var past = reach(sel, 'p'), fut = reach(sel, 'kids');
      /* The anticone is local in time; beyond 4 s, a block outside both groups only means the recording was cut there. */
      var T = B[sel].t, isAnti = function (b) { return b.i !== sel && !past.has(b.i) && !fut.has(b.i) && Math.abs(b.t - T) < 4000; };
      var col = function (b) { return b.i === sel ? css('--text') : past.has(b.i) ? css('--green') : fut.has(b.i) ? css('--muted') : isAnti(b) ? css('--orange') : css('--line-bright'); };
      g.clearRect(0, 0, w, h);
      g.lineWidth = 1;
      B.forEach(function (b) {
        if (b.t < t0 - 2500 || b.t > t1 + 2500) return;
        b.p.forEach(function (x) {
          var a = B[x], hot = (b.i === sel || past.has(b.i)) && (past.has(x));
          g.strokeStyle = hot ? css('--green') : css('--line'); g.globalAlpha = hot ? 0.7 : 0.8;
          g.beginPath(); g.moveTo(X(b.t), Y(b)); g.lineTo(X(a.t), Y(a)); g.stroke();
        });
      });
      g.globalAlpha = 1;
      var shown = [];
      B.forEach(function (b) {
        if (b.t < t0 - 200 || b.t > t1 + 200) return;
        var x = X(b.t), y = Y(b), s = b.i === sel ? 12 : 9;
        g.fillStyle = col(b); g.fillRect(x - s / 2, y - s / 2, s, s);
        if (b.i === sel) { g.strokeStyle = css('--text'); g.lineWidth = 2; g.strokeRect(x - 10, y - 10, 20, 20); g.lineWidth = 1; }
        shown.push({ i: b.i, x: x, y: y });
      });
      view = shown;
      var anti = B.filter(isAnti).length, end = B[B.length - 1].t, edge = T < 4000 || T > end - 4000;
      out.innerHTML = 'This block builds on <b>' + fmt(past.size) + '</b> earlier blocks (its past) and <b>' + fmt(fut.size) + '</b> later blocks build on it (its future). <b>' + anti + '</b> ' + (anti === 1 ? 'was' : 'were') + ' made at about the same time without either seeing the other: its anticone. On a chain, those would be thrown away.' + (edge ? ' (This block is near the edge of the recording, so some of its past or future is cut off.)' : '');
    }
    pointer(c, function (e) {
      if (!view) return; var r = c.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, best = null, bd = 26 * 26;
      view.forEach(function (v) { var d = (v.x - mx) * (v.x - mx) + (v.y - my) * (v.y - my); if (d < bd) { bd = d; best = v; } });
      if (best && best.i !== sel) { sel = best.i; draw(); }
    });
    win.addEventListener('input', draw);
    onResize(draw);
  };

  /* ---------- Security: Nakamoto's catch-up odds ---------- */
  function nakamoto(q, z) {
    var p = 1 - q, lam = z * (q / p), sum = 1, pois = Math.exp(-lam);
    for (var k = 0; k <= z; k++) { if (k > 0) pois *= lam / k; sum -= pois * (1 - Math.pow(q / p, z - k)); }
    return Math.max(0, sum);
  }
  inter.race = function () {
    var c = $('raceCanvas'), qIn = $('qIn');
    function draw() {
      var q = +qIn.value / 100; $('qVal').textContent = Math.round(q * 100) + '%';
      var zz = 0; while (zz < 2000 && nakamoto(q, zz) > 0.001) zz++;
      var mins = zz * 10, span = Math.max(120, Math.ceil(mins / 60) * 60 + 60);
      var f = fit(c), g = f.g, w = f.w, h = f.h, pad = { l: 44, r: 12, t: 10, b: 26 };
      g.clearRect(0, 0, w, h);
      var X = function (m) { return pad.l + (w - pad.l - pad.r) * m / span; }, Y = function (P) { return pad.t + (h - pad.t - pad.b) * (1 - P); };
      var xt = []; for (var m = 0; m <= span; m += span > 360 ? 120 : span > 180 ? 60 : 30) xt.push([X(m), m < 60 ? m + ' min' : (m / 60) + ' h']);
      axes(g, w, h, pad, xt, [[Y(1), '100%'], [Y(0.5), '50%'], [Y(0), '0%']]);
      g.strokeStyle = css('--orange'); g.lineWidth = 2; g.beginPath();
      for (var mm = 0; mm <= span; mm++) { var P = nakamoto(q, Math.floor(mm / 10)); if (mm === 0) g.moveTo(X(mm), Y(P)); else g.lineTo(X(mm), Y(P)); }
      g.stroke();
      g.setLineDash([3, 4]); g.strokeStyle = css('--text'); g.lineWidth = 1; g.beginPath(); g.moveTo(X(mins), pad.t); g.lineTo(X(mins), h - pad.b); g.stroke(); g.setLineDash([]);
      g.fillStyle = css('--green'); g.beginPath(); g.arc(X(0) + 3, Y(0) - 3, 5, 0, 7); g.fill();
      g.font = '13px ' + css('--font'); g.textAlign = 'left'; g.fillText('Kaspa: seconds', X(0) + 12, Y(0) - 10);
      var t = mins >= 120 ? fmt(mins / 60, 1) + ' h' : mins + ' min';
      $('raceBig').textContent = t;
      $('raceOut').innerHTML = 'Against an attacker with ' + Math.round(q * 100) + '% of all mining, Bitcoin needs <b>' + zz + ' blocks</b>, about <b>' + t + '</b>, before the chance of reversal falls under 0.1%.';
    }
    qIn.addEventListener('input', draw); onResize(draw); draw();
  };

  /* ---------- Supply: year scrubber ---------- */
  inter.supply = function () {
    var c = $('supCanvas'), yr = $('supYear'), pts = [];
    for (var y = NOW_Y; y <= 2060.01; y += 1 / 12) pts.push([y, supplyAt(y)]);
    function draw() {
      var Yr = +yr.value, f = fit(c), g = f.g, w = f.w, h = f.h, pad = { l: 46, r: 12, t: 12, b: 26 };
      var lo = 27.6e9, hi = 28.75e9;
      var X = function (y) { return pad.l + (w - pad.l - pad.r) * (y - NOW_Y) / (2060 - NOW_Y); }, Y = function (s) { return pad.t + (h - pad.t - pad.b) * (1 - (s - lo) / (hi - lo)); };
      g.clearRect(0, 0, w, h);
      axes(g, w, h, pad, [[X(2030), '2030'], [X(2040), '2040'], [X(2050), '2050'], [X(2060), '2060']], [[Y(28.7e9), '28.7B'], [Y(28.2e9), '28.2B'], [Y(27.7e9), '27.7B']]);
      g.setLineDash([2, 4]); g.strokeStyle = css('--faint'); g.beginPath(); g.moveTo(pad.l, Y(MAX)); g.lineTo(w - pad.r, Y(MAX)); g.stroke(); g.setLineDash([]);
      g.strokeStyle = css('--green'); g.lineWidth = 2; g.beginPath();
      pts.forEach(function (p, i) { if (i === 0) g.moveTo(X(p[0]), Y(p[1])); else g.lineTo(X(p[0]), Y(p[1])); }); g.stroke();
      var s = supplyAt(Yr); g.fillStyle = css('--text'); g.beginPath(); g.arc(X(Yr), Y(s), 5, 0, 7); g.fill();
      $('supYearVal').textContent = yLabel(Yr);
      $('supOut').textContent = (s / 1e9).toFixed(3) + 'B';
      $('supPct').textContent = (s / MAX * 100).toFixed(2) + '%';
      var r = rate(Yr); $('supRate').textContent = r >= 0.1 ? fmt(r, 2) + ' KAS' : r >= 0.001 ? fmt(r, 4) + ' KAS' : '< 0.001 KAS';
    }
    yr.addEventListener('input', draw); onResize(draw); draw();
  };

  /* ---------- Fees: the break-even fee ---------- */
  inter.fees = function () {
    var c = $('feeCanvas'), tpsIn = $('feeTps'), yIn = $('feeYear');
    function need(y, tps) { return Math.max(0, R_NOW - rate(y)) / tps; }
    function draw() {
      var tps = Math.round(Math.pow(10, +tpsIn.value)), Yr = +yIn.value;
      $('feeTpsVal').textContent = fmt(tps); $('feeYearVal').textContent = Yr;
      var f = fit(c), g = f.g, w = f.w, h = f.h, pad = { l: 58, r: 12, t: 12, b: 26 }, top = R_NOW / tps * 1.08;
      var X = function (y) { return pad.l + (w - pad.l - pad.r) * (y - NOW_Y) / (2060 - NOW_Y); }, Y = function (v) { return pad.t + (h - pad.t - pad.b) * (1 - v / top); };
      var nf = function (v) { return v >= 1 ? fmt(v, v >= 10 ? 0 : 1) : v >= 0.01 ? v.toFixed(2) : v.toFixed(4); };
      g.clearRect(0, 0, w, h);
      axes(g, w, h, pad, [[X(2030), '2030'], [X(2040), '2040'], [X(2050), '2050'], [X(2060), '2060']], [[Y(R_NOW / tps), nf(R_NOW / tps)], [Y(R_NOW / tps / 2), nf(R_NOW / tps / 2)], [Y(0), '0']]);
      g.strokeStyle = css('--orange'); g.lineWidth = 2; g.beginPath();
      for (var y = NOW_Y, i = 0; y <= 2060; y += 1 / 12, i++) { if (i === 0) g.moveTo(X(y), Y(need(y, tps))); else g.lineTo(X(y), Y(need(y, tps))); }
      g.stroke();
      var v = need(Yr + 0.5, tps); g.fillStyle = css('--text'); g.beginPath(); g.arc(X(Yr + 0.5), Y(v), 5, 0, 7); g.fill();
      $('feeBig').textContent = nf(v) + ' KAS';
      $('feeOut').innerHTML = 'In ' + Yr + ', new coins pay about <b>' + fmt(rate(Yr + 0.5), 2) + ' KAS a second</b>, against <b>' + fmt(R_NOW, 1) + '</b> today. To make up the gap at ' + fmt(tps) + ' payments a second, each needs an average fee of about <b>' + nf(v) + ' KAS</b>.';
    }
    tpsIn.addEventListener('input', draw); yIn.addEventListener('input', draw); onResize(draw); draw();
  };

  /* ---------- Price: a recorded year ---------- */
  inter.price = function () {
    var c = $('pxCanvas'), P = null, pick = -1;
    var dayF = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    fetch('../../data/kas-365d.json').then(function (r) { return r.json(); }).then(function (d) {
      P = d.prices; pick = 0;
      $('pxTag').textContent = 'Daily prices in US dollars from the CoinGecko API, recorded ' + new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(d.recorded)) + '. Not live.';
      draw();
    }).catch(function () { $('pxTag').textContent = 'The recorded prices didn’t load. Reload the page to try again.'; });
    var geo = null;
    function draw() {
      if (!P) return;
      var f = fit(c), g = f.g, w = f.w, h = f.h, pad = { l: 56, r: 12, t: 12, b: 26 };
      var lo = Infinity, hi = 0; P.forEach(function (p) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
      lo *= 0.9; hi *= 1.05;
      var t0 = P[0][0], t1 = P[P.length - 1][0];
      var X = function (t) { return pad.l + (w - pad.l - pad.r) * (t - t0) / (t1 - t0); }, Y = function (v) { return pad.t + (h - pad.t - pad.b) * (1 - (v - lo) / (hi - lo)); };
      geo = { X: X, t0: t0, t1: t1, pad: pad, w: w };
      g.clearRect(0, 0, w, h);
      var xt = []; var dt = (t1 - t0) / 4; for (var k = 0; k <= 4; k++) { var tt = t0 + dt * k; xt.push([X(tt), new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(tt))]); }
      var yt = [hi / 1.05, (hi / 1.05 + lo / 0.9) / 2, lo / 0.9].map(function (v) { return [Y(v), '$' + v.toFixed(3)]; });
      axes(g, w, h, pad, w < 420 ? xt.filter(function (x, i) { return i % 2 === 0; }) : xt, yt);
      g.strokeStyle = css('--green'); g.lineWidth = 1.6; g.beginPath();
      P.forEach(function (p, i) { if (i === 0) g.moveTo(X(p[0]), Y(p[1])); else g.lineTo(X(p[0]), Y(p[1])); }); g.stroke();
      var a = P[pick], b = P[P.length - 1];
      g.strokeStyle = css('--text'); g.setLineDash([3, 4]); g.lineWidth = 1; g.beginPath(); g.moveTo(X(a[0]), pad.t); g.lineTo(X(a[0]), h - pad.b); g.stroke(); g.setLineDash([]);
      g.fillStyle = css('--text'); g.beginPath(); g.arc(X(a[0]), Y(a[1]), 5, 0, 7); g.fill();
      var ch = (b[1] / a[1] - 1) * 100;
      $('pxDay').textContent = dayF.format(new Date(a[0]));
      $('pxThen').textContent = '$' + a[1].toFixed(4);
      var chEl = $('pxChg'); chEl.textContent = (ch >= 0 ? '+' : '−') + Math.abs(ch).toFixed(0) + '%'; chEl.className = ch >= 0 ? 'up' : 'down';
    }
    pointer(c, function (e) {
      if (!geo) return; var r = c.getBoundingClientRect(), mx = e.clientX - r.left;
      var t = geo.t0 + (mx - geo.pad.l) / (geo.w - geo.pad.l - geo.pad.r) * (geo.t1 - geo.t0), best = 0, bd = Infinity;
      P.forEach(function (p, i) { var d = Math.abs(p[0] - t); if (d < bd) { bd = d; best = i; } });
      if (best !== pick) { pick = best; draw(); }
    });
    c.tabIndex = 0;
    c.addEventListener('keydown', function (e) { if (!P) return; if (e.key === 'ArrowLeft') pick = Math.max(0, pick - 1); else if (e.key === 'ArrowRight') pick = Math.min(P.length - 1, pick + 1); else if (e.key === 'Home') pick = 0; else if (e.key === 'End') pick = P.length - 1; else return; e.preventDefault(); draw(); });
    onResize(draw);
  };

  /* ---------- vProgs: heavy to prove, light to check ---------- */
  inter.vprog = function () {
    var c = $('vpCanvas'), nIn = $('vpN');
    function draw() {
      var n = Math.pow(10, +nIn.value + 1), f = fit(c), g = f.g, w = f.w, h = f.h, maxN = 1e7;
      $('vpNVal').textContent = (n >= 1e6 ? fmt(n / 1e6, n >= 1e7 ? 0 : 1) + ' million' : fmt(Math.round(n))) + ' steps';
      /* Shapes: re-run ∝ n, prove ∝ n·log n, check = constant. Log scale across the bar. */
      var vals = [['Re-run it on every node', n], ['Make the proof (once, by the app)', n * Math.log2(n + 1)], ['Check the proof (every node)', 40]];
      var top = Math.log10(maxN * Math.log2(maxN + 1)), lab = w < 520 ? 0 : 230, bh = 22, gap = (h - 3 * bh) / 4;
      g.clearRect(0, 0, w, h); g.font = '14px ' + css('--font');
      vals.forEach(function (v, i) {
        var y = gap + i * (bh + gap), x0 = lab ? lab : 0, yy = lab ? y : y + 6;
        if (!lab) { g.fillStyle = css('--text'); g.textAlign = 'left'; g.fillText(v[0], 0, y); }
        else { g.fillStyle = css('--text'); g.textAlign = 'right'; g.fillText(v[0], lab - 10, y + 16); }
        var bw = Math.max(4, (w - x0 - 8) * Math.log10(v[1] + 1) / top);
        g.fillStyle = i === 2 ? css('--green') : i === 1 ? css('--orange') : css('--muted');
        g.fillRect(x0, yy, bw, lab ? bh : bh - 6);
      });
      var ns = $('vpNVal').textContent.replace(' steps', '');
      $('vpOut').innerHTML = 'At <b>' + ns + ' steps</b>, re-running means every node repeats all ' + ns + '. With a proof, the app does the work once, plus extra to prove it, and every node runs one short check that stays the same size however big the work gets.';
    }
    nIn.addEventListener('input', draw); onResize(draw); draw();
  };

  /* ---------- ZK: Ali Baba's cave (Quisquater et al., 1989) ---------- */
  inter.cave = function () {
    var svg = $('caveSvg'), knows = false, rounds = 0, caught = false, busy = false, NS = 'http://www.w3.org/2000/svg';
    svg.innerHTML =
      '<path class="rock" d="M180 214 L180 168 M180 168 C 120 150, 60 120, 70 60 C 80 20, 150 18, 172 30 M180 168 C 240 150, 300 120, 290 60 C 280 20, 210 18, 188 30"/>' +
      '<line class="door" x1="172" y1="30" x2="188" y2="30"/>' +
      '<text x="58" y="100" class="cl">A</text><text x="292" y="100" class="cl">B</text><text x="180" y="18" class="cl sm" text-anchor="middle">door</text>' +
      '<g id="cvVic"><circle cx="180" cy="214" r="7" class="vic"/><text x="196" y="218" class="cl sm">Victor</text></g>' +
      '<text id="cvCall" x="180" y="196" class="cl call" text-anchor="middle"></text>' +
      '<circle id="cvPeg" cx="180" cy="168" r="8" class="peg"/>';
    var peg = $('cvPeg'), call = $('cvCall');
    /* Points along each path, from the fork (t=0) to the door (t=1). */
    function pathPt(side, t) {
      var p0 = [180, 168], c1 = side ? [240, 150] : [120, 150], c2 = side ? [300, 120] : [60, 120], p1 = side ? [290, 60] : [70, 60];
      if (t <= 0.75) { var u = t / 0.75, a = 1 - u; return [a * a * a * p0[0] + 3 * a * a * u * c1[0] + 3 * a * u * u * c2[0] + u * u * u * p1[0], a * a * a * p0[1] + 3 * a * a * u * c1[1] + 3 * a * u * u * c2[1] + u * u * u * p1[1]]; }
      var v = (t - 0.75) / 0.25, q1 = side ? [188, 30] : [172, 30]; return [p1[0] + (q1[0] - p1[0]) * v, p1[1] + (q1[1] - p1[1]) * v];
    }
    function move(side, from, to, ms) {
      return new Promise(function (res) {
        if (reduced || ms === 0) { var p = pathPt(side, to); peg.setAttribute('cx', p[0]); peg.setAttribute('cy', p[1]); res(); return; }
        var t0 = performance.now();
        (function f(now) { var k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, p = pathPt(side, from + (to - from) * e); peg.setAttribute('cx', p[0]); peg.setAttribute('cy', p[1]); if (k < 1) requestAnimationFrame(f); else res(); })(t0);
      });
    }
    function paint(msg) {
      $('cvBig').textContent = caught ? 'Caught' : rounds + (rounds === 1 ? ' round' : ' rounds');
      $('cvBig').classList.toggle('bad', caught);
      var odds = Math.pow(2, rounds);
      $('cvOut').innerHTML = msg + (rounds && !caught ? ' A bluffer gets this far by luck only <b>1 time in ' + (odds >= 1e6 ? fmt(odds / 1e6, 1) + ' million' : fmt(odds)) + '</b>.' : '');
    }
    function one(fast) {
      if (caught) return Promise.resolve();
      var ms = fast ? 0 : 520, inSide = Math.random() < 0.5 ? 0 : 1, want = Math.random() < 0.5 ? 0 : 1;
      call.textContent = '';
      return move(inSide, 0, 0.72, ms).then(function () {
        call.textContent = 'Come out ' + (want ? 'B' : 'A') + '!';
        if (want === inSide) return move(inSide, 0.72, 0, ms).then(function () { return 'Victor called ' + (want ? 'B' : 'A') + ', the side she went in by.'; });
        if (knows) return move(inSide, 0.72, 1, ms / 2).then(function () { return move(want, 1, 0, ms * 1.4); }).then(function () { return 'Victor called ' + (want ? 'B' : 'A') + '. She opened the door and came out that side.'; });
        caught = true; return move(inSide, 0.72, 0, ms).then(function () { return 'Victor called ' + (want ? 'B' : 'A') + ', but she was stuck on the other side. Caught bluffing.'; });
      }).then(function (msg) { if (!caught) rounds++; paint(msg); });
    }
    function run(n) {
      if (busy) return; busy = true;
      var p = Promise.resolve(), fast = n > 1 && reduced;
      for (var i = 0; i < n; i++) p = p.then(function () { return one(fast); });
      p.then(function () { busy = false; });
    }
    function setKnows(k) {
      knows = k; $('cvKnows').setAttribute('aria-pressed', String(k)); $('cvFakes').setAttribute('aria-pressed', String(!k));
      reset();
    }
    function reset() { rounds = 0; caught = false; call.textContent = ''; move(0, 0, 0, 0); paint(knows ? 'Peggy knows the word. Press “Run one round”.' : 'Peggy is bluffing. Press “Run one round”.'); }
    $('cvKnows').addEventListener('click', function () { if (!busy) setKnows(true); });
    $('cvFakes').addEventListener('click', function () { if (!busy) setKnows(false); });
    $('cvOne').addEventListener('click', function () { run(1); });
    $('cvTen').addEventListener('click', function () { run(10); });
    $('cvReset').addEventListener('click', function () { if (!busy) reset(); });
    reset();
  };

  document.querySelectorAll('[data-inter]').forEach(function (f) { var k = f.getAttribute('data-inter'); if (inter[k]) inter[k](); });
  new MutationObserver(redrawAll).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
})();
