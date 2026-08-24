import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import { resolveSalonAccess } from '@/lib/salon-access'
import {
  buildSalonHoursFromDb,
  buildStaffHoursFromDb,
  WEEK_DAYS,
  type SalonHourRow,
  type StaffHourRow,
} from '@/lib/schedule'
import { z } from 'zod'

const daySchema = z.enum([
  'SATURDAY',
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
])

const patchSchema = z.object({
  scope: z.enum(['salon', 'staff']),
  staffId: z.string().optional(),
  salonHours: z
    .array(
      z.object({
        dayOfWeek: daySchema,
        openTime: z.string(),
        closeTime: z.string(),
        isClosed: z.boolean(),
      })
    )
    .optional(),
  staffHours: z
    .array(
      z.object({
        dayOfWeek: daySchema,
        startTime: z.string(),
        endTime: z.string(),
        isOff: z.boolean(),
      })
    )
    .optional(),
  staffBreak: z
    .object({
      restMinutes: z.number().min(0).max(120),
      lunchStart: z.string().optional(),
      lunchEnd: z.string().optional(),
    })
    .optional(),
})

async function resolveSalonContext(user: { id: string; role: string; salonId?: string | null }) {
  return resolveSalonAccess(user)
}

async function loadSalonHours(salonId: string): Promise<SalonHourRow[]> {
  const rows = await prisma.workingHour.findMany({
    where: { salonId },
    select: {
      dayOfWeek: true,
      openTime: true,
      closeTime: true,
      isClosed: true,
    },
  })

  return buildSalonHoursFromDb(rows)
}

async function loadStaffHours(salonHours: SalonHourRow[], staffId: string): Promise<StaffHourRow[]> {
  const rows = await prisma.staffWorkingHour.findMany({
    where: { staffId },
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      isOff: true,
    },
  })

  return buildStaffHoursFromDb(salonHours, rows)
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    if (user.role !== 'MANAGER' && user.role !== 'STAFF' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const { salonId, staffId: ownStaffId } = await resolveSalonContext(user)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const salonHours = await loadSalonHours(salonId)

    if (user.role === 'STAFF') {
      if (!ownStaffId) {
        return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 })
      }

      const staffHours = await loadStaffHours(salonHours, ownStaffId)
      const staff = await prisma.staff.findFirst({
        where: { id: ownStaffId },
        select: { restMinutes: true, lunchStart: true, lunchEnd: true },
      })
      return NextResponse.json({
        salonHours,
        staffHours,
        staffBreak: {
          restMinutes: staff?.restMinutes ?? 0,
          lunchStart: staff?.lunchStart ?? '',
          lunchEnd: staff?.lunchEnd ?? '',
        },
      })
    }

    return NextResponse.json({ salonHours })
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return NextResponse.json({ error: 'خطا در دریافت برنامه کاری' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    if (user.role !== 'MANAGER' && user.role !== 'STAFF' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const { salonId, staffId: ownStaffId } = await resolveSalonContext(user)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = patchSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر' }, { status: 400 })
    }

    const { scope, salonHours, staffHours, staffBreak } = validation.data

    if (scope === 'staff') {
      if (user.role !== 'STAFF') {
        return NextResponse.json(
          { error: 'هر پرسنل باید برنامه کاری خود را شخصاً تنظیم کند' },
          { status: 403 }
        )
      }
    }

    if (scope === 'salon') {
      if (!isManager(user.role)) {
        return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
      }
      if (!salonHours || salonHours.length !== WEEK_DAYS.length) {
        return NextResponse.json({ error: 'برنامه سالن ناقص است' }, { status: 400 })
      }

      await Promise.all(
        salonHours.map((row) =>
          prisma.workingHour.upsert({
            where: {
              salonId_dayOfWeek: { salonId, dayOfWeek: row.dayOfWeek },
            },
            update: {
              openTime: row.openTime,
              closeTime: row.closeTime,
              isClosed: row.isClosed,
            },
            create: {
              salonId,
              dayOfWeek: row.dayOfWeek,
              openTime: row.openTime,
              closeTime: row.closeTime,
              isClosed: row.isClosed,
            },
          })
        )
      )

      return NextResponse.json({ success: true, message: 'برنامه سالن ذخیره شد' })
    }

    if (!staffHours || staffHours.length !== WEEK_DAYS.length) {
      return NextResponse.json({ error: 'برنامه پرسنل ناقص است' }, { status: 400 })
    }

    let targetStaffId = ownStaffId ?? undefined

    if (!targetStaffId) {
      return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 })
    }

    const staff = await prisma.staff.findFirst({
      where: { id: targetStaffId, salonId },
    })

    if (!staff) {
      return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 })
    }

    await Promise.all(
      staffHours.map((row) =>
        prisma.staffWorkingHour.upsert({
          where: {
            staffId_dayOfWeek: { staffId: staff.id, dayOfWeek: row.dayOfWeek },
          },
          update: {
            startTime: row.startTime,
            endTime: row.endTime,
            isOff: row.isOff,
          },
          create: {
            staffId: staff.id,
            dayOfWeek: row.dayOfWeek,
            startTime: row.startTime,
            endTime: row.endTime,
            isOff: row.isOff,
          },
        })
      )
    )

    if (staffBreak) {
      await prisma.staff.update({
        where: { id: staff.id },
        data: {
          restMinutes: staffBreak.restMinutes,
          lunchStart: staffBreak.lunchStart || null,
          lunchEnd: staffBreak.lunchEnd || null,
        },
      })
    }

    return NextResponse.json({ success: true, message: 'برنامه شما ذخیره شد' })
  } catch (error) {
    console.error('Error updating schedule:', error)
    return NextResponse.json({ error: 'خطا در ذخیره برنامه کاری' }, { status: 500 })
  }
}
