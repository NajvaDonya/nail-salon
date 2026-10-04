import type { PrismaClient, Staff } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { WEEK_DAYS } from '@/lib/schedule'

type Db = Pick<
  PrismaClient,
  'user' | 'staff' | 'staffService' | 'staffWorkingHour' | 'workingHour' | 'salon'
>

export interface EnsureManagerStaffOptions {
  specialties?: string[]
  serviceIds?: string[]
  isActive?: boolean
  /** When true, copy salon working hours into staff hours if the profile has none yet. */
  syncWorkingHoursFromSalon?: boolean
}

/**
 * Ensures the salon manager (same User, role stays MANAGER) has a Staff profile for booking.
 * Does not create a duplicate User or change role.
 */
export async function ensureManagerStaffProfile(
  userId: string,
  salonId: string,
  options: EnsureManagerStaffOptions = {},
  db: Db = defaultPrisma
): Promise<Staff> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, salonId: true },
  })

  if (!user || user.role !== 'MANAGER') {
    throw new Error('کاربر مدیر سالن یافت نشد')
  }

  if (user.salonId && user.salonId !== salonId) {
    throw new Error('مدیر به این سالن تعلق ندارد')
  }

  const specialties = options.specialties ?? ['مدیریت سالن']
  const isActive = options.isActive ?? true

  let staff = await db.staff.findUnique({
    where: { userId_salonId: { userId, salonId } },
  })

  if (!staff) {
    staff = await db.staff.create({
      data: {
        userId,
        salonId,
        specialties,
        isActive,
      },
    })
  } else if (options.specialties !== undefined || options.isActive !== undefined) {
    staff = await db.staff.update({
      where: { id: staff.id },
      data: {
        ...(options.specialties !== undefined ? { specialties: options.specialties } : {}),
        ...(options.isActive !== undefined ? { isActive: options.isActive } : {}),
      },
    })
  }

  if (options.serviceIds?.length) {
    const valid = await db.staffService.findMany({
      where: { staffId: staff.id, serviceId: { in: options.serviceIds } },
      select: { serviceId: true },
    })
    const have = new Set(valid.map((v) => v.serviceId))
    const toAdd = options.serviceIds.filter((id) => !have.has(id))
    if (toAdd.length > 0) {
      await db.staffService.createMany({
        data: toAdd.map((serviceId) => ({ staffId: staff.id, serviceId })),
        skipDuplicates: true,
      })
    }
  }

  if (options.syncWorkingHoursFromSalon !== false) {
    const existingHours = await db.staffWorkingHour.count({ where: { staffId: staff.id } })
    if (existingHours === 0) {
      const salonHours = await db.workingHour.findMany({
        where: { salonId },
        select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
      })
      const byDay = new Map(salonHours.map((h) => [h.dayOfWeek, h]))

      await db.staffWorkingHour.createMany({
        data: WEEK_DAYS.map((dayOfWeek) => {
          const row = byDay.get(dayOfWeek)
          const closed = row?.isClosed ?? false
          return {
            staffId: staff!.id,
            dayOfWeek,
            startTime: row?.openTime ?? '09:00',
            endTime: row?.closeTime ?? '18:00',
            isOff: closed,
          }
        }),
        skipDuplicates: true,
      })
    }
  }

  return staff
}

/** Ensures the salon owner (if MANAGER) has a bookable Staff profile. */
export async function ensureSalonOwnerStaffProfile(
  salonId: string,
  options: EnsureManagerStaffOptions = {},
  db: Db = defaultPrisma
): Promise<Staff | null> {
  const salon = await db.salon.findUnique({
    where: { id: salonId },
    select: { ownerId: true },
  })
  if (!salon?.ownerId) return null

  const owner = await db.user.findUnique({
    where: { id: salon.ownerId },
    select: { id: true, role: true },
  })
  if (!owner || owner.role !== 'MANAGER') return null

  return ensureManagerStaffProfile(owner.id, salonId, options, db)
}
