import type { DayOfWeek } from '@/lib/types'
import { PERSIAN_DAYS } from '@/lib/types'

export const WEEK_DAYS: DayOfWeek[] = [
  'SATURDAY',
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
]

export { PERSIAN_DAYS }

export interface SalonHourRow {
  dayOfWeek: DayOfWeek
  openTime: string
  closeTime: string
  isClosed: boolean
}

export interface StaffHourRow {
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  isOff: boolean
}

export const DEFAULT_SALON_HOURS: SalonHourRow[] = WEEK_DAYS.map((dayOfWeek) => ({
  dayOfWeek,
  openTime: dayOfWeek === 'FRIDAY' ? '00:00' : '09:00',
  closeTime: dayOfWeek === 'FRIDAY' ? '00:00' : dayOfWeek === 'THURSDAY' ? '18:00' : '21:00',
  isClosed: dayOfWeek === 'FRIDAY',
}))

export function buildSalonHoursFromDb(
  rows: Array<{
    dayOfWeek: string
    openTime: string
    closeTime: string
    isClosed: boolean
  }>
): SalonHourRow[] {
  const byDay = new Map(rows.map((row) => [row.dayOfWeek, row]))
  return WEEK_DAYS.map((dayOfWeek) => {
    const row = byDay.get(dayOfWeek)
    if (!row) {
      return DEFAULT_SALON_HOURS.find((item) => item.dayOfWeek === dayOfWeek)!
    }
    return {
      dayOfWeek,
      openTime: row.openTime,
      closeTime: row.closeTime,
      isClosed: row.isClosed,
    }
  })
}

export function buildStaffHoursFromDb(
  salonHours: SalonHourRow[],
  rows: Array<{
    dayOfWeek: string
    startTime: string
    endTime: string
    isOff: boolean
  }>
): StaffHourRow[] {
  const byDay = new Map(rows.map((row) => [row.dayOfWeek, row]))
  return WEEK_DAYS.map((dayOfWeek) => {
    const row = byDay.get(dayOfWeek)
    const salon = salonHours.find((item) => item.dayOfWeek === dayOfWeek)!
    if (!row) {
      return {
        dayOfWeek,
        startTime: salon.openTime,
        endTime: salon.closeTime,
        isOff: salon.isClosed,
      }
    }
    return {
      dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      isOff: row.isOff,
    }
  })
}
