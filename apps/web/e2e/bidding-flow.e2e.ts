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

  await expect(host.locator('body')).toContainText('叫主');
  await expect(guest.locator('body')).toContainText('叫主');
  await expect(host.locator('body')).toContainText(roomCode!);
  await expect(guest.locator('body')).toContainText(roomCode!);

  await host.getByRole('button', { name: '♣' }).click();
  await expect(host.locator('body')).toContainText('你 亮主');
  await expect(guest.locator('body')).toContainText('E2E甲 亮主');

  await guest.locator('button.bid-nt.lit').click();
  await expect(host.locator('body')).toContainText('反主');
  await expect(guest.locator('body')).toContainText('反主');
  await expect(host.locator('body')).toContainText('小王单张');
  await expect(guest.locator('body')).toContainText('小王单张');

  await host.screenshot({ path: `${artifactDir}/two-context-counter-host.png`, fullPage: true });
  await guest.screenshot({ path: `${artifactDir}/two-context-counter-guest.png`, fullPage: true });

  await hostContext.close();
  await guestContext.close();
});
