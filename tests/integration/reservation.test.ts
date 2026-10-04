import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma, resetDb, seedCustomer, seedSalon, seedStaffWithService } from '../helpers/db'
import { asUser, jsonRequest, routeParams } from '../helpers/auth'
import { POST as checkoutPost } from '@/app/api/salons/[slug]/checkout/route'
import { POST as holdPost } from '@/app/api/salons/[slug]/slots/hold/route'
import { PATCH as customerAppointmentPatch } from '@/app/api/customer/appointments/[id]/route'
import { bookSlotAsCustomer, bookingDateKey, holdSlot } from '../helpers/booking-api'

describe('reservation flow (API)', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('books a valid slot end-to-end', async () => {
    const salon = await seedSalon()
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)

    const booked = await bookSlotAsCustomer({ salon, customer, staff, service })
    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.appointmentId } })
    expect(row.status).toBe('AWAITING_PAYMENT')
    expect(row.trackingCode).toBeTruthy()
  })

  it('rejects checkout without login', async () => {
    const salon = await seedSalon()
    const { staff, service } = await seedStaffWithService(salon.id)
    const hold = await holdSlot({ slug: salon.slug, staffId: staff.id, serviceId: service.id })

    const res = await checkoutPost(
      jsonRequest(`http://localhost/api/salons/${salon.slug}/checkout`, {
        baseServiceIds: [service.id],
        staffId: staff.id,
        date: hold.date,
        startTime: hold.startTime,
        holdToken: hold.holdToken,
      }),
      routeParams({ slug: salon.slug })
    )
    expect(res.status).toBe(401)
  })

  it('rejects incomplete checkout payload', async () => {
    const salon = await seedSalon()
    const customer = await seedCustomer()
    const { staff } = await seedStaffWithService(salon.id)

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      const res = await checkoutPost(
        jsonRequest(`http://localhost/api/salons/${salon.slug}/checkout`, {
          staffId: staff.id,
          date: bookingDateKey(),
          startTime: '10:00',
        }),
        routeParams({ slug: salon.slug })
      )
      expect(res.status).toBe(400)
    })
  })

  it('allows the same clock time on different calendar days', async () => {
    const salon = await seedSalon()
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)

    const dayA = bookingDateKey(3)
    const dayB = bookingDateKey(4)

    await bookSlotAsCustomer({ salon, customer, staff, service, date: dayA, startTime: '11:00' })
    await bookSlotAsCustomer({ salon, customer, staff, service, date: dayB, startTime: '11:00' })

    expect(await prisma.appointment.count()).toBe(2)
  })

  it('lets customer cancel an awaiting-payment booking far in the future', async () => {
    const salon = await seedSalon()
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)
    const booked = await bookSlotAsCustomer({ salon, customer, staff, service })

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      const res = await customerAppointmentPatch(
        jsonRequest(`http://localhost/api/customer/appointments/${booked.appointmentId}`, {
          action: 'cancel',
        }),
        routeParams({ id: booked.appointmentId })
      )
      expect(res.status).toBe(200)
    })

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.appointmentId } })
    expect(row.status).toBe('CANCELLED')
  })

  it('rejects hold with invalid service', async () => {
    const salon = await seedSalon()
    const { staff } = await seedStaffWithService(salon.id)

    const res = await holdPost(
      jsonRequest(`http://localhost/api/salons/${salon.slug}/slots/hold`, {
        holdToken: randomUUID(),
        date: bookingDateKey(),
        startTime: '10:00',
        baseServiceIds: ['missing-service'],
        staffId: staff.id,
      }),
      routeParams({ slug: salon.slug })
    )
    expect(res.status).toBe(400)
  })
})
