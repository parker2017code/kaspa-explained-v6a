import { test, expect } from './helpers.mjs';
import AxeBuilder from '@axe-core/playwright';
// Regressions from the hands-on pass of 30 Oct 2026, 14:29 CET, plus the deep-dive pages.

const DEEP = ['dag', 'security', 'supply', 'fees', 'price', 'vprogs', 'zk'];
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('wide screens: every reading paragraph keeps a column of at least 480 px (1920 and 2560)', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop');
  for (const width of [1920, 2560]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto('./');
    await page.evaluate(() => document.querySelectorAll('details').forEach(d => { d.open = true; }));
    const narrow = await page.evaluate(() => [...document.querySelectorAll('main p, main li')].filter(p => {
      if (p.closest('figure,table,.pop,.hud,.readout,.board,.receipt,.controls,nav,footer,.dots,.sr-only') || p.textContent.trim().length < 140) return false;
      const b = p.getBoundingClientRect(); return b.width > 0 && b.width < 480;
    }).map(p => Math.round(p.getBoundingClientRect().width) + 'px: ' + p.textContent.trim().slice(0, 50)));
    expect(narrow, `at ${width}`).toEqual([]);
    expect(await overflow(page), `overflow at ${width}`).toBe(0);
  }
});

test('Bitcoin clock skew: a block stamped in the future never shows a negative time', async ({ page, errors }) => {
  await page.route(/mempool\.space\/api\/v1\/blocks/, r => r.fulfill({ json: [{ height: 950000, timestamp: Math.floor(Date.now() / 1000) + 330 }] }));
  await page.route(/mempool\.space\/api\/blocks\/tip\/height/, r => r.fulfill({ body: '950000', contentType: 'text/plain' }));
  await page.goto('./');
  await page.locator('#liveSource').filter({ hasText: /Live|Simulation/ }).waitFor({ timeout: 20_000 });
  await page.locator('#c4').scrollIntoViewIfNeeded();
  await page.click('#dGo');
  await page.waitForTimeout(2500);
  const txt = await page.evaluate(() => document.body.innerText);
  expect(txt).not.toMatch(/-\s?\d+(\.\d+)?\s?(min|s\b|metres)|was -|-\d+:\d\d/);
});

test('×600 fast-forward: the clock does not shift the layout', async ({ page, errors }) => {
  await page.goto('./');
  await page.locator('#c4').scrollIntoViewIfNeeded();
  await page.click('#dGo');
  await expect(page.locator('#dFast')).toBeVisible();
  const probe = page.locator('#c4 .controls');
  // Page-relative position: a click that scrolls the viewport is not a layout shift.
  const docY = () => probe.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
  const y0 = await docY();
  const clockH0 = (await page.locator('#dBclock').boundingBox()).height;
  await page.click('#dFast');
  await page.waitForTimeout(2500);
  const clockH1 = (await page.locator('#dBclock').boundingBox()).height;
  expect(Math.abs(clockH1 - clockH0), 'clock height changed').toBeLessThan(2);
  await page.waitForTimeout(1500);
  const y1 = await docY();
  expect(Math.abs(y1 - y0), 'controls jumped').toBeLessThan(2);
});

test('live data down: the order demo still plays a dated sample and offers a retry', async ({ page }) => {
  // Aborted requests log "Failed to load resource" by design here; only script errors count.
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/api\.kaspa\.org/, r => r.abort());
  await page.goto('./');
  await page.locator('#orderCanvas').scrollIntoViewIfNeeded();
  const tag = page.locator('.sample-tag').first();
  await expect(tag).toContainText('Recorded sample', { timeout: 30_000 });
  await expect(tag).toContainText(/\d{1,2} \w+ 20\d\d/);
  await expect(page.locator('#orderOut')).toContainText(/Threading|in one line/);
  const lit = await page.locator('#orderCanvas').evaluate(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i]) n++; return n; });
  expect(lit, 'order canvas is blank').toBeGreaterThan(20);
  await expect(page.locator('#orderRetry')).toBeVisible({ timeout: 30_000 });
  await page.click('#orderRetry');
  await expect(tag).toContainText(/Trying|Recorded sample/);
  expect(errs).toEqual([]);
});

