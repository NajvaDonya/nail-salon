// Smart Booking Engine - Slot calculation with conflict detection

import { prisma } from './db'
import type { DayOfWeek, TimeSlot, AvailableSlot } from './types'
import { cleanupExpiredAwaitingPayments } from './appointment-cleanup'
import { getActiveHolds, slotBlockedByHold } from './slot-hold'
import { getStaffBreakSettings, type LunchWindow } from './staff-breaks'
import { timeToMinutes, minutesToTime, calculateEndTime } from './time-utils'

export { timeToMinutes, minutesToTime, calculateEndTime }

interface SlotQuery {
  salonId: string
  serviceId: string
  staffId?: string // Optional - if not provided, find any available staff
  date: Date
  days?: number // How many days to check (default 7)
}

// Convert Date to DayOfWeek enum
function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = [
    'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'
  ]
  return days[date.getDay()]
}

// Parse time string to minutes from midnight — see lib/time-utils.ts
function timesOverlapMinutes(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB
}

export function timesToSlotRanges(
  times: string[],
  durationMinutes: number
): Array<{ start: string; end: string; available: boolean }> {
  return times.map((start) => ({
    start,
    end: minutesToTime(timeToMinutes(start) + durationMinutes),
    available: true,
  }))
}

function dateTimeFromParts(date: Date, time: string): Date {
  const [year, month, day] = date.toISOString().split('T')[0].split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0)
}

function timeFromDateTime(value: Date): string {
  const hours = value.getHours().toString().padStart(2, '0')
  const minutes = value.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

function formatTimeValue(value: string | Date): string {
  if (value instanceof Date) {
    return timeFromDateTime(value)
  }
  return value.slice(0, 5)
}

// Check if a time slot conflicts with existing appointments
async function hasConflict(
  staffId: string,
  date: Date,
  startTime: string,
  endTime: string,
  restMinutes: number,
  excludeAppointmentId?: string
): Promise<boolean> {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)

  const appointments = await prisma.appointment.findMany({
    where: {
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      staffId,
      date,
      status: {
        in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'AWAITING_PAYMENT'],
      },
    },
    select: {
      startTime: true,
      endTime: true,
      services: { select: { bufferTime: true } },
    },
  })

  for (const apt of appointments) {
    const aptStart = timeToMinutes(timeFromDateTime(apt.startTime))
    const aptEnd = timeToMinutes(timeFromDateTime(apt.endTime))
    const aptBuffer = apt.services.reduce((sum, line) => sum + (line.bufferTime ?? 0), 0)
    const blockedEnd = aptEnd + restMinutes + aptBuffer

    if (timesOverlapMinutes(startMinutes, endMinutes, aptStart, blockedEnd)) {
      return true
    }
  }

  return false
}

function overlapsLunch(
  startTime: string,
  endTime: string,
  lunch: LunchWindow | null
): boolean {
  if (!lunch) return false
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  const lunchStart = timeToMinutes(lunch.start)
  const lunchEnd = timeToMinutes(lunch.end)
  return timesOverlapMinutes(start, end, lunchStart, lunchEnd)
}

