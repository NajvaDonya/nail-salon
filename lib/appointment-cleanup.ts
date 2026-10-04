import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { DEFAULT_PAYMENT_EXPIRATION_MINUTES } from '@/lib/salon-settings'

type DbClient = Prisma.TransactionClient | typeof prisma

/** Payment states that still hold the slot and can still expire. */
export const OPEN_PAYMENT_STATUSES = ['PENDING', 'SUBMITTED'] as const

export interface PaymentDeadlineInput {
  /** Fallback clock start used before the customer declares the receipt sent. */
  createdAt: Date
  expirationMinutes: number
  paymentSubmittedAt: Date | null
  paymentExpiresAt: Date | null
}

export function computePaymentExpiresAt(submittedAt: Date, expirationMinutes: number): Date {
  const minutes =
    Number.isFinite(expirationMinutes) && expirationMinutes > 0
      ? Math.floor(expirationMinutes)
      : DEFAULT_PAYMENT_EXPIRATION_MINUTES
  return new Date(submittedAt.getTime() + minutes * 60 * 1000)
}

/**
 * Effective server-side deadline. Once the customer declares the receipt sent we use the
 * stored paymentExpiresAt, so later changes to the salon setting cannot move it.
 */
export function paymentDeadline(input: PaymentDeadlineInput): Date {
  if (input.paymentExpiresAt) return input.paymentExpiresAt
  return computePaymentExpiresAt(input.createdAt, input.expirationMinutes)
}

export function isPaymentExpired(
  input: PaymentDeadlineInput,
  now: Date = new Date()
): boolean {
  return now.getTime() >= paymentDeadline(input).getTime()
}

/** Mark one booking expired and release its slot. */
export async function expireAppointmentPayment(
  appointmentId: string,
  client: DbClient = prisma
): Promise<void> {
  await client.payment.updateMany({
    where: { appointmentId, status: { in: [...OPEN_PAYMENT_STATUSES] } },
    data: { status: 'EXPIRED' },
  })
  await client.appointment.update({
    where: { id: appointmentId },
    data: { status: 'EXPIRED' },
  })
}

/**
 * Expire unpaid card-to-card bookings whose server-side deadline has passed and free the
 * calendar. Called before slot queries and checkout, and by the payments cron route.
 */
export async function cleanupExpiredAwaitingPayments(now: Date = new Date()) {
  const open = await prisma.appointment.findMany({
    where: { status: 'AWAITING_PAYMENT' },
    select: {
      id: true,
      createdAt: true,
      payment: {
        select: {
          status: true,
          expirationMinutes: true,
          paymentSubmittedAt: true,
          paymentExpiresAt: true,
        },
      },
    },
  })

  const expiredIds = open
    .filter((appointment) => {
      const payment = appointment.payment
      if (payment && !OPEN_PAYMENT_STATUSES.includes(payment.status as 'PENDING' | 'SUBMITTED')) {
        return false
      }
      return isPaymentExpired(
        {
          createdAt: appointment.createdAt,
          expirationMinutes: payment?.expirationMinutes ?? DEFAULT_PAYMENT_EXPIRATION_MINUTES,
          paymentSubmittedAt: payment?.paymentSubmittedAt ?? null,
          paymentExpiresAt: payment?.paymentExpiresAt ?? null,
        },
        now
      )
    })
    .map((appointment) => appointment.id)

  if (expiredIds.length === 0) {
    return { expired: 0 }
  }

  await prisma.$transaction([
    prisma.payment.updateMany({
      where: {
        appointmentId: { in: expiredIds },
        status: { in: [...OPEN_PAYMENT_STATUSES] },
      },
      data: { status: 'EXPIRED' },
    }),
    prisma.appointment.updateMany({
      where: { id: { in: expiredIds } },
      data: { status: 'EXPIRED' },
    }),
  ])

  return { expired: expiredIds.length }
}
