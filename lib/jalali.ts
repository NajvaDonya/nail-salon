// Jalali (Persian) calendar utilities
import { format, parse, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isSameMonth, subMonths, addMonths } from 'date-fns-jalali'
import { faIR } from 'date-fns-jalali/locale'

// Format date to Persian
export function formatPersianDate(date: Date | string, formatStr: string = 'yyyy/MM/dd'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, formatStr, { locale: faIR })
}

// Format time to Persian (just returns HH:mm in Persian numerals)
export function formatPersianTime(time: string): string {
  const persianNumerals = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return time.replace(/[0-9]/g, (d) => persianNumerals[parseInt(d)])
}

// Get Persian day name
export function getPersianDayName(date: Date): string {
  return format(date, 'EEEE', { locale: faIR })
}

// Get Persian month name
export function getPersianMonthName(date: Date): string {
  return format(date, 'MMMM', { locale: faIR })
}

// Get days of current week (Saturday to Friday for Persian calendar)
export function getPersianWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { locale: faIR })
  const end = endOfWeek(date, { locale: faIR })
  return eachDayOfInterval({ start, end })
}

// Get days of current month
export function getPersianMonthDays(date: Date): Date[] {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  return eachDayOfInterval({ start, end })
}

// Format relative date
export function formatRelativeDate(date: Date): string {
  if (isToday(date)) return 'امروز'
  
  const tomorrow = addDays(new Date(), 1)
  if (isSameDay(date, tomorrow)) return 'فردا'
  
  const dayAfterTomorrow = addDays(new Date(), 2)
  if (isSameDay(date, dayAfterTomorrow)) return 'پس‌فردا'
  
  return formatPersianDate(date, 'EEEE d MMMM')
}

// Convert Persian number string to English
export function persianToEnglish(str: string): string {
  const persianNumerals = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return str.replace(/[۰-۹]/g, (d) => persianNumerals.indexOf(d).toString())
}

// Convert English number string to Persian
export function englishToPersian(str: string): string {
  const persianNumerals = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return str.replace(/[0-9]/g, (d) => persianNumerals[parseInt(d)])
}

// Format price in Persian
export function formatPersianPrice(price: number): string {
  const formatted = new Intl.NumberFormat('fa-IR').format(price)
  return `${formatted} تومان`
}

// Format duration in Persian
export function formatPersianDuration(minutes: number): string {
  if (minutes < 60) {
    return `${englishToPersian(minutes.toString())} دقیقه`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) {
    return `${englishToPersian(hours.toString())} ساعت`
  }
  return `${englishToPersian(hours.toString())} ساعت و ${englishToPersian(mins.toString())} دقیقه`
}

export function formatServiceWithDuration(name: string, durationMinutes: number): string {
  return `${name} (${formatPersianDuration(durationMinutes)})`
}

// Aliases used by booking components
export const formatJalaliDate = formatPersianDate
export const formatJalaliTime = formatPersianTime
export const convertPersianToEnglishDigits = persianToEnglish

export function getJalaliWeekDays(): string[] {
  return ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه']
}

export const PERSIAN_CALENDAR_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه']

export function getPersianCalendarGrid(viewDate: Date): Date[] {
  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(viewDate)
  const gridStart = startOfWeek(monthStart, { locale: faIR })
  const gridEnd = endOfWeek(monthEnd, { locale: faIR })
  return eachDayOfInterval({ start: gridStart, end: gridEnd })
}

export function getPreviousMonth(date: Date): Date {
  return subMonths(date, 1)
}

export function getNextMonth(date: Date): Date {
  return addMonths(date, 1)
}

export function isSamePersianMonth(a: Date, b: Date): boolean {
  return isSameMonth(a, b)
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
