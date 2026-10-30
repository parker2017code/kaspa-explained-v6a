// Version A: margin notes. Behavior, not markup: where a note sits, and that its marker reaches it.
import { test, expect } from './helpers.mjs';
test.beforeEach(async ({ page }) => { await page.goto('./'); });

test('each note sits beside its marker on desktop, inline on mobile', async ({ page, errors }, info) => {
  for (const id of ['sn-fair', 'sn-wallet', 'sn-node']) {
    const ref = page.locator(`a[href="#${id}"]`), note = page.locator('#' + id);
    await ref.scrollIntoViewIfNeeded();
    const r = await ref.boundingBox(), n = await note.boundingBox(), col = await page.locator('#c5 h2').boundingBox();
    if (info.project.name === 'desktop') {
      expect(n.x, id + ' in the right margin').toBeGreaterThan(col.x + col.width);
      expect(Math.abs(n.y - r.y), id + ' top aligned with marker').toBeLessThan(24);
      expect(n.x + n.width).toBeLessThanOrEqual(1440);
    } else {
      expect(n.x + n.width, id + ' inside the viewport').toBeLessThanOrEqual(390);
      expect(n.y, id + ' after its marker').toBeGreaterThan(r.y);
    }
  }
});

test('notes never overlap each other or the next chapter', async ({ page, errors }) => {
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.sn')].map(e => { const b = e.getBoundingClientRect(), s = e.closest('section').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, secBottom: s.bottom }; }));
  boxes.forEach(b => expect(b.bottom).toBeLessThanOrEqual(b.secBottom));
  for (let i = 1; i < boxes.length; i++) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i - 1].bottom);
});

test('marker is a link that names its note for screen readers', async ({ page, errors }) => {
  const a = page.locator('a[href="#sn-wallet"]');
  await expect(a).toHaveAttribute('aria-describedby', 'sn-wallet');
  await a.scrollIntoViewIfNeeded();
  await a.click();
  await expect(page).toHaveURL(/#sn-wallet$/);
});

test('no numbered section kickers outside Moose', async ({ page, errors }) => {
  expect(await page.locator('section:not(#moose) .meta').filter({ hasText: /^\d · / }).count()).toBe(0);
});
