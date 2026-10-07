import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import {
  ALL_TABLES,
  prisma,
  resetDb,
  seedCustomer,
  seedSalon,
  seedStaffWithService,
  seedAwaitingPaymentAppointment,
} from '../helpers/db'

describe('database and prisma', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('connects to the configured test database', async () => {
    const rows = await prisma.$queryRaw<{ one: bigint }[]>`SELECT 1 AS one`
    expect(Number(rows[0].one)).toBe(1)

    const [{ db }] = await prisma.$queryRaw<{ db: string }[]>`SELECT DATABASE() AS db`
    expect(db).toMatch(/nail_salon_(test|e2e)/)
  })

  it('has every table declared in the schema', async () => {
    const rows = await prisma.$queryRaw<{ TABLE_NAME: string }[]>`
      SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
    `
    // MySQL on Windows folds table names to lower case (lower_case_table_names=1).
    const present = new Set(rows.map((row) => row.TABLE_NAME.toLowerCase()))

    for (const table of ALL_TABLES) {
      expect(present.has(table.toLowerCase()), `missing table ${table}`).toBe(true)
    }
  })

  it('exposes the card payment columns added by the latest migration', async () => {
    const rows = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Payment'
    `
    const columns = new Set(rows.map((row) => row.COLUMN_NAME))

    for (const column of [
      'expirationMinutes',
      'paymentSubmittedAt',
      'paymentExpiresAt',
      'paymentApprovedAt',
      'paymentRejectedAt',
      'paymentRejectionReason',
      'approvedBy',
    ]) {
      expect(columns.has(column), `missing Payment.${column}`).toBe(true)
    }
  })

  it('stores no receipt file column anywhere', async () => {
    const rows = await prisma.$queryRaw<{ TABLE_NAME: string; COLUMN_NAME: string }[]>`
      SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND (COLUMN_NAME LIKE '%receipt%' OR COLUMN_NAME LIKE '%attachment%' OR COLUMN_NAME LIKE '%image%')
    `
    const cmsImageColumns = new Set(['coverImage', 'imageUrl'])
    const offenders = rows.filter(
      (row) =>
        !/telegramReceiptUrl/i.test(row.COLUMN_NAME) && !cmsImageColumns.has(row.COLUMN_NAME)
    )
    expect(offenders).toEqual([])
  })

  it('creates valid rows and reads them back through relations', async () => {
    const salon = await seedSalon()
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)
    const { appointment } = await seedAwaitingPaymentAppointment({
      salonId: salon.id,
      customerId: customer.id,
      staffId: staff.id,
      serviceId: service.id,
    })

    const loaded = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: { salon: true, customer: true, staff: true, services: true, payment: true },
    })

    expect(loaded.salon.id).toBe(salon.id)
    expect(loaded.customer.id).toBe(customer.id)
    expect(loaded.staff.id).toBe(staff.id)
    expect(loaded.services).toHaveLength(1)
    expect(loaded.services[0].serviceName).toBe(service.name)
    expect(loaded.payment?.amount).toBe(loaded.depositAmount)
  })

  it('rejects invalid rows', async () => {
    const salon = await seedSalon()

    // Missing required scalar.
    await expect(
      // @ts-expect-error intentionally incomplete payload
      prisma.service.create({ data: { salonId: salon.id, name: 'ناقص' } })
    ).rejects.toThrow()

    // Value outside the enum.
    await expect(
      prisma.appointment.create({
        data: {
          salonId: salon.id,
          customerId: 'nope',
          staffId: 'nope',
          date: new Date(),
          startTime: new Date(),
          endTime: new Date(),
          totalPrice: 1,
          // @ts-expect-error invalid enum member
          status: 'NOT_A_STATUS',
        },
      })
    ).rejects.toThrow()

    // Unknown foreign key.
    await expect(
      prisma.staff.create({ data: { userId: 'missing-user', salonId: salon.id } })
    ).rejects.toThrow()
  })

  it('enforces unique constraints', async () => {
    const salon = await seedSalon({ slug: 'unique-salon' })
    await expect(seedSalon({ slug: 'unique-salon' })).rejects.toThrow()

    const customer = await seedCustomer({ phone: '09121110000' })
    await expect(seedCustomer({ phone: '09121110000' })).rejects.toThrow()

    const { staff, service } = await seedStaffWithService(salon.id)
    const { appointment } = await seedAwaitingPaymentAppointment({
      salonId: salon.id,
      customerId: customer.id,
      staffId: staff.id,
      serviceId: service.id,
    })

    // One Payment per Appointment.
    await expect(
      prisma.payment.create({ data: { appointmentId: appointment.id, amount: 1000 } })
    ).rejects.toThrow()

    // Salon services are unique per name.
    await expect(
      prisma.service.create({
        data: {
          salonId: salon.id,
          name: service.name,
          duration: 30,
          price: 1000,
          category: 'ناخن',
        },
      })
    ).rejects.toThrow()
  })

  it('keeps a payment from being orphaned (onDelete: Restrict)', async () => {
    const salon = await seedSalon()
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)
    const { appointment } = await seedAwaitingPaymentAppointment({
      salonId: salon.id,
      customerId: customer.id,
      staffId: staff.id,
      serviceId: service.id,
    })

    await expect(prisma.appointment.delete({ where: { id: appointment.id } })).rejects.toThrow()

    await prisma.payment.delete({ where: { appointmentId: appointment.id } })
    await prisma.appointment.delete({ where: { id: appointment.id } })

    expect(await prisma.appointment.count()).toBe(0)
  })

  it('cascades appointment services and blocks deleting a referenced service', async () => {
    const salon = await seedSalon()
    const customer = await seedCustomer()
    const { staff, service } = await seedStaffWithService(salon.id)
    const { appointment } = await seedAwaitingPaymentAppointment({
      salonId: salon.id,
      customerId: customer.id,
      staffId: staff.id,
      serviceId: service.id,
    })

    // AppointmentService.service has no cascade, so the service stays protected.
    await expect(prisma.service.delete({ where: { id: service.id } })).rejects.toThrow()

    await prisma.payment.delete({ where: { appointmentId: appointment.id } })
    await prisma.appointment.delete({ where: { id: appointment.id } })

    expect(await prisma.appointmentService.count()).toBe(0)
  })

  it('rolls back a failed transaction completely', async () => {
    const salon = await seedSalon()

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.service.create({
          data: {
            salonId: salon.id,
            name: 'سرویس تراکنشی',
            duration: 30,
            price: 1000,
            category: 'ناخن',
          },
        })
        await tx.visitType.create({
          data: { salonId: salon.id, name: 'نوع تراکنشی', behavior: 'GENERAL' },
        })
        throw new Error('rollback please')
      })
    ).rejects.toThrow('rollback please')

    expect(await prisma.service.count()).toBe(0)
    expect(await prisma.visitType.count()).toBe(0)
  })

  it('commits a successful transaction', async () => {
    const salon = await seedSalon()

    await prisma.$transaction(async (tx) => {
      await tx.service.create({
        data: {
          salonId: salon.id,
          name: 'سرویس ماندگار',
          duration: 30,
          price: 1000,
          category: 'ناخن',
        },
      })
    })

    expect(await prisma.service.count()).toBe(1)
  })
})
