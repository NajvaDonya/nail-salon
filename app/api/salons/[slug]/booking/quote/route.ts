import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import {
  BookingQuoteError,
  computeBookingQuote,
  mergeSelections,
  type ServiceSelection,
} from '@/lib/booking-quote'

const quoteSchema = z.object({
  visitTypeId: z.string().optional(),
  preferredStaffId: z.string().optional(),
  baseServiceIds: z.array(z.string()).min(1),
  selections: z
    .array(
      z.object({
        serviceId: z.string(),
        quantity: z.number().int().min(1).default(1),
      })
    )
    .default([]),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = quoteSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات نامعتبر', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { visitTypeId, preferredStaffId, baseServiceIds, selections } = validation.data

    if (visitTypeId) {
      const visitType = await prisma.visitType.findFirst({
        where: { id: visitTypeId, salonId: salon.id, isActive: true },
      })
      if (!visitType) {
        return NextResponse.json({ error: 'نوع مراجعه نامعتبر است' }, { status: 400 })
      }
    }

    const mergedSelections = mergeSelections(baseServiceIds, selections as ServiceSelection[])

    const quote = await computeBookingQuote(prisma, {
      salonId: salon.id,
      baseServiceIds,
      selections: mergedSelections,
      preferredStaffId,
    })

    return NextResponse.json({ quote })
  } catch (error) {
    if (error instanceof BookingQuoteError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Booking quote error:', error)
    return NextResponse.json({ error: 'خطا در محاسبه نوبت' }, { status: 500 })
  }
}
