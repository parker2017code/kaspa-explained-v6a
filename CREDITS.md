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
| Mona Sans, GitHub (via @fontsource-variable/mona-sans 5.3.0) | SIL OFL 1.1 | `fonts/mona-sans-var.woff2` |
| Monaspace Neon, GitHub Next (via @fontsource/monaspace-neon 5.3.0) | SIL OFL 1.1 | `fonts/monaspace-neon-latin-400-normal.woff2`, `fonts/monaspace-neon-latin-600-normal.woff2` |

## Patterns adapted (no code copied)

- Nearest-point hover with `d3.Delaunay.find` and a distance cut-off, from the Observable / d3-delaunay docs.
- Rolling digit counters as a reading aid: NumberFlow demos by Max Barvian (number-flow.barvian.me).
- Generous hit areas on small controls (44px minimum): a public X post on invisible hit-area padding.
- Moose book covers: first pages rendered from the book PDFs with `pdftoppm` (poppler). The PDFs are the author's own files in `files/`.

## Data

Live numbers come from the public Kaspa REST API (api.kaspa.org) and, for Bitcoin's latest block, mempool.space. When the Kaspa API is unreachable the page says so and shows a labelled simulation; the Bitcoin figures simply stay hidden.
