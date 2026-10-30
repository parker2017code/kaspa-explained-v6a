// The new execution layer: inspector, scrub, racetrack, vault drag, waffles, plots, covers, tx shortcut.
import { test, expect, setRange, offline } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.locator('#liveSource').filter({ hasText: /Live|Simulation/ }).waitFor({ timeout: 20_000 });
});

test('order: pick a block to see its parents; scrub runs the line-up', async ({ page, errors }) => {
  test.slow();
  const go = page.locator('#oGo');
  await expect(go).toBeEnabled({ timeout: 40_000 });
  const ins = page.locator('#orderInspect');
  const c = page.locator('#orderCanvas');
  await c.scrollIntoViewIfNeeded();
  const box = await c.boundingBox();
  let hit = false;
  for (let gy = 0.15; gy < 0.9 && !hit; gy += 0.07) for (let gx = 0.1; gx < 0.95 && !hit; gx += 0.04) {
    await page.mouse.click(box.x + box.width * gx, box.y + box.height * gy);
    hit = /^Block [0-9a-f]{8}…, mined/.test(await ins.textContent());
  }
  expect(hit, 'some point on the canvas selects a block').toBe(true);
  await expect(ins).toContainText(/Points at \d+ parent/);
  await go.click();
  const scrub = page.locator('#oScrub');
  await expect(scrub).toBeEnabled();
  await setRange(page, '#oScrub', 300);
  await expect(page.locator('#orderOut')).toContainText(/Scrubbing: [\d,]+ of [\d,]+ blocks threaded/);
  await setRange(page, '#oScrub', 1000);
  await expect(page.locator('#orderOut')).toContainText(/in one line/);
});

test('duel: both markers appear on the log ruler and move', async ({ page, errors }) => {
  await page.locator('#c4').scrollIntoViewIfNeeded();
  await expect(page.locator('#trackSvg .tax text')).toHaveCount(6);
  await expect(page.locator('#trackSvg')).toContainText(/Kaspa( settles)?: 1 to 3 s/);
  await page.click('#dGo');
  const marks = page.locator('#trackSvg .tmark');
  await expect(marks.first()).toHaveAttribute('opacity', '1', { timeout: 5_000 });
  const x0 = await marks.first().getAttribute('transform');
  await page.waitForTimeout(1200);
  expect(await marks.first().getAttribute('transform')).not.toBe(x0);
});

test('vault: dragging the coin onto a zone judges the move', async ({ page, errors }) => {
  const coin = page.locator('#vCoin'); await coin.scrollIntoViewIfNeeded();
  const zone = page.locator('[data-try=steal]');
  const a = await coin.boundingBox(), b = await zone.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(a.x + a.width / 2 + (b.x + b.width / 2 - a.x - a.width / 2) * i / 12, a.y + a.height / 2 + (b.y + b.height / 2 - a.y - a.height / 2) * i / 12);
  await page.mouse.up();
  await expect(page.locator('#vaultOut')).not.toHaveText('Pick a move.');
  await expect(page.locator('#ruleCold')).toHaveClass('fail');
  await page.click('[data-try=cold]');
  await expect(page.locator('#ruleCold')).toHaveClass('pass');
  await page.click('[data-try=wait]');
  await expect(page.locator('#ruleDate')).toHaveClass('pass');
});

test('money: five waffles of 100 cells, emission plot click moves the year', async ({ page, errors }) => {
  await page.locator('#c5').scrollIntoViewIfNeeded();
  await expect(page.locator('#fairPlot .waffle')).toHaveCount(5);
  await expect(page.locator('#fairPlot .waffle').first()).toContainText('100 of 100');
  const before = await page.locator('#emitOut').textContent();
  const p = page.locator('#emitPlot svg'); const bb = await p.boundingBox();
  await page.mouse.move(bb.x + bb.width * 0.6, bb.y + bb.height * 0.5);
  await page.mouse.click(bb.x + bb.width * 0.6, bb.y + bb.height * 0.5);
  await expect(page.locator('#emitOut')).not.toHaveText(before);
  await expect(page.locator('#emitOut')).toContainText(/about [\d.,]+ KAS a second/);
  await setRange(page, '#feeIn', 0);
  await expect(page.locator('#minersGap')).toContainText('zero fee');
});

test('Moose: four first-page covers load, each with alt text', async ({ page, errors }) => {
  const imgs = page.locator('#moose .covers img');
  await imgs.first().scrollIntoViewIfNeeded();
  await expect(imgs).toHaveCount(4);
  for (const im of await imgs.all()) {
    await im.scrollIntoViewIfNeeded();
    await expect(im).toHaveAttribute('alt', /^First page of /);
    await expect.poll(() => im.evaluate(e => e.complete && e.naturalWidth)).toBeGreaterThan(100);
  }
});

test('lookup: "Use a recent one" fills a real id or says why not', async ({ page, errors }) => {
  await page.locator('#lookup').scrollIntoViewIfNeeded();
  await page.waitForTimeout(10_000);
  await page.click('#txRecent');
  await expect(page.locator('#txOut')).toContainText(/Nothing real to hand yet|Accepted|Not accepted|outputs total|Looking/, { timeout: 15_000 });
});

test.describe('offline', () => {
  test('txRecent is honest when the network is unreachable', async ({ page }) => {
    await offline(page); await page.goto('./');
    await page.locator('#lookup').scrollIntoViewIfNeeded();
    await page.click('#txRecent');
    await expect(page.locator('#txOut')).toContainText('Nothing real to hand yet');
  });
});
