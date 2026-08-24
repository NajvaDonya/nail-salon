import { prisma } from '@/lib/db'

/** Hold lasts 15 minutes so OTP login has enough time */
export const SLOT_HOLD_TTL_MS = 15 * 60 * 1000

export class SlotHoldError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SlotHoldError'
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export function parseAppointmentDate(date: string): Date {
  const dateKey = date.split('T')[0]
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const aStart = timeToMinutes(startA)
  const aEnd = timeToMinutes(endA)
  const bStart = timeToMinutes(startB)
  const bEnd = timeToMinutes(endB)
  return aStart < bEnd && aEnd > bStart
}

export async function cleanupExpiredSlotHolds() {
  await prisma.slotHold.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
}

export async function releaseHoldsByToken(holdToken: string) {
  if (!holdToken) return
  await prisma.slotHold.deleteMany({ where: { holdToken } })
}

export async function getActiveHolds(params: {
  staffId: string
  date: Date
  excludeHoldToken?: string
}) {
  await cleanupExpiredSlotHolds()

  return prisma.slotHold.findMany({
    where: {
      staffId: params.staffId,
      date: params.date,
      expiresAt: { gt: new Date() },
      ...(params.excludeHoldToken
        ? { holdToken: { not: params.excludeHoldToken } }
        : {}),
    },
  })
}

export function slotBlockedByHold(
  startTime: string,
  endTime: string,
  holds: Array<{ startTime: string; endTime: string }>
): boolean {
  return holds.some((hold) => timesOverlap(startTime, endTime, hold.startTime, hold.endTime))
}

export async function createOrRefreshSlotHold(params: {
  salonId: string
  staffId: string
  date: string
  startTime: string
  durationMinutes: number
  holdToken: string
}) {
  const { salonId, staffId, date, startTime, durationMinutes, holdToken } = params

  if (!holdToken) {
    throw new SlotHoldError('شناسه رزرو موقت نامعتبر است')
  }

  await cleanupExpiredSlotHolds()
  await releaseHoldsByToken(holdToken)

  const appointmentDate = parseAppointmentDate(date)
  const endTime = minutesToTime(timeToMinutes(startTime) + durationMinutes)

  const otherHolds = await getActiveHolds({ staffId, date: appointmentDate, excludeHoldToken: holdToken })
  if (slotBlockedByHold(startTime, endTime, otherHolds)) {
    throw new SlotHoldError('این زمان توسط شخص دیگری انتخاب شده است')
  }

  try {
    await prisma.slotHold.create({
      data: {
        salonId,
        staffId,
        date: appointmentDate,
        startTime,
        endTime,
        holdToken,
        expiresAt: new Date(Date.now() + SLOT_HOLD_TTL_MS),
      },
    })
  } catch {
    throw new SlotHoldError('این زمان توسط شخص دیگری انتخاب شده است')
  }
}

export async function assertSlotHold(params: {
  staffId: string
  date: string
  startTime: string
  durationMinutes: number
  holdToken?: string
}) {
  const appointmentDate = parseAppointmentDate(params.date)
  const endTime = minutesToTime(
    timeToMinutes(params.startTime) + params.durationMinutes
  )

  const otherHolds = await getActiveHolds({
    staffId: params.staffId,
    date: appointmentDate,
    excludeHoldToken: params.holdToken,
  })

  if (slotBlockedByHold(params.startTime, endTime, otherHolds)) {
    throw new SlotHoldError('این زمان دیگر در دسترس نیست')
  }
}

/**
 * Require an active hold owned by holdToken for the exact slot.
 * Used at checkout so payment cannot proceed without a valid reservation.
 */
export async function verifySlotHold(params: {
  staffId: string
  date: string
  startTime: string
  durationMinutes: number
  holdToken: string
}) {
  if (!params.holdToken) {
    throw new SlotHoldError('رزرو موقت زمان منقضی شده است — لطفاً دوباره زمان را انتخاب کنید')
  }

  await cleanupExpiredSlotHolds()

  const appointmentDate = parseAppointmentDate(params.date)
  const endTime = minutesToTime(
    timeToMinutes(params.startTime) + params.durationMinutes
  )

  const hold = await prisma.slotHold.findFirst({
    where: {
      holdToken: params.holdToken,
      staffId: params.staffId,
      date: appointmentDate,
      startTime: params.startTime,
      endTime,
      expiresAt: { gt: new Date() },
    },
  })

  if (!hold) {
    throw new SlotHoldError('رزرو موقت زمان منقضی شده است — لطفاً دوباره زمان را انتخاب کنید')
  }

  const otherHolds = await getActiveHolds({
    staffId: params.staffId,
    date: appointmentDate,
    excludeHoldToken: params.holdToken,
  })

  if (slotBlockedByHold(params.startTime, endTime, otherHolds)) {
    throw new SlotHoldError('این زمان دیگر در دسترس نیست')
  }

  return hold
}
