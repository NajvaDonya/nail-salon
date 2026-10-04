import { prisma } from '@/lib/db'
import {
  computePaymentExpiresAt,
  expireAppointmentPayment,
  isPaymentExpired,
  paymentDeadline,
} from '@/lib/appointment-cleanup'
import {
  DEFAULT_PAYMENT_EXPIRATION_MINUTES,
  type SalonPaymentInfo,
} from '@/lib/salon-settings'
import { PERSIAN_PAYMENT_STATUS } from '@/lib/types'
import type { AppointmentStatus, PaymentStatus } from '@/lib/types'

export const PAYMENT_EXPIRED_MESSAGE =
  'زمان این رزرو به پایان رسیده و امکان تأیید پرداخت وجود ندارد.'
export const RECEIPT_ALREADY_SUBMITTED_MESSAGE =
  'رسید شما ارسال شده و در انتظار بررسی مدیر است.'

export interface CardPaymentView {
  amount: number
  status: PaymentStatus
  statusLabel: string
  /** Server-computed deadline. The client may only render a countdown from it. */
  expiresAt: string
  serverNow: string
  submittedAt: string | null
  rejectionReason: string | null
  card: {
    number: string
    owner: string
    phone: string
    telegramUrl: string
  }
}

export function buildCardPaymentView(input: {
  amount: number
  status: PaymentStatus
  createdAt: Date
  expirationMinutes: number
  paymentSubmittedAt: Date | null
  paymentExpiresAt: Date | null
  paymentRejectionReason: string | null
  salonPayment: SalonPaymentInfo
  now?: Date
}): CardPaymentView {
  const now = input.now ?? new Date()

  return {
    amount: input.amount,
    status: input.status,
    statusLabel: PERSIAN_PAYMENT_STATUS[input.status],
    expiresAt: paymentDeadline({
      createdAt: input.createdAt,
      expirationMinutes: input.expirationMinutes,
      paymentSubmittedAt: input.paymentSubmittedAt,
      paymentExpiresAt: input.paymentExpiresAt,
    }).toISOString(),
    serverNow: now.toISOString(),
    submittedAt: input.paymentSubmittedAt?.toISOString() ?? null,
    rejectionReason: input.paymentRejectionReason,
    card: {
      number: input.salonPayment.bankCardNumber,
      owner: input.salonPayment.bankAccountOwner,
      phone: input.salonPayment.paymentPhone,
      telegramUrl: input.salonPayment.telegramReceiptUrl,
    },
  }
}

export interface PaymentStateInput {
  appointmentStatus: AppointmentStatus
  paymentStatus: PaymentStatus | null
  createdAt: Date
  expirationMinutes: number
  paymentSubmittedAt: Date | null
  paymentExpiresAt: Date | null
}

export type ReceiptSubmissionDecision =
  | { kind: 'SUBMIT'; submittedAt: Date; expiresAt: Date }
  | { kind: 'ALREADY_SUBMITTED'; expiresAt: Date }
  | { kind: 'EXPIRED' }
  | { kind: 'NOT_AWAITING_PAYMENT' }

/**
 * Customers may only declare that they sent the receipt in Telegram. This never confirms
 * the booking; it only moves the payment to SUBMITTED and starts the stored deadline.
 */
export function decideReceiptSubmission(
  state: PaymentStateInput,
  now: Date = new Date()
): ReceiptSubmissionDecision {
  if (state.appointmentStatus !== 'AWAITING_PAYMENT') {
    if (state.appointmentStatus === 'EXPIRED') return { kind: 'EXPIRED' }
    return { kind: 'NOT_AWAITING_PAYMENT' }
  }

  if (state.paymentStatus === 'EXPIRED' || isPaymentExpired(state, now)) {
    return { kind: 'EXPIRED' }
  }

  if (state.paymentStatus === 'SUBMITTED') {
    return { kind: 'ALREADY_SUBMITTED', expiresAt: paymentDeadline(state) }
  }

  if (state.paymentStatus !== null && state.paymentStatus !== 'PENDING') {
    return { kind: 'NOT_AWAITING_PAYMENT' }
  }

  const expirationMinutes = state.expirationMinutes || DEFAULT_PAYMENT_EXPIRATION_MINUTES
  return {
    kind: 'SUBMIT',
    submittedAt: now,
    expiresAt: computePaymentExpiresAt(now, expirationMinutes),
  }
}

export type PaymentReviewDecision =
  | { kind: 'ALLOW' }
  | { kind: 'EXPIRED' }
  | { kind: 'ALREADY_APPROVED' }
  | { kind: 'NOT_SUBMITTED' }

