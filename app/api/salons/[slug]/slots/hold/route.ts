import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  SlotHoldError,
  createOrRefreshSlotHold,
  releaseHoldsByToken,
} from '@/lib/slot-hold'
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
  resolveQuoteForSalon,
} from '@/lib/booking-quote'

const selectionSchema = z.object({
  serviceId: z.string(),
  quantity: z.number().int().min(1).default(1),
})

const holdSchema = z.object({
  holdToken: z.string().min(1),
  date: z.string(),
  startTime: z.string(),
  baseServiceIds: z.array(z.string()).min(1),
  selections: z.array(selectionSchema).default([]),
  staffId: z.string(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true, settings: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const salonSettings = parseSalonSettings(salon.settings)

    const body = await request.json()
    const validation = holdSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر است' }, { status: 400 })
    }

    const { holdToken, date, startTime, baseServiceIds, selections, staffId } = validation.data
    const dateKey = date.split('T')[0]

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

    await createOrRefreshSlotHold({
      salonId: salon.id,
      staffId,
      date,
      startTime,
      durationMinutes: quote.occupiedMinutes,
      holdToken,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SlotHoldError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    console.error('Error creating public slot hold:', error)
    return NextResponse.json({ error: 'خطا در رزرو موقت زمان' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await params
    const body = await request.json()
    const holdToken = body?.holdToken as string | undefined
    if (!holdToken) {
      return NextResponse.json({ error: 'شناسه رزرو نامعتبر است' }, { status: 400 })
    }

    await releaseHoldsByToken(holdToken)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error releasing public slot hold:', error)
    return NextResponse.json({ error: 'خطا در آزادسازی زمان' }, { status: 500 })
  }
}
