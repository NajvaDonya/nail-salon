import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import {
  prisma,
  resetDb,
  seedCustomer,
  seedManagerWithStaffProfile,
  seedSalon,
} from '../helpers/db'
import { asGuest, asUser, jsonRequest, routeParams } from '../helpers/auth'
import { GET as publicStaffGet } from '@/app/api/salons/[slug]/staff/route'
import { GET as scheduleGet } from '@/app/api/dashboard/schedule/route'
import { PATCH as staffPatch } from '@/app/api/dashboard/staff/[id]/route'
import { POST as staffPost } from '@/app/api/dashboard/staff/route'
import { computeQualifiedStaffIds } from '@/lib/booking-quote'
import { getStaffAvailableTimes } from '@/lib/booking'
import {
  bookSlotAsCustomer,
  bookingDateKey,
  checkoutBooking,
  holdSlot,
} from '../helpers/booking-api'

describe('manager as bookable staff', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('links manager user to staff profile and exposes them for booking', async () => {
    const salon = await seedSalon()
    const { manager, staff, service } = await seedManagerWithStaffProfile(salon.id)

    expect(manager.role).toBe('MANAGER')
    const linked = await prisma.staff.findUnique({
      where: { userId_salonId: { userId: manager.id, salonId: salon.id } },
    })
    expect(linked?.id).toBe(staff.id)

    const qualified = await computeQualifiedStaffIds(prisma, salon.id, [service.id])
    expect(qualified).toContain(staff.id)

    const res = await publicStaffGet(
      new Request(
        `http://localhost/api/salons/${salon.slug}/staff?services=${service.id}&qualifiedOnly=true`
      ),
      routeParams({ slug: salon.slug })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.staff.some((s: { id: string }) => s.id === staff.id)).toBe(true)
    expect(body.staff.find((s: { id: string }) => s.id === staff.id).isSalonManager).toBe(true)

    const dateKey = bookingDateKey(4)
    const times = await getStaffAvailableTimes({
      staffId: staff.id,
      salonId: salon.id,
      date: dateKey,
      durationMinutes: service.duration,
    })
    expect(times.length).toBeGreaterThan(0)

    const customer = await seedCustomer()
    const startTime = times[0]
    const booked = await bookSlotAsCustomer({
      salon,
      customer,
      staff,
      service,
      date: dateKey,
      startTime,
    })
    expect(booked.appointmentId).toBeTruthy()

    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: booked.appointmentId },
    })
    expect(appointment.staffId).toBe(staff.id)
    expect(appointment.customerId).toBe(customer.id)

    const holdB = await holdSlot({
      slug: salon.slug,
      staffId: staff.id,
      serviceId: service.id,
      date: dateKey,
      startTime,
      holdToken: randomUUID(),
    })
    expect(holdB.response.ok).toBe(false)

    await prisma.staff.update({ where: { id: staff.id }, data: { isActive: false } })

    const afterInactive = await publicStaffGet(
      new Request(
        `http://localhost/api/salons/${salon.slug}/staff?services=${service.id}&qualifiedOnly=true`
      ),
      routeParams({ slug: salon.slug })
    )
    const inactiveBody = await afterInactive.json()
    expect(inactiveBody.staff.some((s: { id: string }) => s.id === staff.id)).toBe(false)
    expect(await prisma.appointment.count({ where: { id: appointment.id } })).toBe(1)

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        const scheduleRes = await scheduleGet(new Request('http://localhost/api/dashboard/schedule'))
        expect(scheduleRes.status).toBe(200)
        const scheduleBody = await scheduleRes.json()
        expect(scheduleBody.staffHours?.length).toBe(7)
      }
    )

    const customerEscalation = await seedCustomer()
    await asUser(
      { id: customerEscalation.id, phone: customerEscalation.phone, role: 'CUSTOMER' },
      async () => {
        expect((await staffPost(jsonRequest('http://localhost/api/dashboard/staff', {}))).status).toBe(403)
        expect(
          (
            await staffPatch(
              jsonRequest(`http://localhost/api/dashboard/staff/${staff.id}`, { isActive: true }),
              routeParams({ id: staff.id })
            )
          ).status
        ).toBe(403)
      }
    )

    await asGuest(async () => {
      expect(
        (
          await checkoutBooking({
            slug: salon.slug,
            customer,
            staffId: staff.id,
            serviceId: service.id,
            holdToken: randomUUID(),
            date: dateKey,
            startTime: times[1] ?? '11:00',
          })
        ).status
      ).toBeGreaterThanOrEqual(400)
    })
  })
})
