import { describe, it, expect } from 'vitest'
import {
  parseSalonSettings,
  DEFAULT_MAX_ADVANCE_BOOKING_DAYS,
  getMaxBookingDate,
} from '@/lib/salon-settings'

describe('parseSalonSettings', () => {
  it('applies defaults when settings empty', () => {
    const settings = parseSalonSettings(null)
    expect(settings.allowOnlineBooking).toBe(true)
    expect(settings.requireConfirmation).toBe(false)
    expect(settings.maxAdvanceBookingDays).toBe(DEFAULT_MAX_ADVANCE_BOOKING_DAYS)
    expect(settings.sendReminders).toBe(true)
  })

  it('reads maxAdvanceBookingDays when set', () => {
    const settings = parseSalonSettings({ maxAdvanceBookingDays: 14 })
    expect(settings.maxAdvanceBookingDays).toBe(14)
  })
})

describe('getMaxBookingDate', () => {
  it('adds maxAdvanceBookingDays from reference date', () => {
    const from = new Date('2026-08-24T10:00:00')
    const settings = parseSalonSettings({ maxAdvanceBookingDays: 7 })
    const max = getMaxBookingDate(settings, from)
    expect(max.getDate()).toBe(31)
    expect(max.getMonth()).toBe(7)
  })
})
