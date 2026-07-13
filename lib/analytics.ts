import type { DayOfWeek } from '@/lib/types'
import { timeToMinutes } from '@/lib/time-utils'
import type { SalonHourRow, StaffHourRow } from '@/lib/schedule'
import { WEEK_DAYS } from '@/lib/schedule'

const JS_DAY_TO_ENUM: DayOfWeek[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

export function getDayOfWeek(date: Date): DayOfWeek {
  return JS_DAY_TO_ENUM[date.getDay()]
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function eachDateInRange(from: Date, to: Date): Date[] {
  const dates: Date[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  while (cursor <= end) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export function workingMinutesForDay(hours: {
  isOff?: boolean
  isClosed?: boolean
  startTime: string
  endTime: string
}): number {
  if (hours.isOff || hours.isClosed) return 0
  const start = timeToMinutes(hours.startTime)
  const end = timeToMinutes(hours.endTime)
  return Math.max(0, end - start)
}

export function appointmentMinutes(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

export function utilizationPercent(booked: number, available: number): number {
  if (available <= 0) return 0
  return Math.round((booked / available) * 1000) / 10
}

export function salonHoursSummary(salonHours: SalonHourRow[]) {
  return WEEK_DAYS.map((dayOfWeek) => {
    const row = salonHours.find((item) => item.dayOfWeek === dayOfWeek)
    const isClosed = row?.isClosed ?? dayOfWeek === 'FRIDAY'
    const openTime = row?.openTime ?? '09:00'
    const closeTime = row?.closeTime ?? '18:00'
    const dailyMinutes = workingMinutesForDay({
      isClosed,
      startTime: openTime,
      endTime: closeTime,
    })
    return {
      dayOfWeek,
      openTime,
      closeTime,
      isClosed,
      dailyMinutes,
    }
  })
}

export function staffHoursSummary(staffHours: StaffHourRow[]) {
  return WEEK_DAYS.map((dayOfWeek) => {
    const row = staffHours.find((item) => item.dayOfWeek === dayOfWeek)
    const isOff = row?.isOff ?? false
    const startTime = row?.startTime ?? '09:00'
    const endTime = row?.endTime ?? '18:00'
    const dailyMinutes = workingMinutesForDay({
      isOff,
      startTime,
      endTime,
    })
    return {
      dayOfWeek,
      startTime,
      endTime,
      isOff,
      dailyMinutes,
    }
  })
}

export function availableMinutesInRange(
  dates: Date[],
  hoursByDay: Map<DayOfWeek, number>
): number {
  return dates.reduce((sum, date) => sum + (hoursByDay.get(getDayOfWeek(date)) ?? 0), 0)
}

export function buildHoursByDayFromSummary(
  summary: Array<{ dayOfWeek: DayOfWeek; dailyMinutes: number }>
): Map<DayOfWeek, number> {
  return new Map(summary.map((row) => [row.dayOfWeek, row.dailyMinutes]))
}
