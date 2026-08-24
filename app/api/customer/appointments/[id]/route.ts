import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

const CANCELLABLE_STATUSES = ['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'] as const
const CANCEL_CUTOFF_MS = 2 * 60 * 60 * 1000

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    const body = await request.json()
    if (body?.action !== 'cancel') {
      return NextResponse.json({ error: 'عملیات نامعتبر است' }, { status: 400 })
    }

    const { id } = await params
    const appointment = await prisma.appointment.findFirst({
      where: { id, customerId: user.id },
      include: { payment: { select: { id: true, status: true } } },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'نوبت یافت نشد' }, { status: 404 })
    }

    if (!CANCELLABLE_STATUSES.includes(appointment.status as (typeof CANCELLABLE_STATUSES)[number])) {
      return NextResponse.json(
        { error: 'این نوبت در وضعیت فعلی قابل لغو نیست' },
        { status: 400 }
      )
    }

    const now = Date.now()
    if (appointment.startTime.getTime() <= now) {
      return NextResponse.json({ error: 'نوبت گذشته قابل لغو نیست' }, { status: 400 })
    }

    if (appointment.startTime.getTime() - now < CANCEL_CUTOFF_MS) {
      return NextResponse.json(
        { error: 'کمتر از ۲ ساعت تا شروع نوبت — لغو آنلاین امکان‌پذیر نیست' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: 'CANCELLED' },
      })

      if (appointment.payment && appointment.payment.status === 'PENDING') {
        await tx.payment.update({
          where: { id: appointment.payment.id },
          data: { status: 'FAILED' },
        })
      }
    })

    return NextResponse.json({ success: true, message: 'نوبت لغو شد' })
  } catch (error) {
    console.error('Customer cancel error:', error)
    return NextResponse.json({ error: 'خطا در لغو نوبت' }, { status: 500 })
  }
}
