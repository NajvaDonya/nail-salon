import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { cleanupExpiredAwaitingPayments } from '@/lib/appointment-cleanup'
import { buildCardPaymentView } from '@/lib/card-payment'
import { parseSalonSettings } from '@/lib/salon-settings'

export const dynamic = 'force-dynamic'

/** Card details and the server-side deadline for the customer's own booking. */
export async function GET(
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
      select: {
        id: true,
        status: true,
        trackingCode: true,
        depositAmount: true,
        createdAt: true,
        salon: { select: { settings: true } },
        payment: {
          select: {
            amount: true,
            status: true,
            createdAt: true,
            expirationMinutes: true,
            paymentSubmittedAt: true,
            paymentExpiresAt: true,
            paymentRejectionReason: true,
          },
        },
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'نوبت یافت نشد' }, { status: 404 })
    }

    const salonPayment = parseSalonSettings(appointment.salon.settings).payment
    const payment = appointment.payment

    return NextResponse.json({
      appointment: {
        id: appointment.id,
        status: appointment.status,
        trackingCode: appointment.trackingCode,
      },
      payment: buildCardPaymentView({
        amount: payment?.amount ?? appointment.depositAmount,
        status: payment?.status ?? 'PENDING',
        createdAt: payment?.createdAt ?? appointment.createdAt,
        expirationMinutes: payment?.expirationMinutes ?? salonPayment.paymentExpirationMinutes,
        paymentSubmittedAt: payment?.paymentSubmittedAt ?? null,
        paymentExpiresAt: payment?.paymentExpiresAt ?? null,
        paymentRejectionReason: payment?.paymentRejectionReason ?? null,
        salonPayment,
      }),
    })
  } catch (error) {
    console.error('Customer payment info error:', error)
    return NextResponse.json({ error: 'خطا در دریافت اطلاعات پرداخت' }, { status: 500 })
  }
}