test('phone: the attack graph and its controls stay on screen together', async ({ page, errors }) => {
  test.skip(test.info().project.name !== 'mobile');
  await page.goto('./');
  await page.locator('#gHide').scrollIntoViewIfNeeded();
  await page.locator('#gHide').tap();
  await page.waitForTimeout(1200);
  const vh = page.viewportSize().height;
  for (const sel of ['#ghostCanvas', '#gHide', '#gRelease']) {
    const b = await page.locator(sel).boundingBox();
    expect(b, sel).not.toBeNull();
    expect(b.y, sel + ' top').toBeGreaterThanOrEqual(-1);
    expect(b.y + b.height, sel + ' bottom').toBeLessThanOrEqual(vh + 1);
  }
});

for (const width of [320, 390]) {
  test(`tap-through at ${width} px: every visible control responds without errors or overflow`, async ({ browser }) => {
    test.slow();
    test.skip(test.info().project.name !== 'mobile');
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto('./');
    await page.waitForFunction(() => document.documentElement.dataset.ready, null, { timeout: 20_000 });
    const n = await page.locator('main button:visible, main summary:visible').count();
    expect(n).toBeGreaterThan(20);
    let tapped = 0;
    for (let i = 0; i < n; i++) {
      const el = page.locator('main button:visible, main summary:visible').nth(i);
      if (!(await el.count()) || !(await el.isEnabled().catch(() => false))) continue;
      const id = await el.getAttribute('id');
      if (id === 'theme') continue;
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await el.tap({ timeout: 3000 }).catch(() => {});
      tapped++;
      await page.keyboard.press('Escape').catch(() => {});
    }
    expect(tapped).toBeGreaterThan(20);
    await page.waitForTimeout(500);
    expect(await overflow(page)).toBe(0);
    expect(errs).toEqual([]);
    await ctx.close();
  });
}

test('no sideways scroll at 320, 390, 768, 1280, 1440, 1920 and 2560, main page and every deep page', async ({ page }) => {
  test.slow();
  test.skip(test.info().project.name !== 'desktop');
  for (const width of [320, 390, 768, 1280, 1440, 1920, 2560]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['./', ...DEEP.map(d => `./learn/${d}/`)]) {
      await page.goto(path);
      expect(await overflow(page), `${path} at ${width}`).toBe(0);
    }
  }
});

for (const slug of DEEP) {
  test(`deep page ${slug}: loads clean, links back, its interactive answers`, async ({ page, errors }) => {
    await page.goto(`./learn/${slug}/`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.back')).toHaveAttribute('href', /^\.\.\/\.\.\/#/);
    await expect(page.locator('.sources li').first()).toBeVisible();
    await expect(page.locator('a.deeper')).toHaveAttribute('href', /\.\.\/[a-z]+\//);
    const fig = page.locator('figure.inter');
    await fig.scrollIntoViewIfNeeded();
    const out = fig.locator('.readout, .big-out').first();
    await expect(out).not.toBeEmpty({ timeout: 10_000 });
    const before = await fig.locator('.readout, .big-out').allTextContents();
    const range = fig.locator('input[type=range]').first();
    if (slug === 'zk') {
      await page.click('#cvOne');
      await page.waitForTimeout(2600);
    } else if (slug === 'price') {
      await page.locator('#pxCanvas').focus();
      for (let k = 0; k < 20; k++) await page.keyboard.press('ArrowRight');
    } else if (await range.count()) {
      await range.evaluate(el => { el.value = String(+el.min + (+el.max - +el.min) * 0.8); el.dispatchEvent(new Event('input', { bubbles: true })); });
    } else {
      await fig.locator('button').last().click();
      await page.waitForTimeout(2600);
    }
    await expect.poll(() => fig.locator('.readout, .big-out').allTextContents()).not.toEqual(before);
    expect(await overflow(page)).toBe(0);
    await page.click('#theme');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const res = await new AxeBuilder({ page }).analyze();
    const bad = res.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`);
    expect(bad).toEqual([]);
  });
}

test('main page links to every deep page, and the link carries a view-transition name', async ({ page, errors }) => {
  await page.goto('./');
  for (const d of DEEP) await expect(page.locator(`a.deeper[href="learn/${d}/"]`).first()).toBeAttached();
  await page.locator('a.deeper[href="learn/dag/"]').scrollIntoViewIfNeeded();
  await Promise.all([page.waitForURL(/learn\/dag\//), page.locator('a.deeper[href="learn/dag/"]').click()]);
  await expect(page.locator('h1')).toBeVisible();
  await page.locator('.back').click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/(\?[^#]*)?(#c1)?$|github\.io\/kaspa-explained-v6a\/(\?[^#]*)?(#c1)?$/);
  await expect(page.locator('#c1')).toBeInViewport({ timeout: 5_000 });
});
