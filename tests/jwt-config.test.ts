import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getJwtSecret } from '@/lib/jwt-config'

describe('getJwtSecret', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('throws in production when JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.JWT_SECRET
    expect(() => getJwtSecret()).toThrow('JWT_SECRET is required in production')
  })

  it('uses JWT_SECRET when set', () => {
    process.env.JWT_SECRET = 'test-secret-key'
    const secret = getJwtSecret()
    expect(new TextDecoder().decode(secret)).toBe('test-secret-key')
  })

  it('allows test fallback when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test'
    delete process.env.JWT_SECRET
    expect(getJwtSecret()).toBeInstanceOf(Uint8Array)
  })
})
