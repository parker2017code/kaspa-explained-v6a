import { test, expect } from './helpers.mjs';
// Regressions found by the live audit (Oct 30, 2026).

test('order: hammering Pause/Play and the scrub never throws', async ({ page, errors }) => {
  await page.goto('./');
  await page.locator('#orderCanvas').scrollIntoViewIfNeeded();
  const go = page.locator('#oGo');
  for (let i = 0; i < 6; i++) { await go.click(); await page.waitForTimeout(120); }
  const scrub = page.locator('#orderCanvas').locator('xpath=ancestor::figure[1]').locator('input[type=range]');
  if (await scrub.count()) await scrub.first().evaluate(el => { for (const v of [0, 300, 1000, 50]) { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); } });
  await expect(page.locator('#orderOut')).not.toBeEmpty();
});

test('rendered text uses curly apostrophes (Moose excluded)', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
  const bad = await page.evaluate(() => {
    const out = []; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let t;
    while ((t = tw.nextNode())) { const p = t.parentElement; if (!p || p.closest('#moose,script,style,code,pre,noscript')) continue;
      const m = t.textContent.match(/\w'\w|\w'(?=\s)|\s'\w/g); if (m) out.push(t.textContent.trim().slice(0, 60)); }
    document.querySelectorAll('[data-pop]').forEach(e => { if (!e.closest('#moose') && /\w'\w/.test(e.dataset.pop)) out.push(e.dataset.pop.slice(0, 60)); });
    return out;
  });
  expect(bad).toEqual([]);
});
