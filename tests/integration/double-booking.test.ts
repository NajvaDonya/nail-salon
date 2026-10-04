import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { prisma, resetDb, seedCustomer, seedSalon, seedStaffWithService } from '../helpers/db'
import { bookSlotAsCustomer, bookingDateKey, checkoutBooking, holdSlot } from '../helpers/booking-api'

describe('double booking and race conditions', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('allows only one successful checkout for the same slot under concurrent requests', async () => {
    const salon = await seedSalon()
    const customerA = await seedCustomer()
    const customerB = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)
    const date = bookingDateKey(5)
    const startTime = '14:00'

    const holdA = await holdSlot({
      slug: salon.slug,
      staffId: staff.id,
      serviceId: service.id,
      date,
      startTime,
      holdToken: randomUUID(),
    })
    const holdB = await holdSlot({
      slug: salon.slug,
      staffId: staff.id,
      serviceId: service.id,
      date,
      startTime,
      holdToken: randomUUID(),
    })

    expect(holdA.response.ok).toBe(true)
    expect(holdB.response.ok).toBe(false)

    const [res1, res2] = await Promise.all([
      checkoutBooking({
        slug: salon.slug,
        customer: customerA,
        staffId: staff.id,
        serviceId: service.id,
        holdToken: holdA.holdToken,
        date,
        startTime,
      }),
      checkoutBooking({
        slug: salon.slug,
        customer: customerB,
        staffId: staff.id,
        serviceId: service.id,
        holdToken: holdB.holdToken,
        date,
        startTime,
      }),
    ])

    const statuses = [res1.status, res2.status].sort()
    expect(statuses).toEqual([200, 409])
    expect(await prisma.appointment.count({ where: { staffId: staff.id, status: 'AWAITING_PAYMENT' } })).toBe(1)
  })

  it('serializes three checkout attempts on one valid hold to a single appointment', async () => {
    const salon = await seedSalon()
    const customers = await Promise.all([seedCustomer(), seedCustomer(), seedCustomer()])
    const { staff, service } = await seedStaffWithService(salon.id)
    const date = bookingDateKey(6)
    const startTime = '15:00'
    const hold = await holdSlot({
      slug: salon.slug,
      staffId: staff.id,
      serviceId: service.id,
      date,
      startTime,
    })

    const results = await Promise.all(
      customers.map((customer) =>
        checkoutBooking({
          slug: salon.slug,
          customer,
          staffId: staff.id,
          serviceId: service.id,
          holdToken: hold.holdToken,
          date,
          startTime,
        })
      )
    )

    const okCount = results.filter((r) => r.status === 200).length
    expect(okCount).toBe(1)
    expect(await prisma.appointment.count()).toBe(1)
  })
})
