import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from '@playwright/test'
import { assertMySqlTestDatabase } from './tests/helpers/env'

/**
 * Minimal .env.test loader. Kept inline so the Playwright config has no dotenv dependency
 * and so the same values reach both this config and the dev server it spawns.
 */
function loadEnvFile(file: string): Record<string, string> {
  const vars: Record<string, string> = {}

  let raw: string
  try {
    raw = readFileSync(file, 'utf8')
  } catch {
    throw new Error(`Missing ${file}. Create it before running the e2e suite.`)
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    vars[key] = value
  }

  return vars
}

const testEnv = loadEnvFile(resolve(__dirname, '.env.test'))
for (const [key, value] of Object.entries(testEnv)) {
  process.env[key] ??= value
}
assertMySqlTestDatabase(testEnv.DATABASE_URL ?? process.env.DATABASE_URL)

const BASE_URL = testEnv.NEXT_PUBLIC_APP_URL || 'http://localhost:3100'

export default defineConfig({
  testDir: './e2e',
  // The whole suite shares a single test database, so never run files concurrently.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx next dev -p 3100',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: testEnv,
  },
  projects: [
    {
      // Route-level tests drive the `request` fixture only; no browser is launched.
      name: 'api',
      testMatch: '**/api/**/*.spec.ts',
    },
    {
      name: 'desktop',
      testMatch: '**/{ui,responsive}/**/*.spec.ts',
      // Playwright's own Chromium build is geo-blocked here, so drive the installed Chrome.
      use: { browserName: 'chromium', channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
    {
      // iPad Pro 11 viewport.
      name: 'tablet',
      testMatch: '**/{ui,responsive}/**/*.spec.ts',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        viewport: { width: 834, height: 1194 },
        hasTouch: true,
      },
    },
    {
      // Pixel 5 viewport.
      name: 'mobile',
      testMatch: '**/{ui,responsive}/**/*.spec.ts',
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
