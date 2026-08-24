const FALLBACK_DEV_SECRET = 'dev-only-jwt-secret-not-for-production'

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET?.trim()

  if (secret) {
    return new TextEncoder().encode(secret)
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production')
  }

  if (process.env.NODE_ENV === 'test') {
    return new TextEncoder().encode(FALLBACK_DEV_SECRET)
  }

  console.warn('[auth] JWT_SECRET is not set — using insecure dev fallback')
  return new TextEncoder().encode(FALLBACK_DEV_SECRET)
}
