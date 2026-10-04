import { test, expect } from '@playwright/test'

test('browser launches and renders', async ({ page }) => {
  await page.setContent('<h1>ok</h1>')
  await expect(page.getByRole('heading', { name: 'ok' })).toBeVisible()
  expect(await page.evaluate(() => navigator.userAgent)).toContain('Chrome')
  console.log('browser version:', page.context().browser()?.version())
  console.log('user agent:', await page.evaluate(() => navigator.userAgent))
})
