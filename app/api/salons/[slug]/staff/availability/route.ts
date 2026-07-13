import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getStaffAvailableTimes } from '@/lib/booking'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const url = new URL(request.url)
    const dateStr = url.searchParams.get('date')
    const serviceIdsParam = url.searchParams.get('serviceIds')
    const holdToken = url.searchParams.get('holdToken') ?? undefined

    if (!dateStr || !serviceIdsParam) {
      return NextResponse.json(
        { error: 'پارامترهای date و serviceIds الزامی هستند' },
        { status: 400 }
      )
    }

    const serviceIds = serviceIdsParam.split(',').filter(Boolean)
    if (serviceIds.length === 0) {
      return NextResponse.json({ error: 'حداقل یک خدمت انتخاب کنید' }, { status: 400 })
    }

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, salonId: salon.id, isActive: true },
      select: { duration: true },
    })

    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: 'خدمات انتخاب‌شده معتبر نیستند' }, { status: 400 })
    }

    const durationMinutes = services.reduce((sum, s) => sum + s.duration, 0)
    const dateKey = dateStr.split('T')[0]

    const staff = await prisma.staff.findMany({
      where: {
        salonId: salon.id,
        isActive: true,
        user: { isActive: true },
        services: { some: { serviceId: { in: serviceIds } } },
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    })

    const availability = await Promise.all(
      staff.map(async (member) => {
        const slots = await getStaffAvailableTimes({
          staffId: member.id,
          salonId: salon.id,
          date: dateKey,
          durationMinutes,
          excludeHoldToken: holdToken,
        })

        return {
          staffId: member.id,
          slots,
        }
      })
    )

    return NextResponse.json({ availability, durationMinutes })
  } catch (error) {
    console.error('Error fetching staff availability:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت زمان‌های خالی پرسنل' },
      { status: 500 }
    )
  }
}
