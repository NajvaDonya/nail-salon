/**
 * Concurrency strategy (MySQL):
 * Callers run inside prisma.$transaction and lock the staff row with
 * SELECT ... FOR UPDATE before findConflictingAppointment.
 * This serializes concurrent bookings for the same staff member without
 * a naive (staffId, startTime) unique index that would reject valid back-to-back slots.
 */
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

type DbClient = Prisma.TransactionClient | typeof prisma

const BLOCKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'AWAITING_PAYMENT'] as const

function timeFromDateTime(value: Date): string {
  const hours = value.getHours().toString().padStart(2, '0')
  const minutes = value.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function timesOverlapMinutes(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB
}

export async function lockStaffForBooking(staffId: string, client: DbClient): Promise<void> {
  await client.$executeRaw`SELECT id FROM Staff WHERE id = ${staffId} FOR UPDATE`
}

export async function findConflictingAppointment(
  params: {
    staffId: string
    startDateTime: Date
    endDateTime: Date
    restMinutes?: number
    excludeAppointmentId?: string
  },
  client: DbClient = prisma
) {
  const { staffId, startDateTime, endDateTime, restMinutes = 0, excludeAppointmentId } = params

  const appointments = await client.appointment.findMany({
    where: {
      staffId,
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      status: { in: [...BLOCKING_STATUSES] },
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      services: {
        select: {
          bufferTime: true,
        },
      },
    },
  })

  const requestStart = timeToMinutes(timeFromDateTime(startDateTime))
  const requestEnd = timeToMinutes(timeFromDateTime(endDateTime))

  for (const apt of appointments) {
    const aptStart = timeToMinutes(timeFromDateTime(apt.startTime))
    const aptEnd = timeToMinutes(timeFromDateTime(apt.endTime))
    const aptBuffer = apt.services.reduce((sum, line) => sum + (line.bufferTime ?? 0), 0)
    const blockedEnd = aptEnd + restMinutes + aptBuffer

    if (timesOverlapMinutes(requestStart, requestEnd, aptStart, blockedEnd)) {
      return apt
    }
  }

  return null
}
