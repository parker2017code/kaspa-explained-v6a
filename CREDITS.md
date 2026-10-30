# Credits

Everything below is vendored in this folder and served from it. No CDN, no tracking.
Licence texts sit next to the files: `vendor/licenses/` and `fonts/*.OFL.txt`.

## Code

| Component | Version | Licence | File | Used for |
|---|---|---|---|---|
| d3 (Mike Bostock and contributors), includes d3-delaunay | 7.9.0 | ISC | `vendor/d3.min.js` | c2 nearest-block picking (`Delaunay.find`), c4 log-scale racetrack (`scaleLog`) |
| Observable Plot (Observable, Inc.) | 0.6.17 | ISC | `vendor/plot.umd.min.js` | c5 waffle small multiples (`waffleY`), emission curve with pointer tip, miners' income bar |
| interact.js (Taye Adeyemi) | 1.10.28 | MIT | `vendor/interact.min.js` | c6 drag the coin onto a destination (`draggable`, `dropzone`) |
| NumberFlow (Max Barvian), vanilla `number-flow` element | 0.6.2 | MIT | `vendor/number-flow.min.js` | rolling digits on every live number |
| esm-env (bundled inside number-flow.min.js) | - | MIT | `vendor/number-flow.min.js` | NumberFlow dependency |

`number-flow.min.js` is an esbuild IIFE bundle of the npm package `number-flow` (`import 'number-flow'`), unmodified.

## Fonts

| Font | Licence | File |
|---|---|---|
| Source Serif 4, Adobe (via @fontsource-variable/source-serif-4 5.3.1) | SIL OFL 1.1 | `fonts/source-serif-4-latin-wght-normal.woff2`, `fonts/source-serif-4-latin-wght-italic.woff2` |
| Monaspace Neon, GitHub Next (via @fontsource/monaspace-neon 5.3.0) | SIL OFL 1.1 | `fonts/monaspace-neon-latin-400-normal.woff2`, `fonts/monaspace-neon-latin-600-normal.woff2` |

## Patterns adapted (no code copied)

- Nearest-point hover with `d3.Delaunay.find` and a distance cut-off, from the Observable / d3-delaunay docs.
- Rolling digit counters as a reading aid: NumberFlow demos by Max Barvian (number-flow.barvian.me).
- Generous hit areas on small controls (44px minimum): a public X post on invisible hit-area padding.
- Miner-income dumbbell on a log axis (chapter 5): the arrow mark on a log scale, from the Observable Plot docs and the "Plot: Arrow variation chart" example (observablehq.com/plot/marks/arrow).
- A full window of history from the first frame (chapter 3): the pre-filled data buffer from Mike Bostock's "Path Transitions" (bost.ocks.org/mike/path/).
- Empty slots that the line-up fills (chapter 2): the skeleton placeholder pattern.
- Fixed lanes in the cheat game (chapter 3): the swimlane diagram pattern, with a labelled empty lane for the player's own blocks.
- Moose book covers: first pages rendered from the book PDFs with `pdftoppm` (poppler). The PDFs are the author's own files in `files/`.

## Look, scroll and navigation (adapted patterns, no code copied unless listed above)

