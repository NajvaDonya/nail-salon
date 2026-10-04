import { test, expect } from '@playwright/test'

test.describe('API smoke (no browser)', () => {
  test('health: salon services endpoint responds', async ({ request }) => {
    const res = await request.get('/api/salons/test-salon/services')
    expect([200, 404]).toContain(res.status())
  })
})
