import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import {
  PAYMENT_EXPIRED_MESSAGE,
  approveCardPayment,
  rejectCardPayment,
} from '@/lib/card-payment'
import { z } from 'zod'

const reviewSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({
    action: z.literal('reject'),
    reason: z.string().trim().min(3, 'دلیل رد پرداخت را وارد کنید').max(500),
  }),
])

/** Manager-only manual review of a card-to-card payment. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !isManager(user.role)) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = reviewSchema.safeParse(body)
    if (!validation.success) {
      const message = validation.error.issues[0]?.message
      return NextResponse.json(
        { error: message && message !== 'Required' ? message : 'اطلاعات نامعتبر' },
        { status: 400 }
      )
    }

    const { id } = await params
    const payment = await prisma.payment.findFirst({
      where: { id, appointment: { salonId } },
      select: { appointmentId: true },
    })

    if (!payment) {
      return NextResponse.json({ error: 'پرداخت یافت نشد' }, { status: 404 })
    }

    const result =
      validation.data.action === 'approve'
        ? await approveCardPayment(payment.appointmentId, user.id)
        : await rejectCardPayment(payment.appointmentId, user.id, validation.data.reason)

    if (!result.ok) {
      if (result.reason === 'EXPIRED') {
        return NextResponse.json({ error: PAYMENT_EXPIRED_MESSAGE, expired: true }, { status: 409 })
      }
      if (result.reason === 'ALREADY_APPROVED') {
        return NextResponse.json({ error: 'این پرداخت قبلاً تأیید شده است' }, { status: 409 })
      }
      if (result.reason === 'NOT_FOUND') {
        return NextResponse.json({ error: 'پرداخت یافت نشد' }, { status: 404 })
      }
      return NextResponse.json(
        { error: 'این پرداخت در انتظار بررسی نیست' },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      message:
        validation.data.action === 'approve'
          ? 'پرداخت تأیید شد و نوبت قطعی گردید'
          : 'پرداخت رد شد',
    })
  } catch (error) {
    console.error('Payment review error:', error)
    return NextResponse.json({ error: 'خطا در بررسی پرداخت' }, { status: 500 })
  }
}
