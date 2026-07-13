import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  SlotHoldError,
  createOrRefreshSlotHold,
  releaseHoldsByToken,
} from '@/lib/slot-hold'

const holdSchema = z.object({
  holdToken: z.string().min(1),
  date: z.string(),
  startTime: z.string(),
  serviceIds: z.array(z.string()).min(1),
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
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = holdSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر است' }, { status: 400 })
    }

    const { holdToken, date, startTime, serviceIds, staffId } = validation.data

    const staff = await prisma.staff.findFirst({
      where: { id: staffId, salonId: salon.id, isActive: true, user: { isActive: true } },
    })
    if (!staff) {
      return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 400 })
    }

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, salonId: salon.id, isActive: true },
      select: { duration: true },
    })
    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: 'خدمات انتخاب‌شده معتبر نیستند' }, { status: 400 })
    }

    const durationMinutes = services.reduce((sum, service) => sum + service.duration, 0)

    await createOrRefreshSlotHold({
      salonId: salon.id,
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
