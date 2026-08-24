import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import {
  cleanupExpiredAwaitingPayments,
  isAwaitingPaymentExpired,
} from '@/lib/appointment-cleanup'
import { createPaymentRequest } from '@/lib/payment'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    await cleanupExpiredAwaitingPayments()

    const { id } = await params
    const appointment = await prisma.appointment.findFirst({
      where: { id, customerId: user.id },
      include: {
        salon: { select: { slug: true, name: true } },
        payment: true,
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'نوبت یافت نشد' }, { status: 404 })
    }

    if (appointment.status !== 'AWAITING_PAYMENT') {
      return NextResponse.json(
        { error: 'این نوبت در انتظار پرداخت نیست' },
        { status: 400 }
      )
    }

    if (isAwaitingPaymentExpired(appointment.createdAt)) {
      await prisma.$transaction([
        prisma.payment.updateMany({
          where: { appointmentId: appointment.id, status: 'PENDING' },
          data: { status: 'FAILED' },
        }),
        prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: 'CANCELLED' },
        }),
      ])
      return NextResponse.json(
        {
          error: 'زمان پرداخت گذشته — لطفاً دوباره رزرو کنید',
          expired: true,
        },
        { status: 410 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const returnTo = '/'
    const callbackUrl = new URL('/api/payments/callback', appUrl)
    callbackUrl.searchParams.set('slug', appointment.salon.slug)
    callbackUrl.searchParams.set('returnTo', returnTo)

    const { authority, paymentUrl } = await createPaymentRequest({
      amount: appointment.depositAmount,
      description: `بیعانه رزرو نوبت ${appointment.salon.name}`,
      callbackUrl: callbackUrl.toString(),
      mobile: user.phone,
    })

    if (appointment.payment) {
      await prisma.payment.update({
        where: { id: appointment.payment.id },
        data: {
          authority,
          status: 'PENDING',
          amount: appointment.depositAmount,
        },
      })
    } else {
      await prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          amount: appointment.depositAmount,
          authority,
          status: 'PENDING',
        },
      })
    }

    return NextResponse.json({ success: true, paymentUrl })
  } catch (error) {
    console.error('Resume payment error:', error)
    return NextResponse.json({ error: 'خطا در ادامه پرداخت' }, { status: 500 })
  }
}
