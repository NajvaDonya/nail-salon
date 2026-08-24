export interface ParsedSalonSettings {
  allowOnlineBooking: boolean
  requireConfirmation: boolean
  maxAdvanceBookingDays: number
  sendReminders: boolean
  reminderHours: number
}

export const DEFAULT_MAX_ADVANCE_BOOKING_DAYS = 30
export const DEFAULT_REMINDER_HOURS = 24

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
