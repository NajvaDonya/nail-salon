import { prisma } from '@/lib/db'

/** Unpaid online bookings expire after 30 minutes */
export const AWAITING_PAYMENT_TTL_MS = 30 * 60 * 1000

export function awaitingPaymentCutoff(ttlMs = AWAITING_PAYMENT_TTL_MS): Date {
  return new Date(Date.now() - ttlMs)
}

/**
 * Cancel AWAITING_PAYMENT appointments older than TTL and mark their payments FAILED.
 * Call before slot queries and checkout so abandoned payments free the calendar.
 */
export async function cleanupExpiredAwaitingPayments(ttlMs = AWAITING_PAYMENT_TTL_MS) {
  const cutoff = awaitingPaymentCutoff(ttlMs)

  const expired = await prisma.appointment.findMany({
    where: {
      status: 'AWAITING_PAYMENT',
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  })

  if (expired.length === 0) {
    return { cancelled: 0 }
  }

  const ids = expired.map((a) => a.id)

  await prisma.$transaction([
    prisma.payment.updateMany({
      where: {
        appointmentId: { in: ids },
        status: 'PENDING',
      },
      data: { status: 'FAILED' },
    }),
    prisma.appointment.updateMany({
      where: { id: { in: ids } },
      data: { status: 'CANCELLED' },
    }),
  ])

  return { cancelled: ids.length }
}

export function isAwaitingPaymentExpired(
  createdAt: Date,
  ttlMs = AWAITING_PAYMENT_TTL_MS
): boolean {
  return createdAt.getTime() < Date.now() - ttlMs
}
