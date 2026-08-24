import { describe, it, expect } from 'vitest'
import { isOtpLocked, MAX_OTP_ATTEMPTS, shouldIncrementOtpAttempts } from '@/lib/otp-security'

describe('otp-security', () => {
  it('locks after MAX_OTP_ATTEMPTS failures', () => {
    expect(isOtpLocked(MAX_OTP_ATTEMPTS - 1)).toBe(false)
    expect(isOtpLocked(MAX_OTP_ATTEMPTS)).toBe(true)
  })

  it('increments attempt counter', () => {
    expect(shouldIncrementOtpAttempts(2)).toBe(3)
  })
})
