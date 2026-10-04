import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { prisma, resetDb, seedCustomer, seedManager, seedSalon, seedStaffWithService } from '../helpers/db'
import { asUser, jsonRequest, routeParams } from '../helpers/auth'
import { bookSlotAsCustomer } from '../helpers/booking-api'
import { POST as receiptPost } from '@/app/api/customer/appointments/[id]/receipt-sent/route'
import { POST as reviewPost } from '@/app/api/dashboard/payments/[id]/review/route'
import { GET as dashPaymentsGet } from '@/app/api/dashboard/payments/route'
import { GET as customerPaymentGet } from '@/app/api/customer/appointments/[id]/payment/route'
import { POST as cronPaymentsPost } from '@/app/api/cron/payments/route'
import { parseSalonSettings } from '@/lib/salon-settings'
import { PATCH as settingsPatch } from '@/app/api/dashboard/settings/route'
import { PAYMENT_EXPIRED_MESSAGE } from '@/lib/card-payment'

describe('card payment flow (API)', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function bookWithManager() {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)
    const booked = await bookSlotAsCustomer({ salon, customer, staff, service })
    const payment = await prisma.payment.findUniqueOrThrow({ where: { appointmentId: booked.appointmentId } })
    return { salon, manager, customer, staff, service, booked, payment }
  }

  it('returns telegram URL from salon settings in checkout (not hard-coded)', async () => {
    const salon = await seedSalon()
    const customer = await seedCustomer()
    const manager = await seedManager(salon.id)
    const { staff, service } = await seedStaffWithService(salon.id)

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        await settingsPatch(
          jsonRequest('http://localhost/api/dashboard/settings', {
            settings: {
              payment: {
                bankCardNumber: '6037000000000000',
                bankAccountOwner: 'مالک',
                paymentPhone: '09120000001',
                telegramReceiptUrl: 'https://t.me/UniqueSalonChannel',
                paymentExpirationMinutes: 30,
              },
            },
          })
        )
      }
    )

    const booked = await bookSlotAsCustomer({ salon, customer, staff, service })
    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      const res = await customerPaymentGet(new Request('http://localhost'), routeParams({ id: booked.appointmentId }))
      const body = await res.json()
      expect(body.payment.card.telegramUrl).toBe('https://t.me/UniqueSalonChannel')
    })
  })

  it('SUBMITTED does not confirm the booking', async () => {
    const { customer, booked } = await bookWithManager()

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      const res = await receiptPost(new Request('http://localhost', { method: 'POST' }), routeParams({ id: booked.appointmentId }))
      expect(res.status).toBe(200)
    })

    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.appointmentId } })
    const payment = await prisma.payment.findUniqueOrThrow({ where: { appointmentId: booked.appointmentId } })
    expect(payment.status).toBe('SUBMITTED')
    expect(appointment.status).toBe('AWAITING_PAYMENT')
  })

  it('is idempotent when declaring receipt sent twice', async () => {
    const { customer, booked } = await bookWithManager()
    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      await receiptPost(new Request('http://localhost', { method: 'POST' }), routeParams({ id: booked.appointmentId }))
      const again = await receiptPost(
        new Request('http://localhost', { method: 'POST' }),
        routeParams({ id: booked.appointmentId })
      )
      const body = await again.json()
      expect(body.alreadySubmitted).toBe(true)
    })
  })

  it('APPROVED moves booking to CONFIRMED', async () => {
    const { manager, customer, booked, payment, salon } = await bookWithManager()

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      await receiptPost(new Request('http://localhost', { method: 'POST' }), routeParams({ id: booked.appointmentId }))
    })

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        const res = await reviewPost(
          jsonRequest('http://localhost/api/dashboard/payments/review', { action: 'approve' }),
          routeParams({ id: payment.id })
        )
        expect(res.status).toBe(200)
      }
    )

    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.appointmentId } })
    const paid = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
    expect(paid.status).toBe('APPROVED')
    expect(appointment.status).toBe('CONFIRMED')
  })

  it('REJECTED cancels booking and stores reason', async () => {
    const { manager, customer, booked, payment, salon } = await bookWithManager()

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      await receiptPost(new Request('http://localhost', { method: 'POST' }), routeParams({ id: booked.appointmentId }))
    })

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        const res = await reviewPost(
          jsonRequest('http://localhost/api/dashboard/payments/review', {
            action: 'reject',
            reason: 'رسید در تلگرام دریافت نشد',
          }),
          routeParams({ id: payment.id })
        )
        expect(res.status).toBe(200)
      }
    )

    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.appointmentId } })
    const paid = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
    expect(paid.status).toBe('REJECTED')
    expect(paid.paymentRejectionReason).toContain('رسید')
    expect(appointment.status).toBe('CANCELLED')
  })

  it('requires rejection reason', async () => {
    const { manager, customer, booked, payment, salon } = await bookWithManager()
    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      await receiptPost(new Request('http://localhost', { method: 'POST' }), routeParams({ id: booked.appointmentId }))
    })

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        const res = await reviewPost(
          jsonRequest('http://localhost/api/dashboard/payments/review', { action: 'reject', reason: 'no' }),
          routeParams({ id: payment.id })
        )
        expect(res.status).toBe(400)
      }
    )
  })

  it('snapshots expirationMinutes on booking and ignores later salon setting changes', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)

    const booked = await bookSlotAsCustomer({ salon, customer, staff, service })
    const paymentBefore = await prisma.payment.findUniqueOrThrow({ where: { appointmentId: booked.appointmentId } })
    expect(paymentBefore.expirationMinutes).toBe(30)

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        await settingsPatch(
          jsonRequest('http://localhost/api/dashboard/settings', {
            settings: { payment: { paymentExpirationMinutes: 90 } },
          })
        )
      }
    )

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      await receiptPost(new Request('http://localhost', { method: 'POST' }), routeParams({ id: booked.appointmentId }))
    })

    const paymentAfter = await prisma.payment.findUniqueOrThrow({ where: { appointmentId: booked.appointmentId } })
    expect(paymentAfter.expirationMinutes).toBe(30)
    expect(paymentAfter.paymentExpiresAt).toBeTruthy()
    const delta =
      paymentAfter.paymentExpiresAt!.getTime() - paymentAfter.paymentSubmittedAt!.getTime()
    expect(delta).toBe(30 * 60 * 1000)
  })

  it('blocks manager approval after server-side expiry', async () => {
    const { manager, customer, booked, payment, salon } = await bookWithManager()

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      await receiptPost(new Request('http://localhost', { method: 'POST' }), routeParams({ id: booked.appointmentId }))
    })

    await prisma.payment.update({
      where: { id: payment.id },
      data: { paymentExpiresAt: new Date(Date.now() - 60_000) },
    })

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        const res = await reviewPost(
          jsonRequest('http://localhost/api/dashboard/payments/review', { action: 'approve' }),
          routeParams({ id: payment.id })
        )
        expect(res.status).toBe(409)
        const body = await res.json()
        expect(body.error).toBe(PAYMENT_EXPIRED_MESSAGE)
      }
    )

    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.appointmentId } })
    expect(appointment.status).toBe('EXPIRED')
  })

  it('expires open payments via cron and releases the slot', async () => {
    const { customer, booked, payment } = await bookWithManager()

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        paymentSubmittedAt: new Date(Date.now() - 40 * 60 * 1000),
        paymentExpiresAt: new Date(Date.now() - 60_000),
        status: 'SUBMITTED',
      },
    })

    const cron = await cronPaymentsPost(
      new Request('http://localhost/api/cron/payments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      })
    )
    expect(cron.status).toBe(200)

    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.appointmentId } })
    const paid = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })
    expect(appointment.status).toBe('EXPIRED')
    expect(paid.status).toBe('EXPIRED')

    const salon = await prisma.salon.findFirstOrThrow()
    const service = await prisma.service.findFirstOrThrow({ where: { salonId: salon.id } })
    const staff = await prisma.staff.findUniqueOrThrow({ where: { id: appointment.staffId } })
    await bookSlotAsCustomer({
      salon,
      customer,
      staff,
      service,
      date: booked.date,
      startTime: booked.startTime,
    })
    expect(await prisma.appointment.count({ where: { status: 'AWAITING_PAYMENT' } })).toBe(1)
  })

  it('lists submitted payments for manager review', async () => {
    const { manager, customer, booked, salon } = await bookWithManager()
    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      await receiptPost(new Request('http://localhost', { method: 'POST' }), routeParams({ id: booked.appointmentId }))
    })

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        const res = await dashPaymentsGet(new Request('http://localhost/api/dashboard/payments'))
        const body = await res.json()
        expect(res.status).toBe(200)
        expect(body.payments.some((p: { appointmentId: string }) => p.appointmentId === booked.appointmentId)).toBe(
          true
        )
      }
    )
  })

  it('does not expose receipt upload fields in checkout JSON', async () => {
    const salon = await seedSalon()
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)
    const booked = await bookSlotAsCustomer({ salon, customer, staff, service })

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      const res = await customerPaymentGet(new Request('http://localhost'), routeParams({ id: booked.appointmentId }))
      const text = JSON.stringify(await res.json())
      expect(text).not.toMatch(/receiptUrl|upload|multipart/i)
    })

    const settings = parseSalonSettings((await prisma.salon.findUniqueOrThrow({ where: { id: salon.id } })).settings)
    expect(settings.payment.telegramReceiptUrl).toContain('t.me')
  })
})