// Get available slots for a specific staff member on a date
async function getStaffSlots(
  staffId: string,
  salonId: string,
  date: Date,
  serviceDuration: number,
  restMinutes: number,
  lunch: LunchWindow | null,
  excludeAppointmentId?: string,
  excludeHoldToken?: string,
  options?: { forLunch?: boolean; lunchDuration?: number }
): Promise<TimeSlot[]> {
  const dayOfWeek = getDayOfWeek(date)
  const dateStr = date.toISOString().split('T')[0]

  // Check salon vacation
  const salonVacation = await prisma.vacation.findFirst({
    where: {
      salonId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
  })
  if (salonVacation) return []

  // Check staff vacation
  const staffVacation = await prisma.staffVacation.findFirst({
    where: {
      staffId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
  })
  if (staffVacation) return []

  // Get salon working hours
  const salonHours = await prisma.workingHour.findUnique({
    where: {
      salonId_dayOfWeek: { salonId, dayOfWeek },
    },
  })
  if (!salonHours || salonHours.isClosed) return []

  // Get staff working hours
  const staffHours = await prisma.staffWorkingHour.findUnique({
    where: {
      staffId_dayOfWeek: { staffId, dayOfWeek },
    },
  })
  if (staffHours?.isOff) return []

  // Determine effective working hours
  const openTime = formatTimeValue(staffHours?.startTime || salonHours.openTime)
  const closeTime = formatTimeValue(staffHours?.endTime || salonHours.closeTime)

  const openMinutes = timeToMinutes(openTime)
  const closeMinutes = timeToMinutes(closeTime)

  const activeHolds = await getActiveHolds({
    staffId,
    date,
    excludeHoldToken,
  })

  const appointments = await prisma.appointment.findMany({
    where: {
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      staffId,
      date,
      status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'AWAITING_PAYMENT'] },
    },
    select: { startTime: true, endTime: true, services: { select: { bufferTime: true } } },
  })

  const slots: TimeSlot[] = []
  const duration = options?.forLunch ? (options.lunchDuration ?? serviceDuration) : serviceDuration
  const candidateStarts = new Set<number>()

  let walk = openMinutes
  while (walk + duration <= closeMinutes) {
    candidateStarts.add(walk)
    walk += duration + restMinutes
  }

  for (const apt of appointments) {
    const afterRest = timeToMinutes(timeFromDateTime(apt.endTime)) + restMinutes
    if (afterRest + duration <= closeMinutes) {
      candidateStarts.add(afterRest)
    }
  }

  const sortedStarts = Array.from(candidateStarts).sort((a, b) => a - b)

  for (const time of sortedStarts) {
    const startTime = minutesToTime(time)
    const endTime = minutesToTime(time + duration)

    const lunchConflict =
      !options?.forLunch && overlapsLunch(startTime, endTime, lunch)

    const conflict = await hasConflict(
      staffId,
      date,
      startTime,
      endTime,
      restMinutes,
      excludeAppointmentId
    )
    const held = slotBlockedByHold(startTime, endTime, activeHolds)

    slots.push({
      time: startTime,
      available: !conflict && !held && !lunchConflict,
      staffId,
    })
  }

  return slots
}

export async function getStaffAvailableTimes(params: {
  staffId: string
  salonId: string
  date: string
  durationMinutes: number
  excludeAppointmentId?: string
  excludeHoldToken?: string
  availableOnly?: boolean
  kind?: 'SERVICE' | 'LUNCH'
}): Promise<string[]> {
  const {
    staffId,
    salonId,
    durationMinutes,
    excludeAppointmentId,
    excludeHoldToken,
    availableOnly = true,
    kind = 'SERVICE',
  } = params

  await cleanupExpiredAwaitingPayments()

  const dateKey = params.date.split('T')[0]
  const [year, month, day] = dateKey.split('-').map(Number)
  const appointmentDate = new Date(year, month - 1, day)

  const breakSettings = await getStaffBreakSettings(staffId, salonId)
  const forLunch = kind === 'LUNCH'
  const lunchDuration =
    forLunch && breakSettings.lunch ? timeToMinutes(breakSettings.lunch.end) - timeToMinutes(breakSettings.lunch.start) : durationMinutes

  const slots = await getStaffSlots(
    staffId,
    salonId,
    appointmentDate,
    forLunch ? lunchDuration : durationMinutes,
    breakSettings.restMinutes,
    breakSettings.lunch,
    excludeAppointmentId,
    excludeHoldToken,
    forLunch
      ? { forLunch: true, lunchDuration }
      : undefined
  )

  const filtered = availableOnly ? slots.filter((slot) => slot.available) : slots
  let times = filtered.map((slot) => slot.time)

  const todayKey = new Date().toISOString().split('T')[0]
  if (dateKey === todayKey) {
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    times = times.filter((time) => timeToMinutes(time) > currentMinutes)
  }

  return times
}

