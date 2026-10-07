import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { prisma, resetDb, seedManager, seedSalon } from '../helpers/db'
import { ensureManagerStaffProfile } from '@/lib/manager-staff'

describe('ensureManagerStaffProfile idempotency', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates once and returns same staff on repeated calls', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)

    const first = await ensureManagerStaffProfile(manager.id, salon.id, {
      specialties: ['تست'],
      isActive: true,
    })
    const second = await ensureManagerStaffProfile(manager.id, salon.id)
    const third = await ensureManagerStaffProfile(manager.id, salon.id)

    expect(second.id).toBe(first.id)
    expect(third.id).toBe(first.id)
    expect(
      await prisma.staff.count({
        where: { userId: manager.id, salonId: salon.id },
      })
    ).toBe(1)
    expect(manager.role).toBe('MANAGER')
  })

  it('parallel ensure resolves to a single staff row', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)

    const results = await Promise.all([
      ensureManagerStaffProfile(manager.id, salon.id, { isActive: true }),
      ensureManagerStaffProfile(manager.id, salon.id, { isActive: true }),
    ])

    expect(results[0].id).toBe(results[1].id)
    expect(
      await prisma.staff.count({
        where: { userId: manager.id, salonId: salon.id },
      })
    ).toBe(1)
  })
})
