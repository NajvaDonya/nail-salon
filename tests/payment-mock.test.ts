import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isPaymentMockMode } from '@/lib/payment'

describe('isPaymentMockMode', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('is false in production even when ENABLE_MOCK_PAYMENTS=true', () => {
    process.env.NODE_ENV = 'production'
    process.env.ENABLE_MOCK_PAYMENTS = 'true'
    expect(isPaymentMockMode()).toBe(false)
  })

  it('is true in development only when ENABLE_MOCK_PAYMENTS=true', () => {
    process.env.NODE_ENV = 'development'
    process.env.ENABLE_MOCK_PAYMENTS = 'true'
    expect(isPaymentMockMode()).toBe(true)
  })

  it('is false in development when flag unset', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.ENABLE_MOCK_PAYMENTS
    expect(isPaymentMockMode()).toBe(false)
  })
})