// Main function: Get available slots for a service
export async function getAvailableSlots(query: SlotQuery): Promise<AvailableSlot[]> {
  const { salonId, serviceId, staffId, date, days = 7 } = query

  // Get service details
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      duration: true,
      bufferTime: true,
    },
  })

  if (!service) {
    throw new Error('Service not found')
  }

  // Get staff members who can perform this service
  let staffIds: string[] = []

  if (staffId) {
    staffIds = [staffId]
  } else {
    const staffServices = await prisma.staffService.findMany({
      where: {
        serviceId,
        staff: {
          salonId,
          isActive: true,
          user: {
            role: { in: ['STAFF', 'MANAGER'] },
          },
        },
      },
      select: {
        staffId: true,
      },
    })
    staffIds = staffServices.map((s) => s.staffId)
  }

  if (staffIds.length === 0) {
    return []
  }

  const result: AvailableSlot[] = []
  const currentDate = new Date(date)

  for (let i = 0; i < days; i++) {
    const checkDate = new Date(currentDate)
    checkDate.setDate(currentDate.getDate() + i)
    
    // Reset time to start of day for consistent comparison
    checkDate.setHours(0, 0, 0, 0)

    const allSlots: TimeSlot[] = []

    // Get slots from all staff members
    for (const sid of staffIds) {
      const breakSettings = await getStaffBreakSettings(sid, salonId)
      const staffSlots = await getStaffSlots(
        sid,
        salonId,
        checkDate,
        service.duration,
        breakSettings.restMinutes,
        breakSettings.lunch,
      )
      allSlots.push(...staffSlots)
    }

    // Merge slots - a time is available if ANY staff can do it
    const mergedSlots = new Map<string, TimeSlot>()

    for (const slot of allSlots) {
      const existing = mergedSlots.get(slot.time)
      if (!existing) {
        mergedSlots.set(slot.time, slot)
      } else if (slot.available && !existing.available) {
        mergedSlots.set(slot.time, slot)
      }
    }

    // Sort slots by time
    const sortedSlots = Array.from(mergedSlots.values()).sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
    )

    result.push({
      date: checkDate.toISOString().split('T')[0],
      slots: sortedSlots,
    })
  }

  return result
}

// Book an appointment
export async function bookAppointment(params: {
  salonId: string
  customerId: string
  staffId: string
  serviceId: string
  date: Date
  startTime: string
  notes?: string
}) {
  const { salonId, customerId, staffId, serviceId, date, startTime, notes } = params

  // Get service details
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      duration: true,
      price: true,
      discountPrice: true,
      name: true,
    },
  })

  if (!service) {
    throw new Error('Service not found')
  }

  const endTime = minutesToTime(timeToMinutes(startTime) + service.duration)
  const startDateTime = dateTimeFromParts(date, startTime)
  const endDateTime = dateTimeFromParts(date, endTime)
  const trackingCode = `SL${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`

  // Check for conflicts one more time
  const hasConflictNow = await hasConflict(staffId, date, startTime, endTime, 0)
  if (hasConflictNow) {
    throw new Error('این زمان دیگر در دسترس نیست')
  }

  // Create appointment
  const appointment = await prisma.appointment.create({
    data: {
      salonId,
      customerId,
      staffId,
      date,
      startTime: startDateTime,
      endTime: endDateTime,
      totalPrice: service.discountPrice || service.price,
      trackingCode,
      notes,
      status: 'PENDING',
      services: {
        create: [{ serviceId }],
      },
    },
    include: {
      services: {
        include: {
          service: true,
        },
      },
      staff: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      },
      customer: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      salon: {
        select: {
          name: true,
        },
      },
    },
  })

  return appointment
}
