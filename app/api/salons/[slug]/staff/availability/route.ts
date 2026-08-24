import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cleanupExpiredAwaitingPayments } from '@/lib/appointment-cleanup'
import { getStaffAvailableTimes } from '@/lib/booking'
import {
  BookingQuoteError,
  mergeSelections,
  parseSelectionsParam,
  resolveQuoteForSalon,
} from '@/lib/booking-quote'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await cleanupExpiredAwaitingPayments()
    const { slug } = await params
    const url = new URL(request.url)
    const dateStr = url.searchParams.get('date')
    const holdToken = url.searchParams.get('holdToken') ?? undefined
    const staffIdFilter = url.searchParams.get('staffId')
    const baseServiceIds =
      url.searchParams.get('baseServiceIds')?.split(',').filter(Boolean) ??
      url.searchParams.get('serviceIds')?.split(',').filter(Boolean) ??
      []
    const selections = parseSelectionsParam(url.searchParams.get('selections'))

    if (!dateStr || baseServiceIds.length === 0) {
      return NextResponse.json(
        { error: 'پارامترهای date و baseServiceIds الزامی هستند' },
        { status: 400 }
      )
    }

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    let quote
    try {
      quote = await resolveQuoteForSalon(prisma, salon.id, {
        baseServiceIds,
        selections: mergeSelections(baseServiceIds, selections),
        preferredStaffId: staffIdFilter,
      })
    } catch (error) {
      if (error instanceof BookingQuoteError) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }

    const dateKey = dateStr.split('T')[0]
    const qualifiedStaffIds = staffIdFilter
      ? quote.qualifiedStaffIds
      : quote.qualifiedStaffIds

    const staff = await prisma.staff.findMany({
      where: {
        id: { in: qualifiedStaffIds },
        salonId: salon.id,
        isActive: true,
        user: { isActive: true },
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
          durationMinutes: quote.occupiedMinutes,
          excludeHoldToken: holdToken,
        })

        return {
          staffId: member.id,
          slots,
        }
      })
    )

    return NextResponse.json({
      availability,
      durationMinutes: quote.occupiedMinutes,
      qualifiedStaffIds: quote.qualifiedStaffIds,
    })
  } catch (error) {
    console.error('Error fetching staff availability:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت زمان‌های خالی پرسنل' },
      { status: 500 }
    )
  }
}
