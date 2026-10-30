/* Supply and market numbers, read-only.
   Live: api.kaspa.org/info/coinsupply (supply) and the CoinGecko public API (prices, market caps).
   Every number is labelled with its source and the time it was read. If a source can't be reached,
   the page keeps the values recorded on 30 Oct 2026 and says so. Replies are cached for 5 minutes. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n, d) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var GOLD_OZ = 6953071135.5; /* World Gold Council: 216,265 tonnes above ground, end of 2024 */
  var FALLBACK = {
    at: '30 Oct 2026, 14:39 CET', supplyAt: '30 Oct 2026, 14:42 CET',
    supply: 27783991058.84677, max: 28704035605,
    kas: { p: 0.03265459, cap: 907241567, rank: 76, chg: -9.37171, ath: 0.207411, athDate: '2024-07-31', athChg: -84.2561 },
    btc: 1550623319756, eth: 271855654243, gold: 3937.22 * GOLD_OZ, all: 2613851748061
  };
  var when = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
  var day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  function cached(key, url) {
    try { var c = JSON.parse(localStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 300000) return Promise.resolve(c); } catch (e) {}
    return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { var c = { t: Date.now(), d: d }; try { localStorage.setItem(key, JSON.stringify(c)); } catch (e) {} return c; });
  }
  function usd(n) {
    var a = Math.abs(n);
    if (a >= 1e12) return '$' + (n / 1e12).toFixed(a >= 1e13 ? 1 : 2) + 'T';
    if (a >= 1e9) return '$' + (n / 1e9).toFixed(a >= 1e11 ? 0 : 1) + 'B';
    if (a >= 1e6) return '$' + Math.round(n / 1e6) + 'M';
    return '$' + fmt(n);
  }
  function ratio(x) { return x >= 1000 ? fmt(Math.round(x / 100) * 100) : x >= 100 ? fmt(Math.round(x / 10) * 10) : fmt(Math.round(x)); }

  /* ---- Already mined ---- */
  function paintSupply(sup, max, label) {
    var pct = sup / max * 100, p = pct.toFixed(1) + '%';
    ['minedPct', 'whyMined'].forEach(function (id) { var e = $(id); if (e) e.textContent = p; });
    var f = $('minedFill'); if (f) f.style.width = pct.toFixed(2) + '%';
    var n = $('minedNow'); if (n) n.textContent = (sup / 1e9).toFixed(2) + ' billion KAS mined';
    var m = $('minedMax'); if (m) m.textContent = 'of about ' + (max / 1e9).toFixed(2) + ' billion, ever';
    var w = $('whyMinedNote'); if (w) w.textContent = label.live ? 'Right now, ' + p + ' already does.' : 'On 30 Oct 2026, ' + p + ' already did.';
    var s = $('minedSrc'); if (s) s.textContent = label.text;
  }
  var supplyOnce = false;
  function supply() {
    if (supplyOnce) return; supplyOnce = true;
    cached('ke-supply', 'https://api.kaspa.org/info/coinsupply').then(function (c) {
      var sup = +c.d.circulatingSupply / 1e8, max = +c.d.maxSupply / 1e8;
      if (!(sup > 0 && max > sup)) throw new Error('bad');
      paintSupply(sup, max, { live: true, text: 'Live from api.kaspa.org/info/coinsupply, read ' + when.format(new Date(c.t)) + '. The last coins come out around 2057.' });
    }).catch(function () {
      paintSupply(FALLBACK.supply, FALLBACK.max, { live: false, text: 'Couldn’t reach api.kaspa.org, so this is the value recorded ' + FALLBACK.supplyAt + ' from api.kaspa.org/info/coinsupply.' });
    });
  }

  /* ---- Price and size ---- */
  var M = null;
  function paintMarket(m, label) {
    M = m;
    var k = m.kas;
    $('mPrice').textContent = '$' + (k.p < 1 ? k.p.toFixed(4) : fmt(k.p, 2));
    $('mChg').textContent = (k.chg >= 0 ? '+' : '−') + Math.abs(k.chg).toFixed(1) + '% in 24 h';
    $('mCap').textContent = usd(k.cap);
    $('mRank').textContent = '#' + k.rank;
    $('mAth').textContent = '−' + Math.abs(k.athChg).toFixed(0) + '%';
    $('mAthWhen').textContent = 'high $' + k.ath.toFixed(3) + ', ' + day.format(new Date(k.athDate));
    $('rSwing').textContent = 'KAS is ' + Math.abs(k.athChg).toFixed(0) + '% below its ' + new Date(k.athDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + ' high, and moved ' + Math.abs(k.chg).toFixed(0) + '% in the last day.';
    $('sizeCap').textContent = 'Sizes on one ruler. Each step right is ten times bigger. Kaspa is about 1/' + ratio(m.btc / k.cap) + ' of Bitcoin and about 1/' + ratio(m.gold / k.cap) + ' of all the gold above ground.';
    $('mSrc').textContent = label;
    drawSize();
  }
  function drawSize() {
    var svg = $('sizeSvg'); if (!svg || !M || !window.d3) return;
    var w = svg.parentNode.clientWidth || 600, narrow = w < 560, h = narrow ? 190 : 150;
    var x = d3.scaleLog().domain([3e8, 6e13]).range([16, w - 16]), axisY = h - 30;
    var items = [
      { n: 'Kaspa', v: M.kas.cap, kas: true }, { n: 'Ethereum', v: M.eth }, { n: 'Bitcoin', v: M.btc },
      { n: 'All crypto', v: M.all }, { n: 'All gold', v: M.gold, sub: 'mined, ever' }
    ];
    var S = d3.select(svg).attr('viewBox', '0 0 ' + w + ' ' + h).attr('width', w).attr('height', h);
    S.selectAll('*').remove();
    var ax = S.append('g').attr('class', 'tax').attr('transform', 'translate(0,' + axisY + ')')
      .call(d3.axisBottom(x).tickValues([1e9, 1e10, 1e11, 1e12, 1e13]).tickFormat(function (v) { return { 1e9: '$1B', 1e10: '$10B', 1e11: '$100B', 1e12: '$1T', 1e13: '$10T' }[v]; }).tickSizeOuter(0));
    ax.select('.domain').attr('stroke', 'var(--line-bright)'); ax.selectAll('line').attr('stroke', 'var(--line-bright)');
    /* Stagger labels onto rows so neighbours never collide. */
    var rows = narrow ? [26, 62, 98] : [30, 70], lastEnd = rows.map(function () { return -1e9; });
    items.forEach(function (it) {
      var cx = x(it.v), labW = (Math.max(it.n.length, usd(it.v).length + 1) * 7.6) + 10, r = 0;
      for (; r < rows.length; r++) if (cx - labW / 2 > lastEnd[r]) break;
      if (r === rows.length) r = rows.length - 1;
      lastEnd[r] = cx + labW / 2;
      var anchor = cx > w - 60 ? 'end' : cx < 60 ? 'start' : 'middle', y = rows[r];
      var col = it.kas ? 'var(--green)' : 'var(--text)';
      S.append('line').attr('x1', cx).attr('x2', cx).attr('y1', y + 18).attr('y2', axisY).attr('stroke', col).attr('stroke-width', it.kas ? 2 : 1).attr('opacity', it.kas ? 1 : 0.5);
      S.append('circle').attr('cx', cx).attr('cy', axisY).attr('r', it.kas ? 6 : 4).attr('fill', col);
      S.append('text').attr('class', 'lab' + (it.kas ? ' kas' : '')).attr('x', cx).attr('y', y).attr('text-anchor', anchor).text(it.n);
      S.append('text').attr('class', 'val').attr('x', cx).attr('y', y + 14).attr('text-anchor', anchor).text(usd(it.v));
    });
  }
  function market() {
    var ids = 'kaspa,bitcoin,ethereum,pax-gold';
    Promise.all([
      cached('ke-mkts', 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=' + ids),
      cached('ke-global', 'https://api.coingecko.com/api/v3/global')
    ]).then(function (r) {
      var by = {}; r[0].d.forEach(function (c) { by[c.id] = c; });
      var k = by.kaspa; if (!k || !by.bitcoin || !by['pax-gold']) throw new Error('missing');
      paintMarket({
        kas: { p: k.current_price, cap: k.market_cap, rank: k.market_cap_rank, chg: k.price_change_percentage_24h, ath: k.ath, athDate: k.ath_date, athChg: k.ath_change_percentage },
        btc: by.bitcoin.market_cap, eth: by.ethereum.market_cap, gold: by['pax-gold'].current_price * GOLD_OZ, all: r[1].d.data.total_market_cap.usd
      }, 'Live from the CoinGecko API, read ' + when.format(new Date(r[0].t)) + '. Gold: the World Gold Council’s 216,265 tonnes above ground (end of 2024) at the PAX Gold price.');
    }).catch(function () {
      paintMarket(FALLBACK, 'Couldn’t reach CoinGecko, so these are the values recorded ' + FALLBACK.at + ' from its API. Gold: 216,265 tonnes (World Gold Council, end of 2024) at that day’s PAX Gold price.');
    });
  }
  /* Draw the dated values at once so nothing jumps, then refresh when the reader gets near. */
  paintMarket(FALLBACK, 'Recorded ' + FALLBACK.at + ' from the CoinGecko API. Updating…');
  var started = {};
  function near(id, fn) {
    var el = $(id); if (!el) return;
    if (!window.IntersectionObserver) { fn(); return; }
    var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; }) && !started[id]) { started[id] = 1; io.disconnect(); fn(); } }, { rootMargin: '1500px 0px' });
    io.observe(el);
  }
  near('why', supply); near('mined', supply);
  near('market', market);
  var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(drawSize, 150); });
  new MutationObserver(drawSize).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
/* Last of the late scripts: mark the page fully interactive (tests wait on this). */
document.documentElement.dataset.ready = '1';
