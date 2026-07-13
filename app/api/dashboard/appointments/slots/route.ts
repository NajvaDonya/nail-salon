import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import { getStaffAvailableTimes } from '@/lib/booking'
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

export async function GET(request: Request) {
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

    const url = new URL(request.url)
    const date = url.searchParams.get('date')
    const serviceIdsParam = url.searchParams.get('serviceIds')
    const requestedStaffId = url.searchParams.get('staffId')
    const excludeAppointmentId = url.searchParams.get('excludeAppointmentId') ?? undefined
    const holdToken = url.searchParams.get('holdToken') ?? undefined
    const kind = url.searchParams.get('kind') === 'LUNCH' ? 'LUNCH' : 'SERVICE'

    if (kind === 'LUNCH' && user.role === 'MANAGER') {
      return NextResponse.json(
        { error: 'زمان ناهار فقط توسط خود پرسنل تنظیم و رزرو می‌شود' },
        { status: 403 }
      )
    }

    if (!date) {
      return NextResponse.json({ error: 'تاریخ الزامی است' }, { status: 400 })
    }

    const staffId = user.role === 'STAFF' ? ownStaffId : requestedStaffId || null

    if (!staffId) {
      return NextResponse.json({ error: 'پرسنل را انتخاب کنید' }, { status: 400 })
    }

    if (user.role === 'STAFF' && staffId !== ownStaffId) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        salonId,
        isActive: true,
        user: { isActive: true },
      },
    })

    if (!staff) {
      return NextResponse.json({ error: 'پرسنل فعال یافت نشد' }, { status: 400 })
    }

    const breakSettings = await getStaffBreakSettings(staffId, salonId)

    if (kind === 'LUNCH') {
      if (!breakSettings.lunch) {
        return NextResponse.json({ error: 'بازه ناهار برای این پرسنل تنظیم نشده است' }, { status: 400 })
      }

      const durationMinutes = lunchDurationMinutes(breakSettings.lunch)
      const slots = await getStaffAvailableTimes({
        staffId,
        salonId,
        date,
        durationMinutes,
        excludeAppointmentId,
        excludeHoldToken: holdToken,
        kind: 'LUNCH',
      })

      const lunchStart = breakSettings.lunch.start
      const filtered = slots.includes(lunchStart) ? [lunchStart] : slots

      return NextResponse.json({
        slots: filtered,
        durationMinutes,
        endTime: breakSettings.lunch.end,
        kind: 'LUNCH',
        restMinutes: breakSettings.restMinutes,
      })
    }

    if (!serviceIdsParam) {
      return NextResponse.json({ error: 'خدمات الزامی است' }, { status: 400 })
    }

    const serviceIds = serviceIdsParam.split(',').filter(Boolean)
    if (serviceIds.length === 0) {
      return NextResponse.json({ error: 'حداقل یک خدمت انتخاب کنید' }, { status: 400 })
    }

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, salonId, isActive: true },
      select: { id: true, duration: true },
    })

    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: 'خدمات انتخاب‌شده معتبر نیستند' }, { status: 400 })
    }

    const durationMinutes = services.reduce((sum, service) => sum + service.duration, 0)

    const slots = await getStaffAvailableTimes({
      staffId,
      salonId,
      date,
      durationMinutes,
      excludeAppointmentId,
      excludeHoldToken: holdToken,
      kind: 'SERVICE',
    })

    return NextResponse.json({
      slots,
      durationMinutes,
      restMinutes: breakSettings.restMinutes,
      lunch: breakSettings.lunch,
      kind: 'SERVICE',
    })
  } catch (error) {
    console.error('Error fetching appointment slots:', error)
    return NextResponse.json({ error: 'خطا در دریافت زمان‌های خالی' }, { status: 500 })
  }
}
