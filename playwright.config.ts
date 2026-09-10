import { defineConfig, devices } from '@playwright/test';

const artifactsDir = 'docs/iteration/artifacts/ITER-002';
const webPort = process.env.SHENGJI_E2E_WEB_PORT ?? '45175';
const browserChannel = process.env.SHENGJI_E2E_BROWSER_CHANNEL as 'chrome' | 'msedge' | undefined;
const videoMode = process.env.SHENGJI_E2E_NO_VIDEO === '1' ? 'off' : 'retain-on-failure';

export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: `${artifactsDir}/playwright-report`, open: 'never' }],
  ],
  outputDir: `${artifactsDir}/test-results`,
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: videoMode,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @shengji/server dev',
      env: {
        PORT: '43101',
        SHENGJI_TEST_SEED: 'bid-new-47',
        SHENGJI_BOT_DELAY_MS: '80',
      },
      url: 'http://127.0.0.1:43101/healthz',
      reuseExistingServer: false,
      timeout: 20_000,
    },
    {
      command: `pnpm --filter @shengji/web dev --host 127.0.0.1 --port ${webPort}`,
      env: { VITE_SERVER_URL: 'http://127.0.0.1:43101' },
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 20_000,
    },
  ],
});
