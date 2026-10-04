import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import { cleanupExpiredAwaitingPayments, paymentDeadline } from '@/lib/appointment-cleanup'
import { formatCustomerName } from '@/lib/customer'

export const dynamic = 'force-dynamic'

/**
 * Card payments waiting for manual review. Receipts live in Telegram, so this only returns
 * the booking details the manager needs to match against the message they received.
 */
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || !isManager(user.role)) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    await cleanupExpiredAwaitingPayments()

    const url = new URL(request.url)
    const includeReviewed = url.searchParams.get('includeReviewed') === 'true'

    const payments = await prisma.payment.findMany({
      where: {
        status: includeReviewed
          ? { in: ['SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED'] }
          : 'SUBMITTED',
        appointment: { salonId },
      },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        expirationMinutes: true,
        paymentSubmittedAt: true,
        paymentExpiresAt: true,
        paymentApprovedAt: true,
        paymentRejectedAt: true,
        paymentRejectionReason: true,
        appointment: {
          select: {
            id: true,
            trackingCode: true,
            status: true,
            startTime: true,
            createdAt: true,
            totalPrice: true,
            depositAmount: true,
            balanceDue: true,
            customer: { select: { firstName: true, lastName: true, phone: true } },
            staff: { select: { user: { select: { firstName: true, lastName: true } } } },
            services: { select: { serviceName: true } },
          },
        },
      },
      orderBy: { paymentSubmittedAt: 'asc' },
    })

    return NextResponse.json({
      serverNow: new Date().toISOString(),
      payments: payments.map((payment) => ({
        id: payment.id,
        appointmentId: payment.appointment.id,
        trackingCode: payment.appointment.trackingCode,
        appointmentStatus: payment.appointment.status,
        paymentStatus: payment.status,
        amount: payment.amount,
        totalPrice: payment.appointment.totalPrice,
        balanceDue: payment.appointment.balanceDue,
        customerName: formatCustomerName(payment.appointment.customer),
        customerPhone: payment.appointment.customer.phone,
        staffName: `${payment.appointment.staff.user.firstName ?? ''} ${
          payment.appointment.staff.user.lastName ?? ''
        }`.trim(),
        services: payment.appointment.services.map((service) => service.serviceName),
        startTime: payment.appointment.startTime.toISOString(),
        bookedAt: payment.appointment.createdAt.toISOString(),
        submittedAt: payment.paymentSubmittedAt?.toISOString() ?? null,
        expiresAt: paymentDeadline({
          createdAt: payment.createdAt,
          expirationMinutes: payment.expirationMinutes,
          paymentSubmittedAt: payment.paymentSubmittedAt,
          paymentExpiresAt: payment.paymentExpiresAt,
        }).toISOString(),
        approvedAt: payment.paymentApprovedAt?.toISOString() ?? null,
        rejectedAt: payment.paymentRejectedAt?.toISOString() ?? null,
        rejectionReason: payment.paymentRejectionReason,
      })),
    })
  } catch (error) {
    console.error('Pending payments error:', error)
    return NextResponse.json({ error: 'خطا در دریافت پرداخت‌ها' }, { status: 500 })
  }
}
