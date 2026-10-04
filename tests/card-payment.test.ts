import { describe, it, expect, vi } from 'vitest'
import {
  computePaymentExpiresAt,
  isPaymentExpired,
  paymentDeadline,
} from '@/lib/appointment-cleanup'
import {
  decidePaymentReview,
  decideReceiptSubmission,
  type PaymentStateInput,
} from '@/lib/card-payment'
import {
  DEFAULT_PAYMENT_EXPIRATION_MINUTES,
  isCardPaymentConfigured,
  normalizeTelegramReceiptUrl,
  parsePaymentExpirationMinutes,
  parseSalonSettings,
} from '@/lib/salon-settings'

const BOOKED_AT = new Date('2026-10-01T12:00:00Z')

function state(overrides: Partial<PaymentStateInput> = {}): PaymentStateInput {
  return {
    appointmentStatus: 'AWAITING_PAYMENT',
    paymentStatus: 'PENDING',
    createdAt: BOOKED_AT,
    expirationMinutes: 30,
    paymentSubmittedAt: null,
    paymentExpiresAt: null,
    ...overrides,
  }
}

describe('salon payment settings', () => {
  it('reads payment fields and defaults the expiration to 30 minutes', () => {
    const settings = parseSalonSettings({
      payment: {
        bankCardNumber: '6037000000000000',
        bankAccountOwner: 'علی رضایی',
        telegramReceiptUrl: '@SalonUsername',
      },
    })

    expect(settings.payment.bankCardNumber).toBe('6037000000000000')
    expect(settings.payment.telegramReceiptUrl).toBe('https://t.me/SalonUsername')
    expect(settings.payment.paymentExpirationMinutes).toBe(DEFAULT_PAYMENT_EXPIRATION_MINUTES)
    expect(isCardPaymentConfigured(settings.payment)).toBe(true)
  })

  it('rejects non-telegram links', () => {
    expect(normalizeTelegramReceiptUrl('https://evil.example.com/t.me')).toBe('')
    expect(normalizeTelegramReceiptUrl('http://t.me/salon')).toBe('')
    expect(normalizeTelegramReceiptUrl('https://t.me/salon')).toBe('https://t.me/salon')
  })

  it('clamps the expiration setting', () => {
    expect(parsePaymentExpirationMinutes(1)).toBe(5)
    expect(parsePaymentExpirationMinutes(10_000)).toBe(1440)
    expect(parsePaymentExpirationMinutes('30')).toBe(DEFAULT_PAYMENT_EXPIRATION_MINUTES)
  })

  it('treats incomplete payment info as unconfigured', () => {
    const settings = parseSalonSettings({ payment: { bankCardNumber: '6037000000000000' } })
    expect(isCardPaymentConfigured(settings.payment)).toBe(false)
  })
})

describe('receipt submission', () => {
  it('starts the stored deadline and never confirms the booking', () => {
    const now = new Date('2026-10-01T12:05:00Z')
    const decision = decideReceiptSubmission(state(), now)

    expect(decision).toEqual({
      kind: 'SUBMIT',
      submittedAt: now,
      expiresAt: new Date('2026-10-01T12:35:00Z'),
    })
  })

  it('is idempotent once the receipt was declared sent', () => {
    const submittedAt = new Date('2026-10-01T12:05:00Z')
    const expiresAt = computePaymentExpiresAt(submittedAt, 30)
    const decision = decideReceiptSubmission(
      state({ paymentStatus: 'SUBMITTED', paymentSubmittedAt: submittedAt, paymentExpiresAt: expiresAt }),
      new Date('2026-10-01T12:10:00Z')
    )

    expect(decision).toEqual({ kind: 'ALREADY_SUBMITTED', expiresAt })
  })

  it('refuses after the pre-submit deadline passed', () => {
    const decision = decideReceiptSubmission(state(), new Date('2026-10-01T12:31:00Z'))
    expect(decision.kind).toBe('EXPIRED')
  })

  it('refuses for bookings that are not awaiting payment', () => {
    expect(decideReceiptSubmission(state({ appointmentStatus: 'CONFIRMED' })).kind).toBe(
      'NOT_AWAITING_PAYMENT'
    )
    expect(decideReceiptSubmission(state({ appointmentStatus: 'EXPIRED' })).kind).toBe('EXPIRED')
  })
})

describe('manager review', () => {
  const submittedAt = new Date('2026-10-01T12:05:00Z')
  const submitted = state({
    paymentStatus: 'SUBMITTED',
    paymentSubmittedAt: submittedAt,
    paymentExpiresAt: computePaymentExpiresAt(submittedAt, 30),
  })

  it('allows approval while the deadline holds', () => {
    expect(decidePaymentReview(submitted, new Date('2026-10-01T12:30:00Z')).kind).toBe('ALLOW')
  })

  it('blocks approval once the server clock passes the deadline', () => {
    expect(decidePaymentReview(submitted, new Date('2026-10-01T12:35:00Z')).kind).toBe('EXPIRED')
    expect(decidePaymentReview(submitted, new Date('2026-10-01T13:00:00Z')).kind).toBe('EXPIRED')
  })

  it('refuses to review a payment the customer has not submitted', () => {
    expect(decidePaymentReview(state(), new Date('2026-10-01T12:10:00Z')).kind).toBe(
      'NOT_SUBMITTED'
    )
  })

  it('does not approve twice', () => {
    expect(
      decidePaymentReview(
        { ...submitted, paymentStatus: 'APPROVED' },
        new Date('2026-10-01T12:10:00Z')
      ).kind
    ).toBe('ALREADY_APPROVED')
  })
})

describe('review authorization', () => {
  it('rejects a customer that calls the manager review endpoint directly', async () => {
    vi.doMock('@/lib/auth', () => ({
      getCurrentUser: async () => ({ id: 'customer-1', role: 'CUSTOMER', salonId: null }),
      isManager: (role: string) => role === 'MANAGER' || role === 'ADMIN',
    }))

    const { POST } = await import('@/app/api/dashboard/payments/[id]/review/route')
    const response = await POST(
      new Request('http://localhost/api/dashboard/payments/p1/review', {
        method: 'POST',
        body: JSON.stringify({ action: 'approve' }),
      }),
      { params: Promise.resolve({ id: 'p1' }) }
    )

    expect(response.status).toBe(403)
    vi.doUnmock('@/lib/auth')
    vi.resetModules()
  })
})

describe('deadline snapshot', () => {
  it('keeps the deadline stored at submission time when the salon setting changes later', () => {
    const submittedAt = new Date('2026-10-01T12:00:00Z')
    const stored = computePaymentExpiresAt(submittedAt, 30)

    // Manager later raises the setting to 60 minutes; the booking keeps its own snapshot.
    const deadline = paymentDeadline({
      createdAt: submittedAt,
      expirationMinutes: 60,
      paymentSubmittedAt: submittedAt,
      paymentExpiresAt: stored,
    })

    expect(deadline).toEqual(new Date('2026-10-01T12:30:00Z'))
    expect(isPaymentExpired({
      createdAt: submittedAt,
      expirationMinutes: 60,
      paymentSubmittedAt: submittedAt,
      paymentExpiresAt: stored,
    }, new Date('2026-10-01T12:31:00Z'))).toBe(true)
  })

  it('uses the per-booking snapshot before submission', () => {
    const deadline = paymentDeadline({
      createdAt: BOOKED_AT,
      expirationMinutes: 45,
      paymentSubmittedAt: null,
      paymentExpiresAt: null,
    })
    expect(deadline).toEqual(new Date('2026-10-01T12:45:00Z'))
  })
})
