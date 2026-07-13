import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import {
  SlotHoldError,
  createOrRefreshSlotHold,
  releaseHoldsByToken,
} from '@/lib/slot-hold'
import { getStaffBreakSettings, lunchDurationMinutes } from '@/lib/staff-breaks'

async function resolveSalonAccess(user: { id: string; role: string; salonId?: string | null }) {
  if (user.role === 'MANAGER') {
    const salonId = await getManagerSalonId(user.id, user.salonId)
    return { salonId, staffId: null as string | null }
  }

  if (user.role === 'STAFF') {
    const staff = await prisma.staff.findFirst({
      where: { userId: user.id, isActive: true, user: { isActive: true } },
      select: { id: true, salonId: true },
    })
    return { salonId: staff?.salonId ?? null, staffId: staff?.id ?? null }
  }

  return { salonId: null, staffId: null }
}

const holdSchema = z.object({
  holdToken: z.string().min(1),
  date: z.string(),
  startTime: z.string(),
  kind: z.enum(['SERVICE', 'LUNCH']).default('SERVICE'),
  serviceIds: z.array(z.string()).optional(),
  staffId: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    if (user.role !== 'MANAGER' && user.role !== 'STAFF') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const { salonId, staffId: ownStaffId } = await resolveSalonAccess(user)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = holdSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر است' }, { status: 400 })
    }

    const { holdToken, date, startTime, kind, serviceIds, staffId: requestedStaffId } = validation.data

    if (kind === 'LUNCH' && user.role === 'MANAGER') {
      return NextResponse.json(
        { error: 'زمان ناهار فقط توسط خود پرسنل تنظیم و رزرو می‌شود' },
        { status: 403 }
      )
    }

    const staffId = user.role === 'STAFF' ? ownStaffId : requestedStaffId ?? null

    if (!staffId) {
      return NextResponse.json({ error: 'پرسنل را انتخاب کنید' }, { status: 400 })
    }

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, salonId, isActive: true, user: { isActive: true } },
    })
    if (!staff) {
      return NextResponse.json({ error: 'پرسنل فعال یافت نشد' }, { status: 400 })
    }

    let durationMinutes: number

    if (kind === 'LUNCH') {
      const breakSettings = await getStaffBreakSettings(staffId, salonId)
      if (!breakSettings.lunch) {
        return NextResponse.json({ error: 'بازه ناهار تنظیم نشده است' }, { status: 400 })
      }
      durationMinutes = lunchDurationMinutes(breakSettings.lunch)
    } else {
      if (!serviceIds?.length) {
        return NextResponse.json({ error: 'خدمات الزامی است' }, { status: 400 })
      }
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds }, salonId, isActive: true },
        select: { duration: true },
      })
      if (services.length !== serviceIds.length) {
        return NextResponse.json({ error: 'خدمات انتخاب‌شده معتبر نیستند' }, { status: 400 })
      }
      durationMinutes = services.reduce((sum, service) => sum + service.duration, 0)
    }

    await createOrRefreshSlotHold({
      salonId,
      staffId,
      date,
      startTime,
      durationMinutes,
      holdToken,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SlotHoldError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('Error creating slot hold:', error)
    return NextResponse.json({ error: 'خطا در رزرو موقت زمان' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    const body = await request.json()
    const holdToken = body?.holdToken as string | undefined
    if (!holdToken) {
      return NextResponse.json({ error: 'شناسه رزرو نامعتبر است' }, { status: 400 })
    }

    await releaseHoldsByToken(holdToken)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error releasing slot hold:', error)
    return NextResponse.json({ error: 'خطا در آزادسازی زمان' }, { status: 500 })
  }
}
