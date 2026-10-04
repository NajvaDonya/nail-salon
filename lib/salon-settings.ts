export interface SalonPaymentInfo {
  bankCardNumber: string
  bankAccountOwner: string
  paymentPhone: string
  telegramReceiptUrl: string
  paymentExpirationMinutes: number
}

export interface ParsedSalonSettings {
  allowOnlineBooking: boolean
  requireConfirmation: boolean
  maxAdvanceBookingDays: number
  sendReminders: boolean
  reminderHours: number
  payment: SalonPaymentInfo
}

export const DEFAULT_MAX_ADVANCE_BOOKING_DAYS = 30
export const DEFAULT_REMINDER_HOURS = 24
export const DEFAULT_PAYMENT_EXPIRATION_MINUTES = 30
export const MIN_PAYMENT_EXPIRATION_MINUTES = 5
export const MAX_PAYMENT_EXPIRATION_MINUTES = 1440

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Accept a full t.me link or a bare @username and store a canonical https link. */
export function normalizeTelegramReceiptUrl(raw: unknown): string {
  const value = readString(raw)
  if (!value) return ''

  const username = value.startsWith('@') ? value.slice(1) : value
  if (/^[A-Za-z0-9_]{3,64}$/.test(username)) {
    return `https://t.me/${username}`
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return ''
  }

  if (parsed.protocol !== 'https:') return ''
  const host = parsed.hostname.toLowerCase()
  if (host !== 't.me' && host !== 'telegram.me' && host !== 'telegram.dog') return ''

  return parsed.toString()
}

export function parsePaymentExpirationMinutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PAYMENT_EXPIRATION_MINUTES
  }
  const minutes = Math.floor(value)
  if (minutes < MIN_PAYMENT_EXPIRATION_MINUTES) return MIN_PAYMENT_EXPIRATION_MINUTES
  if (minutes > MAX_PAYMENT_EXPIRATION_MINUTES) return MAX_PAYMENT_EXPIRATION_MINUTES
  return minutes
}

function parseSalonPaymentInfo(value: Record<string, unknown>): SalonPaymentInfo {
  const raw =
    value.payment && typeof value.payment === 'object' && !Array.isArray(value.payment)
      ? (value.payment as Record<string, unknown>)
      : {}

  return {
    bankCardNumber: readString(raw.bankCardNumber),
    bankAccountOwner: readString(raw.bankAccountOwner),
    paymentPhone: readString(raw.paymentPhone),
    telegramReceiptUrl: normalizeTelegramReceiptUrl(raw.telegramReceiptUrl),
    paymentExpirationMinutes: parsePaymentExpirationMinutes(raw.paymentExpirationMinutes),
  }
}

export function isCardPaymentConfigured(payment: SalonPaymentInfo): boolean {
  return Boolean(payment.bankCardNumber && payment.bankAccountOwner && payment.telegramReceiptUrl)
}

export function parseSalonSettings(raw: unknown): ParsedSalonSettings {
  const value =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  const maxAdvance =
    typeof value.maxAdvanceBookingDays === 'number' && value.maxAdvanceBookingDays >= 0
      ? Math.floor(value.maxAdvanceBookingDays)
      : DEFAULT_MAX_ADVANCE_BOOKING_DAYS

  const reminderHours =
    typeof value.reminderHours === 'number' && value.reminderHours > 0
      ? Math.floor(value.reminderHours)
      : DEFAULT_REMINDER_HOURS

  return {
    allowOnlineBooking:
      typeof value.allowOnlineBooking === 'boolean' ? value.allowOnlineBooking : true,
    requireConfirmation:
      typeof value.requireConfirmation === 'boolean' ? value.requireConfirmation : false,
    maxAdvanceBookingDays: maxAdvance,
    sendReminders: typeof value.sendReminders === 'boolean' ? value.sendReminders : true,
    reminderHours,
    payment: parseSalonPaymentInfo(value),
  }
}

export class PaymentInfoMissingError extends Error {
  constructor() {
    super('اطلاعات پرداخت سالن کامل نیست — با مدیر سالن تماس بگیرید')
    this.name = 'PaymentInfoMissingError'
  }
}

export function assertCardPaymentConfigured(settings: ParsedSalonSettings): void {
  if (!isCardPaymentConfigured(settings.payment)) {
    throw new PaymentInfoMissingError()
  }
}

export function assertOnlineBookingAllowed(settings: ParsedSalonSettings): void {
  if (!settings.allowOnlineBooking) {
    throw new OnlineBookingDisabledError()
  }
}

export class OnlineBookingDisabledError extends Error {
  constructor() {
    super('رزرو آنلاین برای این سالن غیرفعال است')
    this.name = 'OnlineBookingDisabledError'
  }
}

export function shouldRequireConfirmation(settings: ParsedSalonSettings): boolean {
  return settings.requireConfirmation
}

export function getMaxBookingDate(settings: ParsedSalonSettings, from: Date = new Date()): Date {
  const max = new Date(from)
  max.setHours(23, 59, 59, 999)
  max.setDate(max.getDate() + settings.maxAdvanceBookingDays)
  return max
}

export function assertBookingDateWithinLimit(
  dateKey: string,
  settings: ParsedSalonSettings,
  from: Date = new Date()
): void {
  const [year, month, day] = dateKey.split('T')[0].split('-').map(Number)
  const bookingDate = new Date(year, month - 1, day)
  bookingDate.setHours(0, 0, 0, 0)

  const today = new Date(from)
  today.setHours(0, 0, 0, 0)

  if (bookingDate < today) {
    throw new BookingDateOutOfRangeError('تاریخ انتخاب‌شده در گذشته است')
  }

  const maxDate = getMaxBookingDate(settings, from)
  maxDate.setHours(0, 0, 0, 0)

  if (bookingDate > maxDate) {
    throw new BookingDateOutOfRangeError(
      `حداکثر ${settings.maxAdvanceBookingDays} روز جلوتر می‌توانید رزرو کنید`
    )
  }
}

export class BookingDateOutOfRangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BookingDateOutOfRangeError'
  }
}
