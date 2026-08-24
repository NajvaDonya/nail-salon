import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { cleanupExpiredAwaitingPayments } from '@/lib/appointment-cleanup'
import { getStaffAvailableTimes, timesToSlotRanges } from '@/lib/booking'
import {
  parseSalonSettings,
  assertOnlineBookingAllowed,
  assertBookingDateWithinLimit,
  OnlineBookingDisabledError,
  BookingDateOutOfRangeError,
} from '@/lib/salon-settings'
import { assertStaffQualifiedForServices, StaffQualificationError } from '@/lib/staff-qualification'
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
    const staffId = url.searchParams.get('staffId')
    const dateStr = url.searchParams.get('date')
    const holdToken = url.searchParams.get('holdToken') ?? undefined
    const baseServiceIds =
      url.searchParams.get('baseServiceIds')?.split(',').filter(Boolean) ??
      url.searchParams.get('serviceIds')?.split(',').filter(Boolean) ??
      []
    const selections = parseSelectionsParam(url.searchParams.get('selections'))

    if (!staffId || !dateStr || baseServiceIds.length === 0) {
      return NextResponse.json(
        { error: 'پارامترهای staffId، date و baseServiceIds الزامی هستند' },
        { status: 400 }
      )
    }

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true, settings: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const salonSettings = parseSalonSettings(salon.settings)
    const dateKey = dateStr.split('T')[0]

    try {
      assertOnlineBookingAllowed(salonSettings)
      assertBookingDateWithinLimit(dateKey, salonSettings)
    } catch (error) {
      if (error instanceof OnlineBookingDisabledError || error instanceof BookingDateOutOfRangeError) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      throw error
    }

    let quote
    try {
      quote = await resolveQuoteForSalon(prisma, salon.id, {
        baseServiceIds,
        selections: mergeSelections(baseServiceIds, selections),
      })
    } catch (error) {
      if (error instanceof BookingQuoteError) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }

    try {
      await assertStaffQualifiedForServices({
        staffId,
        salonId: salon.id,
        serviceIds: quote.serviceIds,
      })
    } catch (error) {
      if (error instanceof StaffQualificationError) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }

    const times = await getStaffAvailableTimes({
      staffId,
      salonId: salon.id,
      date: dateKey,
      durationMinutes: quote.occupiedMinutes,
      excludeHoldToken: holdToken,
    })

    const slots = timesToSlotRanges(times, quote.occupiedMinutes)

    return NextResponse.json({ slots, durationMinutes: quote.occupiedMinutes })
  } catch (error) {
    console.error('Error fetching slots:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت زمان‌های خالی' },
      { status: 500 }
    )
  }
}
