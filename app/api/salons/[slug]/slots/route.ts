import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getStaffAvailableTimes, timesToSlotRanges } from '@/lib/booking'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const url = new URL(request.url)
    const staffId = url.searchParams.get('staffId')
    const dateStr = url.searchParams.get('date')
    const serviceIdsParam = url.searchParams.get('serviceIds')
    const holdToken = url.searchParams.get('holdToken') ?? undefined

    if (!staffId || !dateStr || !serviceIdsParam) {
      return NextResponse.json(
        { error: 'پارامترهای staffId، date و serviceIds الزامی هستند' },
        { status: 400 }
      )
    }

    const serviceIds = serviceIdsParam.split(',').filter(Boolean)
    if (serviceIds.length === 0) {
      return NextResponse.json({ error: 'حداقل یک خدمت انتخاب کنید' }, { status: 400 })
    }

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true, settings: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        salonId: salon.id,
        isActive: true,
        user: { isActive: true },
      },
    })

    if (!staff) {
      return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 400 })
    }

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, salonId: salon.id, isActive: true },
      select: { id: true, duration: true, bufferTime: true },
    })

    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: 'خدمات انتخاب‌شده معتبر نیستند' }, { status: 400 })
    }

    const durationMinutes = services.reduce((sum, service) => sum + service.duration, 0)

    const dateKey = dateStr.split('T')[0]
    const times = await getStaffAvailableTimes({
      staffId,
      salonId: salon.id,
      date: dateKey,
      durationMinutes,
      excludeHoldToken: holdToken,
    })

    const slots = timesToSlotRanges(times, durationMinutes)

    return NextResponse.json({ slots, durationMinutes })
  } catch (error) {
    console.error('Error fetching slots:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت زمان‌های خالی' },
      { status: 500 }
    )
  }
}
