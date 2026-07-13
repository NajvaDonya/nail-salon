import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { assertSlotHold, releaseHoldsByToken, SlotHoldError } from '@/lib/slot-hold'
import { createPaymentRequest } from '@/lib/payment'
import { sendAppointmentConfirmation } from '@/lib/sms'
import { z } from 'zod'

const checkoutSchema = z.object({
  serviceIds: z.array(z.string()).min(1),
  staffId: z.string(),
  date: z.string(),
  startTime: z.string(),
  notes: z.string().optional(),
  holdToken: z.string().optional(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'لطفا ابتدا با کد تایید وارد شوید' }, { status: 401 })
    }

    const { slug } = await params
    const body = await request.json()
    const validation = checkoutSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات وارد شده نامعتبر است', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { serviceIds, staffId, date, startTime, notes, holdToken } = validation.data

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true, name: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, salonId: salon.id, isActive: true },
      select: { id: true, price: true, duration: true, name: true },
    })

    if (services.length !== serviceIds.length) {
      return NextResponse.json({ error: 'خدمات انتخاب‌شده نامعتبر است' }, { status: 400 })
    }

    const totalPrice = services.reduce((sum, s) => sum + s.price, 0)
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0)
    const dateKey = date.split('T')[0]
    const appointmentDate = new Date(`${dateKey}T00:00:00`)
    const startDateTime = new Date(`${dateKey}T${startTime}`)
    const endDateTime = new Date(startDateTime.getTime() + totalDuration * 60000)

    try {
      await assertSlotHold({
        staffId,
        date: dateKey,
        startTime,
        durationMinutes: totalDuration,
        holdToken,
      })
    } catch (error) {
      if (error instanceof SlotHoldError) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      throw error
    }

    const conflict = await prisma.appointment.findFirst({
      where: {
        staffId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startTime: { lt: endDateTime },
        endTime: { gt: startDateTime },
      },
    })

    if (conflict) {
      return NextResponse.json({ error: 'این زمان دیگر در دسترس نیست' }, { status: 409 })
    }

    const trackingCode = `SL${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`

    const appointment = await prisma.appointment.create({
      data: {
        salonId: salon.id,
        customerId: user.id,
        staffId,
        date: appointmentDate,
        startTime: startDateTime,
        endTime: endDateTime,
        totalPrice,
        status: 'AWAITING_PAYMENT',
        trackingCode,
        notes,
        services: {
          create: serviceIds.map((serviceId) => ({ serviceId })),
        },
      },
      include: {
        staff: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        services: { include: { service: { select: { name: true } } } },
      },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { authority, paymentUrl } = await createPaymentRequest({
      amount: totalPrice,
      description: `رزرو نوبت ${salon.name}`,
      callbackUrl: `${appUrl}/api/payments/callback?slug=${slug}`,
      mobile: user.phone,
    })

    await prisma.payment.create({
      data: {
        appointmentId: appointment.id,
        amount: totalPrice,
        authority,
      },
    })

    if (holdToken) {
      await releaseHoldsByToken(holdToken)
    }

    return NextResponse.json({
      success: true,
      paymentUrl,
      appointment: {
        id: appointment.id,
        trackingCode: appointment.trackingCode,
        totalPrice: appointment.totalPrice,
      },
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'خطا در ثبت نوبت' }, { status: 500 })
  }
}
