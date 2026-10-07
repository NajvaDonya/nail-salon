import { test, expect } from '@playwright/test'

test.describe('CMS public surfaces', () => {
  test('blog index is responsive without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/blog')
    await expect(page.locator('main')).toBeVisible({ timeout: 30_000 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    expect(overflow).toBe(false)
  })

  test('booking page hero area loads on desktop', async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /رزرو نوبت/ })).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('.salon-banner').first()).toBeVisible()
  })
})
