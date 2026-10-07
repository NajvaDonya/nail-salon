import { test, expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { englishToPersian, formatPersianDate, formatPersianTime } from '../../lib/jalali'

const SALON_SLUG = 'nail-art-studio'
const BOOK_URL = `/salon/${SALON_SLUG}/book`

function gregorianDateKey(offsetDays: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function findManagerOpenSlot(request: APIRequestContext) {
  const servicesRes = await request.get(`/api/salons/${SALON_SLUG}/services`)
  expect(servicesRes.ok()).toBeTruthy()
  const servicesBody = (await servicesRes.json()) as {
    services: { id: string; name: string; kind: string }[]
  }
  const baseService =
    servicesBody.services.find((s) => s.kind === 'BASE' && s.name.includes('مانیکور')) ??
    servicesBody.services.find((s) => s.kind === 'BASE')
  if (!baseService) return null

  const staffRes = await request.get(
    `/api/salons/${SALON_SLUG}/staff?services=${baseService.id}&qualifiedOnly=true`
  )
  expect(staffRes.ok()).toBeTruthy()
  const staffBody = (await staffRes.json()) as {
    staff: { id: string; isSalonManager?: boolean; user: { role?: string } }[]
  }
  const managerStaff =
    staffBody.staff.find((s) => s.isSalonManager || s.user.role === 'MANAGER') ?? staffBody.staff[0]
  if (!managerStaff) return null

  for (let offset = 0; offset < 21; offset++) {
    const date = gregorianDateKey(offset)
    const params = new URLSearchParams({
      staffId: managerStaff.id,
      date,
      baseServiceIds: baseService.id,
      selections: '[]',
    })
    const slotsRes = await request.get(`/api/salons/${SALON_SLUG}/slots?${params}`)
    if (!slotsRes.ok()) continue
    const slotsBody = (await slotsRes.json()) as {
      slots: { start: string; available: boolean }[]
    }
    const open = slotsBody.slots?.find((s) => s.available)
    if (open) {
      return { staffId: managerStaff.id, date, startTime: open.start, serviceName: baseService.name }
    }
  }
  return null
}

async function goToStaffStep(page: import('@playwright/test').Page) {
  await page.goto(BOOK_URL)
  await expect(page.getByRole('heading', { name: 'انتخاب خدمات' })).toBeVisible({ timeout: 60_000 })
  const serviceCard = page.locator('.cursor-pointer').filter({ has: page.getByRole('paragraph') }).first()
  await expect(serviceCard).toBeVisible({ timeout: 30_000 })
  await serviceCard.click()
  await page.getByRole('button', { name: 'بعدی' }).click()
  await page.getByRole('button', { name: 'بعدی' }).click()
  await expect(page.getByRole('heading', { name: 'انتخاب پرسنل و زمان' })).toBeVisible()
}

test.describe('manager staff booking UI', () => {
  test('manager appears in staff select with Admin name', async ({ page }) => {
    await goToStaffStep(page)
    const staffTrigger = page.locator('#staff-select')
    await staffTrigger.click()
    await expect(page.getByRole('option').filter({ hasText: 'مدیر سالن' }).first()).toBeVisible()
    await page.getByRole('option').filter({ hasText: 'مدیر سالن' }).first().click()
    await expect(staffTrigger).toContainText('Admin')
  })

  test('can reach payment step when an open slot exists', async ({ page, request }) => {
    test.setTimeout(120_000)
    const open = await findManagerOpenSlot(request)
    test.skip(!open, 'No open slot in API scan (21 days) for manager staff in E2E DB')

    await goToStaffStep(page)

    const staffTrigger = page.locator('#staff-select')
    await staffTrigger.click()
    await page.getByRole('option').filter({ hasText: 'مدیر سالن' }).first().click()

    const target = new Date(`${open!.date}T12:00:00`)
    const dayLabel = englishToPersian(formatPersianDate(target, 'd'))
    const calendar = page.locator('div[dir="rtl"]').filter({ has: page.locator('.grid-cols-7') })
    const nextMonth = calendar.locator('.flex.items-center.justify-between button').last()

    let dayCell = calendar
      .locator('.grid-cols-7 button.min-h-\\[52px\\]:not([disabled])')
      .filter({ hasText: dayLabel })
      .first()
    for (let guard = 0; guard < 8 && !(await dayCell.isVisible().catch(() => false)); guard++) {
      await nextMonth.click()
    }
    await expect(dayCell).toBeVisible({ timeout: 15_000 })

    const slotsResponse = page.waitForResponse(
      (res) => res.url().includes('/slots?') && res.status() === 200,
      { timeout: 20_000 }
    )
    await dayCell.click()
    await slotsResponse

    const slotLabel = formatPersianTime(open!.startTime.slice(0, 5))
    const slotBtn = page
      .locator('.grid-cols-3 button, .sm\\:grid-cols-4 button')
      .filter({ hasText: slotLabel })
      .first()
    await expect(slotBtn).toBeVisible({ timeout: 15_000 })
    await slotBtn.click()

    await page.getByRole('button', { name: 'بعدی' }).click()
    await expect(page.getByRole('heading', { name: 'پرداخت بیعانه' })).toBeVisible({ timeout: 15_000 })
  })

  test('staff select fits viewport without horizontal overflow', async ({ page }) => {
    await goToStaffStep(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    expect(overflow).toBe(false)
  })
})
