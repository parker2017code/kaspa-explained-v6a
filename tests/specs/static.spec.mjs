// Source checks that need no browser: Moose untouched, British English, credits, no placeholder copy.
import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const ROOT = path.resolve(import.meta.dirname, '../..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const fx = f => fs.readFileSync(path.join(import.meta.dirname, '../fixtures', f), 'utf8');

test('Moose section HTML is byte-for-byte v5', () => {
  expect(read('index.html').includes(fx('moose-v5.html'))).toBe(true);
});
test('Moose files are byte-for-byte v5', () => {
  for (const line of fx('files-v5.sha256').trim().split('\n')) {
    const [hash, name] = line.split(/\s+/);
    const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'files', name))).digest('hex');
    expect(h, name).toBe(hash);
  }
});

// Copy is British English (Moose's guest section is excluded: printed as he wrote it).
const US = /\b(colou?r(?<=color)\w*|favor\w*|honor\w*|behavior\w*|neighbor\w*|flavor\w*|\w+(ization|izing|ized|izes)|center\w*|meters?|liters?|math|modeling|modeled|labeling|labeled|traveling|traveled|canceling|canceled|defense|gray|catalog|analyz\w+|skeptic\w*)\b/gi;
const OK_US = new Set(['size', 'sized', 'sizes', 'seize', 'seized', 'seizes', 'prize', 'prizes']);
// Human copy only: text between tags in the HTML, and string literals containing a space in the scripts.
const visible = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
const strings = js => [...js.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map(m => m[1].replace(/<[^>]*>/g, ' ')).filter(t => /\s/.test(t) && /[a-z]{3}/i.test(t)).join('\n');
test('British English in visible copy and script strings (Moose excluded)', () => {
  let html = read('index.html');
  const i = html.indexOf('id="moose"'); html = html.slice(0, i) + html.slice(html.indexOf('</section>', i));
  const hits = [];
  for (const [f, t] of [['index.html', visible(html)], ...['js/site.js', 'js/live.js', 'js/collision-sim.js'].map(f => [f, strings(read(f))])]) {
    for (const m of t.matchAll(US)) if (!OK_US.has(m[0].toLowerCase())) hits.push(f + ': ' + m[0]);
    for (const m of t.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}\b/g)) hits.push(f + ': US date ' + m[0]);
  }
  expect(hits).toEqual([]);
});
test('numbers are formatted for en-GB', () => {
  for (const f of ['js/site.js', 'js/live.js', 'js/ui.js']) expect(read(f), f).not.toMatch(/en-US/);
  expect(read('js/ui.js')).toMatch(/en-GB/);
});
test('no third-party wallets or explorers', () => {
  const t = read('index.html') + read('js/site.js') + read('js/live.js');
  expect(t).not.toMatch(/kaspium|kastle|kasware|kas\.fyi|kaspa\.stream/i);
});
test('every vendored component is credited', () => {
  const c = read('CREDITS.md');
  for (const n of ['d3', 'Observable Plot', 'interact.js', 'NumberFlow', 'Source Serif 4', 'Monaspace']) expect(c, n).toContain(n);
  for (const f of fs.readdirSync(path.join(ROOT, 'vendor'))) expect(c, f).toContain(f);
});
test('no placeholder copy', () => {
  const t = read('index.html');
  expect(t).not.toMatch(/lorem ipsum|TODO|FIXME|\{\{|href="#"/i);
});
