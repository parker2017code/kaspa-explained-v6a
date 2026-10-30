import { test as base, expect } from '@playwright/test';
// Fails any test that logs a console error, a page error, or a failed same-origin request.
export const test = base.extend({
  // The main page loads its section scripts after the load event; wait for them like a reader would.
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    page.goto = async (...a) => { const r = await goto(...a); await page.waitForFunction(() => document.documentElement.dataset.ready || !window.KLive, null, { timeout: 20_000 }); return r; };
    await use(page);
  },
  errors: async ({ page }, use) => {
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('requestfailed', r => { if (r.url().startsWith(page.url().split('/').slice(0, 3).join('/')) && !r.url().includes('/files/')) errors.push('requestfailed: ' + r.url()); });
    await use(errors);
    expect(errors, 'console/page errors').toEqual([]);
  },
});
export { expect };
export const offline = page => page.route(/api\.kaspa\.org|mempool\.space/, r => r.abort());

// Range inputs reject fill() for off-step values; set like a user drag would.
export async function setRange(page, sel, v) {
  await page.locator(sel).evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
}
// Scroll-driven entrances move an element for a frame or two after a jump scroll; wait until its box holds still.
export async function stableBox(loc) {
  let prev = null;
  for (let i = 0; i < 40; i++) {
    const b = await loc.boundingBox();
    if (prev && b && Math.abs(b.x - prev.x) < 0.5 && Math.abs(b.y - prev.y) < 0.5) return b;
    prev = b; await loc.page().waitForTimeout(60);
  }
  return prev;
}
