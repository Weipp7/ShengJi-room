import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const artifactDir = 'docs/iteration/artifacts/ITER-002/screenshots';

async function setNickname(page: Page, nickname: string): Promise<void> {
  await page.goto('/');
  await page.getByPlaceholder('你的昵称').fill(nickname);
}

test('two browser contexts observe a deterministic reveal and counter flow', async ({ browser }) => {
  await mkdir(artifactDir, { recursive: true });
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await setNickname(host, 'E2E甲');
  await host.getByRole('button', { name: '创建房间' }).click();
  await expect(host.locator('.room-code.big')).toBeVisible();
  const roomCode = (await host.locator('.room-code.big').textContent())?.trim();
  expect(roomCode).toMatch(/^[A-Z0-9]{5}$/);

  await setNickname(guest, 'E2E乙');
  await guest.getByPlaceholder('房间码').fill(roomCode!);
  await guest.getByRole('button', { name: '加入' }).last().click();
  await expect(guest.locator('.room-code.big')).toHaveText(roomCode!);
  await guest.getByRole('button', { name: '入座' }).first().click();
  await expect(guest.getByRole('button', { name: '起立旁观' })).toBeVisible();
  await expect(guest.locator('body')).toContainText('E2E乙');

  await host.getByRole('button', { name: '+机器人' }).first().click();
  await host.getByRole('button', { name: '+机器人' }).first().click();
  await expect(host.getByRole('button', { name: '开始游戏' })).toBeEnabled();
  await host.getByRole('button', { name: '开始游戏' }).click();

  await expect(host.locator('body')).toContainText(/抢庄|亮主/);
  await expect(guest.locator('body')).toContainText(/抢庄|亮主/);
  await expect(host.locator('body')).toContainText(roomCode!);
  await expect(guest.locator('body')).toContainText(roomCode!);

  await host.getByRole('button', { name: '♣' }).click();
  // 慢速渐进发牌下，真人可能在机器人首次亮主前先抢庄，也可能是在已有亮主后反主。
  await expect(host.locator('body')).toContainText(/你 (抢庄|反主)/);
  await expect(guest.locator('body')).toContainText(/E2E甲 (抢庄|反主)/);

  await guest.locator('button.bid-nt.lit').click();
  await expect(host.locator('body')).toContainText('反主');
  await expect(guest.locator('body')).toContainText('反主');
  await expect(host.locator('body')).toContainText(/[大小]王一对/);
  await expect(guest.locator('body')).toContainText(/[大小]王一对/);
  await expect(host.locator('.contract-facts')).toContainText('主');
  await expect(host.locator('.contract-facts')).toContainText('队伍级牌');
  await expect(host.locator('.contract-facts')).toContainText('庄');

  await guest.reload();
  await expect(guest.locator('body')).toContainText(roomCode!);
  await expect(guest.locator('body')).toContainText('反主');
  await expect(guest.locator('body')).toContainText(/[大小]王一对/);
  await expect(guest.locator('body')).toContainText('E2E乙');

  await host.screenshot({ path: `${artifactDir}/two-context-counter-host.png`, fullPage: true });
  await guest.screenshot({ path: `${artifactDir}/two-context-counter-guest.png`, fullPage: true });

  const compactContext = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const compact = await compactContext.newPage();
  await setNickname(compact, 'E2E丙');
  await compact.getByPlaceholder('房间码').fill(roomCode!);
  await compact.getByRole('button', { name: '加入' }).last().click();
  await expect(compact.locator('body')).toContainText(/[大小]王一对/);
  await expect(compact.locator('body')).toContainText('反主');
  await expect(compact.locator('.contract-facts')).toContainText('主');
  await expect(compact.locator('.contract-facts')).toContainText('无主');
  await expect(compact.locator('.contract-facts')).toContainText('队伍级牌');
  await expect(compact.locator('.contract-facts')).toContainText('庄');
  await expect(compact.locator('.contract-cards .card-face')).toHaveCount(2);
  const overflow = await compact.evaluate(() => {
    const actionBar = document.querySelector('.action-bar');
    const statusBar = document.querySelector('.status-bar');
    const contractSummary = document.querySelector('.contract-summary');
    return {
      viewportWidth: window.innerWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      actionBarClientWidth: actionBar?.clientWidth ?? 0,
      actionBarScrollWidth: actionBar?.scrollWidth ?? 0,
      statusBarClientWidth: statusBar?.clientWidth ?? 0,
      statusBarScrollWidth: statusBar?.scrollWidth ?? 0,
      contractClientWidth: contractSummary?.clientWidth ?? 0,
      contractScrollWidth: contractSummary?.scrollWidth ?? 0,
    };
  });
  expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.viewportWidth);
  expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.viewportWidth);
  expect(overflow.actionBarScrollWidth).toBeLessThanOrEqual(overflow.actionBarClientWidth);
  expect(overflow.statusBarScrollWidth).toBeLessThanOrEqual(overflow.statusBarClientWidth);
  expect(overflow.contractScrollWidth).toBeLessThanOrEqual(overflow.contractClientWidth);
  const overlappingBadges = await compact.evaluate(() => {
    const badges = [...document.querySelectorAll('.player-badge')].map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        text: el.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    });
    const overlaps: string[] = [];
    for (let i = 0; i < badges.length; i++) {
      for (let j = i + 1; j < badges.length; j++) {
        const a = badges[i];
        const b = badges[j];
        const separated = a.right <= b.left + 2 || b.right <= a.left + 2 || a.bottom <= b.top + 2 || b.bottom <= a.top + 2;
        if (!separated) overlaps.push(`${a.text} / ${b.text}`);
      }
    }
    return overlaps;
  });
  expect(overlappingBadges).toEqual([]);
  await compact.screenshot({ path: `${artifactDir}/two-context-counter-compact.png`, fullPage: true });

  await compactContext.close();
  await hostContext.close();
  await guestContext.close();
});