- Paper-and-ink reading layout, one serif column, numbered figures with captions that state the takeaway: Tufte CSS (Dave Liepmann, MIT, github.com/edwardtufte/tufte-css) and the Distill article guide (distill.pub/guide). Replaces the earlier dark neon look.
- Fluid type with `clamp()` so headings scale smoothly from 320 to 2560 px: the Utopia type calculator (utopia.fyi).
- Figures settle into place as they scroll in, using CSS scroll-driven animations (`animation-timeline: view()`), transform only and behind `@supports`: Chrome's scroll-driven animations guide (developer.chrome.com/docs/css-ui/scroll-driven-animations).
- "Go deeper" links that carry their title into the deep-dive page's heading: cross-document View Transitions with `pageswap` / `pagereveal` (developer.chrome.com/docs/web-platform/view-transitions/cross-document, MDN). `js/vt.js`.
- Expanders that open smoothly: `::details-content` with `interpolate-size: allow-keywords` (nerdy.dev, "Open and close transitions for the details element"; MDN).
- Tap-to-define glossary terms on first use, with a hit area padded to at least 24 px.
- Comparison table that scrolls sideways on phones with a sticky first column: the responsive data table pattern (MDN, Adrian Roselli's "Under-Engineered Responsive Tables").
- Scrollama was shortlisted for the deep pages but not used: native scrolling with one interactive per page was simpler and lighter.

## Deep-dive interactives (`learn/`)

- Zero knowledge: Ali Baba's cave, from Quisquater et al., "How to Explain Zero-Knowledge Protocols to Your Children", CRYPTO '89 (doi.org/10.1007/0-387-34805-0_60). Labelled a simulation.
- The DAG: a block's past, future and anticone, on 261 real blocks recorded from api.kaspa.org; terms from the PHANTOM/GHOSTDAG paper (eprint.iacr.org/2018/104).
- Security: the catch-up probability from section 11 of the Bitcoin white paper (bitcoin.org/bitcoin.pdf). Kaspa's 1 to 3 s figure is Yonatan Sompolinsky's.
- vProgs: "run it once, check it fast", drawn as shape only, not a benchmark; from vprogs.xyz.
- Supply and fees: the published monthly emission schedule (wiki.kaspa.org/en/tokenomics) and live supply from api.kaspa.org/info/coinsupply.
- Price and market: CoinGecko's public API (`/coins/markets`, `/global`, `/coins/kaspa/market_chart`), with dated fallbacks when it can't be reached. Gold above ground: World Gold Council, 216,265 t at end of 2024.

## Data

Live numbers come from the public Kaspa REST API (api.kaspa.org), mempool.space for Bitcoin's latest block, and CoinGecko for prices and market size. Every figure shows its source and the time it was read; when a source is unreachable the page shows a dated recorded value and says so. When the Kaspa API is unreachable the page says so and shows a labelled simulation; the Bitcoin figures simply stay hidden.

The tests in `tests/` (Playwright, axe-core) are not served to readers; they check the page at 320, 390, 768, 1280, 1440, 1920 and 2560 px wide, and every deep-dive page at 390 and 1440.

## Load-speed patterns (Oct 30, 2026 pass)
- Defer non-critical JavaScript until after the `load` event (web.dev, "Efficiently load third-party JavaScript" / "Reduce JavaScript execution time"): d3, Observable Plot, interact.js, the collision sim, site.js and market.js are injected in order (`async=false`) after load, so they don't compete with the first paint.
- IntersectionObserver gating (MDN, web.dev "Lazy-load offscreen work"): the collision simulation only runs timers while it is on screen.
- Ambient canvas budget: the hero background is capped at 30 fps and devicePixelRatio 1.5 on small/touch screens (common canvas guidance, MDN "Optimizing canvas").
- Reserved heights for content that fills in later (web.dev "Optimize Cumulative Layout Shift"): the two-network race readouts and piles have min-heights.
- Wait for the first paint before starting deferred work (requestAnimationFrame then setTimeout, the "after next paint" idiom from web.dev's INP guidance): the late scripts and the hero animation start only after load and one painted frame, and the hero runs a single animation chain.
- Readiness flag: `html[data-ready]` is set when the late scripts finish; the tests wait for it before interacting.
- `content-visibility: auto` with `contain-intrinsic-size: auto <height>` on the chapters below the fold (web.dev, "content-visibility: the new CSS property that boosts your rendering performance", web.dev/articles/content-visibility; MDN `contain-intrinsic-size`): the browser skips their layout and paint until they near the screen, and the `auto` keyword remembers each chapter's real height once seen, so the scrollbar does not jump. Heights are the measured chapter heights at 390 and 1440 px.
- Live-data requests start after the first painted frame and an idle period (`requestIdleCallback` with a timeout; MDN "Background Tasks API"), so api.kaspa.org and mempool.space latency cannot hold up first paint. Until live data arrives, the hero shows the last values this browser saw (localStorage, under a day old), dimmed and labelled as last seen.
- Charts draw when their chapter starts rendering, not all at once on load: each chapter's charts wait for the `contentvisibilityautostatechange` event (MDN, "Element: contentvisibilityautostatechange event"; web.dev content-visibility article), with an IntersectionObserver as the fallback. This took site.js start-up from about 60 ms to about 9 ms of main-thread time on the test machine.
- Early taps are kept, not dropped: a button tapped before the section scripts are wired is remembered and replayed once they are (the "queue input until hydrated" approach described in web.dev's "Optimize Interaction to Next Paint" and in Qwik/Astro island docs as event replay).
