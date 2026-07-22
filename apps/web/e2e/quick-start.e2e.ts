import { mkdir } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

const artifactDir = 'docs/iteration/artifacts/ITER-018/screenshots';

async function clickIfReady(page: Page, name: string | RegExp): Promise<boolean> {
  const button = page.getByRole('button', { name }).first();
  if (!(await button.isVisible().catch(() => false))) return false;
  if (!(await button.isEnabled().catch(() => false))) return false;
  await button.click();
  return true;
}

async function selectCards(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const card = page.locator('.hand-fan .card-face:not(.selected)').first();
    if (!(await card.isVisible().catch(() => false))) return;
    await card.click();
  }
}

test('quick robot table starts the game without a manual start click', async ({ page }) => {
  await mkdir(artifactDir, { recursive: true });

  await page.goto('/');
  await page.getByPlaceholder('你的昵称').fill('E2E快开');
  await page.getByRole('button', { name: '开一桌' }).click();

  await expect(page.locator('body')).toContainText(/叫主|埋底|出牌|结算/, { timeout: 15_000 });
  await expect(page.locator('body')).toContainText('房间');
  await page.screenshot({ path: `${artifactDir}/quick-start-auto-game.png`, fullPage: true });
});

test('quick robot table can be played to an explanatory settlement and auto-continued', async ({ page }) => {
  test.setTimeout(80_000);
  await mkdir(artifactDir, { recursive: true });

  await page.goto('/');
  await page.getByPlaceholder('你的昵称').fill('E2E整局');
  await page.getByRole('button', { name: '开一桌' }).click();

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const bodyText = await page.locator('body').innerText();
    if (bodyText.includes('本局结算')) break;

    if (await clickIfReady(page, '过')) {
      await page.waitForTimeout(80);
      continue;
    }

    const bury = page.getByRole('button', { name: /确认埋牌|处理中/ }).first();
    if (await bury.isVisible().catch(() => false)) {
      await selectCards(page, 8);
      await clickIfReady(page, /确认埋牌/);
      await page.waitForTimeout(80);
      continue;
    }

    if (await clickIfReady(page, '提示')) {
      await clickIfReady(page, /出牌/);
      await page.waitForTimeout(80);
      continue;
    }

    await page.waitForTimeout(120);
  }

  await expect(page.locator('body')).toContainText('本局结算', { timeout: 5_000 });
  await expect(page.locator('body')).toContainText(/庄家.*\+|闲家.*\+|换庄 \(不升级\)/);
  await expect(page.locator('body')).toContainText('闲家基础得分');
  await expect(page.locator('body')).toContainText('扣底说明');
  await expect(page.locator('body')).toContainText(/秒后自动继续/);
  await page.screenshot({ path: `${artifactDir}/quick-start-explanatory-settlement.png`, fullPage: true });

  await expect(page.locator('body')).not.toContainText('本局结算', { timeout: 15_000 });
  await expect(page.locator('body')).toContainText(/叫主|埋底|出牌/, { timeout: 5_000 });
  await expect(page.locator('.contract-facts')).toBeVisible();
  await page.screenshot({ path: `${artifactDir}/quick-start-auto-continued-round.png`, fullPage: true });
});

test('regular room creation still waits for an explicit start', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.sessionStorage.setItem('shengji:quickStartPending', '1'));
  await page.getByPlaceholder('你的昵称').fill('E2E普通');
  await page.getByRole('button', { name: '创建房间' }).click();

  await expect(page.locator('.room-code.big')).toBeVisible();
  await expect(page.getByRole('button', { name: /等待坐满 4 人|开始游戏/ })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/叫主|埋底|出牌|结算/);
});
