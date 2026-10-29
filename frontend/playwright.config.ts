import { defineConfig, devices } from '@playwright/test';

/**
 * E2E contra el stack levantado (npm run dev:api + dev:worker + dev:web).
 *   E2E_BASE_URL=http://localhost:5173 npm run test:e2e -w @portal/frontend
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
