export const MAX_OTP_ATTEMPTS = 5

export function isOtpLocked(attempts: number): boolean {
  return attempts >= MAX_OTP_ATTEMPTS
}

export function shouldIncrementOtpAttempts(currentAttempts: number): number {
  return currentAttempts + 1
}
