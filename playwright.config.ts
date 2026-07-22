import { defineConfig, devices } from '@playwright/test';

const artifactsDir = 'docs/iteration/artifacts/ITER-002';

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
    baseURL: 'http://127.0.0.1:45175',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command:
        'PORT=43101 SHENGJI_TEST_SEED=iter-002 SHENGJI_BOT_DELAY_MS=80 pnpm --filter @shengji/server exec tsx src/index.ts',
      url: 'http://127.0.0.1:43101/healthz',
      reuseExistingServer: false,
      timeout: 20_000,
    },
    {
      command:
        'VITE_SERVER_URL=http://127.0.0.1:43101 pnpm --filter @shengji/web exec vite --host 127.0.0.1 --port 45175',
      url: 'http://127.0.0.1:45175',
      reuseExistingServer: false,
      timeout: 20_000,
    },
  ],
});