/** Manager-side guard. Re-checks the deadline against server time on every review action. */
export function decidePaymentReview(
  state: PaymentStateInput,
  now: Date = new Date()
): PaymentReviewDecision {
  if (state.paymentStatus === 'APPROVED') return { kind: 'ALREADY_APPROVED' }

  if (
    state.appointmentStatus === 'EXPIRED' ||
    state.paymentStatus === 'EXPIRED' ||
    isPaymentExpired(state, now)
  ) {
    return { kind: 'EXPIRED' }
  }

  if (state.appointmentStatus !== 'AWAITING_PAYMENT' || state.paymentStatus !== 'SUBMITTED') {
    return { kind: 'NOT_SUBMITTED' }
  }

  return { kind: 'ALLOW' }
}

interface LoadedPayment {
  appointmentId: string
  paymentId: string | null
  state: PaymentStateInput
}

async function loadPaymentState(appointmentId: string): Promise<LoadedPayment | null> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      payment: {
        select: {
          id: true,
          status: true,
          expirationMinutes: true,
          paymentSubmittedAt: true,
          paymentExpiresAt: true,
        },
      },
    },
  })

  if (!appointment) return null

  return {
    appointmentId: appointment.id,
    paymentId: appointment.payment?.id ?? null,
    state: {
      appointmentStatus: appointment.status as AppointmentStatus,
      paymentStatus: (appointment.payment?.status as PaymentStatus | undefined) ?? null,
      createdAt: appointment.createdAt,
      expirationMinutes:
        appointment.payment?.expirationMinutes ?? DEFAULT_PAYMENT_EXPIRATION_MINUTES,
      paymentSubmittedAt: appointment.payment?.paymentSubmittedAt ?? null,
      paymentExpiresAt: appointment.payment?.paymentExpiresAt ?? null,
    },
  }
}

export type SubmitReceiptResult =
  | { ok: true; alreadySubmitted: boolean; expiresAt: Date }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'NOT_AWAITING_PAYMENT' }

/** Marks the receipt as declared sent. The booking stays unconfirmed. */
export async function submitReceiptDeclaration(
  appointmentId: string,
  now: Date = new Date()
): Promise<SubmitReceiptResult> {
  const loaded = await loadPaymentState(appointmentId)
  if (!loaded) return { ok: false, reason: 'NOT_FOUND' }

  const decision = decideReceiptSubmission(loaded.state, now)

  if (decision.kind === 'EXPIRED') {
    await expireAppointmentPayment(appointmentId)
    return { ok: false, reason: 'EXPIRED' }
  }

  if (decision.kind === 'NOT_AWAITING_PAYMENT') {
    return { ok: false, reason: 'NOT_AWAITING_PAYMENT' }
  }

  if (decision.kind === 'ALREADY_SUBMITTED') {
    return { ok: true, alreadySubmitted: true, expiresAt: decision.expiresAt }
  }

  await prisma.payment.update({
    where: { appointmentId },
    data: {
      status: 'SUBMITTED',
      paymentSubmittedAt: decision.submittedAt,
      paymentExpiresAt: decision.expiresAt,
      paymentRejectedAt: null,
      paymentRejectionReason: null,
    },
  })

  return { ok: true, alreadySubmitted: false, expiresAt: decision.expiresAt }
}

export type ReviewResult =
  | { ok: true }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'ALREADY_APPROVED' | 'NOT_SUBMITTED' }

/** Only reachable from the manager dashboard. Confirms the booking when still in time. */
export async function approveCardPayment(
  appointmentId: string,
  managerId: string,
  now: Date = new Date()
): Promise<ReviewResult> {
  const loaded = await loadPaymentState(appointmentId)
  if (!loaded || !loaded.paymentId) return { ok: false, reason: 'NOT_FOUND' }

  const decision = decidePaymentReview(loaded.state, now)

  if (decision.kind === 'EXPIRED') {
    await expireAppointmentPayment(appointmentId)
    return { ok: false, reason: 'EXPIRED' }
  }

  if (decision.kind !== 'ALLOW') {
    return { ok: false, reason: decision.kind }
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: loaded.paymentId },
      data: {
        status: 'APPROVED',
        paymentApprovedAt: now,
        approvedBy: managerId,
        paidAt: now,
      },
    }),
    prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CONFIRMED' },
    }),
  ])

  return { ok: true }
}

export async function rejectCardPayment(
  appointmentId: string,
  managerId: string,
  reason: string,
  now: Date = new Date()
): Promise<ReviewResult> {
  const loaded = await loadPaymentState(appointmentId)
  if (!loaded || !loaded.paymentId) return { ok: false, reason: 'NOT_FOUND' }

  const decision = decidePaymentReview(loaded.state, now)

  if (decision.kind === 'EXPIRED') {
    await expireAppointmentPayment(appointmentId)
    return { ok: false, reason: 'EXPIRED' }
  }

  if (decision.kind !== 'ALLOW') {
    return { ok: false, reason: decision.kind }
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: loaded.paymentId },
      data: {
        status: 'REJECTED',
        paymentRejectedAt: now,
        paymentRejectionReason: reason,
        approvedBy: managerId,
      },
    }),
    prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    }),
  ])

  return { ok: true }
}
