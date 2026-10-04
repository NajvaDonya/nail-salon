import { defineConfig } from '@playwright/test'

// TEMPORARY verification-only config: same browser projects as playwright.config.ts but with
// no webServer and no .env.test dependency, so a browser launch can be proven in isolation.
export default defineConfig({
  testDir: '.',
  testMatch: '**/ui/__browser-smoke.spec.ts',
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  projects: [
    {
      name: 'desktop',
      use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'tablet',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        viewport: { width: 834, height: 1194 },
        hasTouch: true,
      },
    },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        viewport: { width: 393, height: 851 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      },
    },
  ],
})
