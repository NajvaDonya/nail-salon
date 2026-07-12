// Smart Booking Engine - Slot calculation with conflict detection

import { prisma } from './db'
import type { DayOfWeek, TimeSlot, AvailableSlot } from './types'

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

// Parse time string to minutes from midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Convert minutes to time string
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
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

// Check if a time slot conflicts with existing appointments
async function hasConflict(
  staffId: string,
  date: Date,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)

  const appointments = await prisma.appointment.findMany({
    where: {
      staffId,
      date,
      status: {
        in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'],
      },
    },
    select: {
      startTime: true,
      endTime: true,
    },
  })

  for (const apt of appointments) {
    const aptStart = timeToMinutes(timeFromDateTime(apt.startTime))
    const aptEnd = timeToMinutes(timeFromDateTime(apt.endTime))

    // Check for overlap
    if (startMinutes < aptEnd && endMinutes > aptStart) {
      return true
    }
  }

  return false
}

// Get available slots for a specific staff member on a date
async function getStaffSlots(
  staffId: string,
  salonId: string,
  date: Date,
  serviceDuration: number,
  bufferTime: number
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
  const openTime = staffHours?.startTime || salonHours.openTime
  const closeTime = staffHours?.endTime || salonHours.closeTime

  const openMinutes = timeToMinutes(openTime)
  const closeMinutes = timeToMinutes(closeTime)
  const slotDuration = serviceDuration + bufferTime

  const slots: TimeSlot[] = []

  // Generate 30-minute interval slots
  for (let time = openMinutes; time + serviceDuration <= closeMinutes; time += 30) {
    const startTime = minutesToTime(time)
    const endTime = minutesToTime(time + serviceDuration)

    const conflict = await hasConflict(staffId, date, startTime, endTime)

    slots.push({
      time: startTime,
      available: !conflict,
      staffId,
    })
  }

  return slots
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
      const staffSlots = await getStaffSlots(
        sid,
        salonId,
        checkDate,
        service.duration,
        service.bufferTime
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
  const hasConflictNow = await hasConflict(staffId, date, startTime, endTime)
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
