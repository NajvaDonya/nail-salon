import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import {
  prisma,
  resetDb,
  seedCustomer,
  seedManagerWithStaffProfile,
  seedSalon,
} from '../helpers/db'
import { asUser, jsonRequest, routeParams } from '../helpers/auth'
import { bookSlotAsCustomer, bookingDateKey } from '../helpers/booking-api'
import { POST as receiptPost } from '@/app/api/customer/appointments/[id]/receipt-sent/route'
import { POST as reviewPost } from '@/app/api/dashboard/payments/[id]/review/route'
import { POST as cronPaymentsPost } from '@/app/api/cron/payments/route'
import { PATCH as settingsPatch } from '@/app/api/dashboard/settings/route'
import { PAYMENT_EXPIRED_MESSAGE } from '@/lib/card-payment'
import { getStaffAvailableTimes } from '@/lib/booking'
import { GET as publicStaffGet } from '@/app/api/salons/[slug]/staff/route'

async function patchPaymentSettings(manager: { id: string; phone: string }, salonId: string) {
  await asUser(
    { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId },
    async () => {
      await settingsPatch(
        jsonRequest('http://localhost/api/dashboard/settings', {
          settings: {
            payment: {
              bankCardNumber: '6037000000000000',
              bankAccountOwner: 'مدیر',
              paymentPhone: '09120000000',
              telegramReceiptUrl: 'https://t.me/manager_staff_test',
              paymentExpirationMinutes: 30,
            },
          },
        })
      )
    }
  )
}

describe('manager staff payment flow (API)', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('APPROVED confirms booking when staff is manager profile', async () => {
    const salon = await seedSalon({ slug: `mgr-pay-${Date.now()}` })
    const { manager, staff, service } = await seedManagerWithStaffProfile(salon.id)
    const customer = await seedCustomer()

    await patchPaymentSettings(manager, salon.id)

    const dateKey = bookingDateKey(4)
    const times = await getStaffAvailableTimes({
      staffId: staff.id,
      salonId: salon.id,
      date: dateKey,
      durationMinutes: service.duration,
    })
    expect(times.length).toBeGreaterThan(0)

    const booked = await bookSlotAsCustomer({
      salon,
      customer,
      staff,
      service,
      date: dateKey,
      startTime: times[0],
    })

    const appointmentBefore = await prisma.appointment.findUniqueOrThrow({
      where: { id: booked.appointmentId },
    })
    expect(appointmentBefore.staffId).toBe(staff.id)
    expect(appointmentBefore.staffId).not.toBe(manager.id)
    expect(appointmentBefore.status).toBe('AWAITING_PAYMENT')

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { appointmentId: booked.appointmentId },
    })

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      const res = await receiptPost(
        new Request('http://localhost', { method: 'POST' }),
        routeParams({ id: booked.appointmentId })
      )
      expect(res.status).toBe(200)
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

    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: booked.appointmentId },
    })
    expect(appointment.staffId).toBe(staff.id)
    expect(appointment.status).toBe('CONFIRMED')
  })

  it('blocks approval after server-side expiry for manager staff booking', async () => {
    const salon = await seedSalon({ slug: `mgr-exp-${Date.now()}` })
    const { manager, staff, service } = await seedManagerWithStaffProfile(salon.id)
    const customer = await seedCustomer()
    await patchPaymentSettings(manager, salon.id)

    const dateKey = bookingDateKey(5)
    const times = await getStaffAvailableTimes({
      staffId: staff.id,
      salonId: salon.id,
      date: dateKey,
      durationMinutes: service.duration,
    })
    const booked = await bookSlotAsCustomer({
      salon,
      customer,
      staff,
      service,
      date: dateKey,
      startTime: times[0],
    })
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { appointmentId: booked.appointmentId },
    })

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
    expect(appointment.staffId).toBe(staff.id)
  })

  it('cron expiry releases manager staff slot for rebooking', async () => {
    const salon = await seedSalon({ slug: `mgr-cron-${Date.now()}` })
    const { manager, staff, service } = await seedManagerWithStaffProfile(salon.id)
    const customer = await seedCustomer()
    await patchPaymentSettings(manager, salon.id)

    const dateKey = bookingDateKey(6)
    const times = await getStaffAvailableTimes({
      staffId: staff.id,
      salonId: salon.id,
      date: dateKey,
      durationMinutes: service.duration,
    })
    const booked = await bookSlotAsCustomer({
      salon,
      customer,
      staff,
      service,
      date: dateKey,
      startTime: times[0],
    })
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { appointmentId: booked.appointmentId },
    })

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

    await bookSlotAsCustomer({
      salon,
      customer,
      staff,
      service,
      date: dateKey,
      startTime: times[0],
    })
    expect(await prisma.appointment.count({ where: { status: 'AWAITING_PAYMENT' } })).toBe(1)
  })

  it('hides inactive manager staff from public list', async () => {
    const salon = await seedSalon({ slug: `mgr-inact-${Date.now()}` })
    const { staff, service } = await seedManagerWithStaffProfile(salon.id)

    await prisma.staff.update({ where: { id: staff.id }, data: { isActive: false } })

    const res = await publicStaffGet(
      new Request(
        `http://localhost/api/salons/${salon.slug}/staff?services=${service.id}&qualifiedOnly=true`
      ),
      routeParams({ slug: salon.slug })
    )
    const body = await res.json()
    expect(body.staff.some((s: { id: string }) => s.id === staff.id)).toBe(false)
  })
})
