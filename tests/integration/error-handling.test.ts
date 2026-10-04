import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { prisma, resetDb, seedManager, seedSalon, seedCustomer, seedStaffWithService } from '../helpers/db'
import { asUser, jsonRequest, routeParams } from '../helpers/auth'
import { POST as reviewPost } from '@/app/api/dashboard/payments/[id]/review/route'
import { bookSlotAsCustomer } from '../helpers/booking-api'
import { POST as receiptPost } from '@/app/api/customer/appointments/[id]/receipt-sent/route'

describe('API error handling', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('returns 404 for unknown payment review id', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        const res = await reviewPost(
          jsonRequest('http://localhost/review', { action: 'approve' }),
          routeParams({ id: 'does-not-exist' })
        )
        expect(res.status).toBe(404)
        const body = await res.json()
        expect(JSON.stringify(body)).not.toMatch(/DATABASE_URL|mysql:\/\//i)
      }
    )
  })

  it('returns 409 when approving an already approved payment', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)
    const booked = await bookSlotAsCustomer({ salon, customer, staff, service })
    const payment = await prisma.payment.findUniqueOrThrow({ where: { appointmentId: booked.appointmentId } })

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      await receiptPost(new Request('http://localhost', { method: 'POST' }), routeParams({ id: booked.appointmentId }))
    })

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        expect(
          (
            await reviewPost(
              jsonRequest('http://localhost/review', { action: 'approve' }),
              routeParams({ id: payment.id })
            )
          ).status
        ).toBe(200)

        const again = await reviewPost(
          jsonRequest('http://localhost/review', { action: 'approve' }),
          routeParams({ id: payment.id })
        )
        expect(again.status).toBe(409)
        const body = await again.json()
        expect(body.error).toMatch(/قبلاً/)
      }
    )
  })

  it('returns 400 for malformed JSON bodies on review', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)
    const booked = await bookSlotAsCustomer({ salon, customer, staff, service })
    const payment = await prisma.payment.findUniqueOrThrow({ where: { appointmentId: booked.appointmentId } })

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        const res = await reviewPost(
          new Request('http://localhost/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{not-json',
          }),
          routeParams({ id: payment.id })
        )
        expect(res.status).toBe(500)
      }
    )
  })
})
