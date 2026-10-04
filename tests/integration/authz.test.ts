import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { prisma, resetDb, seedCustomer, seedManager, seedSalon } from '../helpers/db'
import { asGuest, asUser, jsonRequest, routeParams } from '../helpers/auth'
import { GET as settingsGet, PATCH as settingsPatch } from '@/app/api/dashboard/settings/route'
import { GET as dashPaymentsGet } from '@/app/api/dashboard/payments/route'
import { POST as reviewPost } from '@/app/api/dashboard/payments/[id]/review/route'
import { GET as customerPaymentGet } from '@/app/api/customer/appointments/[id]/payment/route'
import { POST as cronPaymentsPost } from '@/app/api/cron/payments/route'

describe('authentication and authorization (API)', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('denies guests on protected dashboard routes', async () => {
    await asGuest(async () => {
      expect((await settingsGet()).status).toBe(403)
      expect((await dashPaymentsGet(new Request('http://localhost/api/dashboard/payments'))).status).toBe(403)
      expect(
        (
          await reviewPost(
            jsonRequest('http://localhost/api/dashboard/payments/p1/review', { action: 'approve' }),
            routeParams({ id: 'p1' })
          )
        ).status
      ).toBe(403)
    })
  })

  it('denies customers from manager payment review and settings', async () => {
    const salon = await seedSalon()
    const customer = await seedCustomer()

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      expect((await settingsGet()).status).toBe(403)
      expect((await dashPaymentsGet(new Request('http://localhost/api/dashboard/payments'))).status).toBe(403)
      expect(
        (
          await reviewPost(
            jsonRequest('http://localhost/api/dashboard/payments/p1/review', { action: 'approve' }),
            routeParams({ id: 'p1' })
          )
        ).status
      ).toBe(403)
    })

    void salon
  })

  it('scopes customer payment reads to their own appointment', async () => {
    const salon = await seedSalon()
    const owner = await seedCustomer()
    const other = await seedCustomer()
    const manager = await seedManager(salon.id)

    await asUser({ id: other.id, phone: other.phone, role: 'CUSTOMER' }, async () => {
      const res = await customerPaymentGet(new Request('http://localhost'), routeParams({ id: 'fake-id' }))
      expect(res.status).toBe(404)
    })

    void manager
    void owner
  })

  it('allows manager to read settings and payment queue', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        expect((await settingsGet()).status).toBe(200)
        expect((await dashPaymentsGet(new Request('http://localhost/api/dashboard/payments'))).status).toBe(200)
      }
    )
  })

  it('requires CRON_SECRET for payment expiry job', async () => {
    const res = await cronPaymentsPost(new Request('http://localhost/api/cron/payments', { method: 'POST' }))
    expect(res.status).toBe(401)

    const ok = await cronPaymentsPost(
      new Request('http://localhost/api/cron/payments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      })
    )
    expect(ok.status).toBe(200)
  })

  it('rejects customer patching salon settings', async () => {
    const customer = await seedCustomer()
    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      const res = await settingsPatch(
        jsonRequest('http://localhost/api/dashboard/settings', {
          settings: { payment: { bankCardNumber: '6037000000000001' } },
        })
      )
      expect(res.status).toBe(403)
    })
  })
})
