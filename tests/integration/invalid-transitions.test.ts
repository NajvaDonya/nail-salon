import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { prisma, resetDb, seedManager, seedSalon, seedStaffWithService, seedCustomer, seedAwaitingPaymentAppointment } from '../helpers/db'
import { asUser, jsonRequest, routeParams } from '../helpers/auth'
import { POST as reviewPost } from '@/app/api/dashboard/payments/[id]/review/route'
import { bookSlotAsCustomer } from '../helpers/booking-api'
import { POST as receiptPost } from '@/app/api/customer/appointments/[id]/receipt-sent/route'

describe('invalid payment state transitions', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('cannot approve before receipt is submitted', async () => {
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
          jsonRequest('http://localhost/review', { action: 'approve' }),
          routeParams({ id: payment.id })
        )
        expect(res.status).toBe(409)
      }
    )

    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.appointmentId } })
    expect(appointment.status).toBe('AWAITING_PAYMENT')
  })

  it('cannot approve EXPIRED or REJECTED payments', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)

    const expired = await seedAwaitingPaymentAppointment({
      salonId: salon.id,
      customerId: customer.id,
      staffId: staff.id,
      serviceId: service.id,
      paymentStatus: 'EXPIRED',
    })
    await prisma.appointment.update({
      where: { id: expired.appointment.id },
      data: { status: 'EXPIRED' },
    })

    const payment = await prisma.payment.findUniqueOrThrow({ where: { appointmentId: expired.appointment.id } })

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        const res = await reviewPost(
          jsonRequest('http://localhost/review', { action: 'approve' }),
          routeParams({ id: payment.id })
        )
        expect(res.status).toBe(409)
      }
    )
  })

  it('does not confirm on receipt declaration alone', async () => {
    const salon = await seedSalon()
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)
    const booked = await bookSlotAsCustomer({ salon, customer, staff, service })

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      await receiptPost(new Request('http://localhost', { method: 'POST' }), routeParams({ id: booked.appointmentId }))
    })

    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.appointmentId } })
    expect(appointment.status).not.toBe('CONFIRMED')
  })
})
