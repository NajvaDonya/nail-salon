import './load-env'
import { vi } from 'vitest'
import { AUTH_COOKIE_NAME } from '@/lib/auth-cookie'

/**
 * Route handlers read the session through `cookies()` from next/headers, which only exists
 * inside a request. We mock that single transport detail and nothing else: the token below
 * is a real signed JWT, `getCurrentUser()` still verifies it and still loads the user from
 * the database, and every role check runs untouched.
 */
const cookieJar = new Map<string, string>()

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name)
      return value === undefined ? undefined : { name, value }
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value)
    },
    delete: (name: string) => {
      cookieJar.delete(name)
    },
    has: (name: string) => cookieJar.has(name),
  }),
  headers: async () => new Headers(),
}))

export interface SessionUser {
  id: string
  phone: string
  role: string
  salonId?: string | null
}

async function signSession(user: SessionUser): Promise<string> {
  const { createToken } = await import('@/lib/auth')
  return createToken({
    userId: user.id,
    phone: user.phone,
    role: user.role as never,
    salonId: user.salonId ?? undefined,
  })
}

/** Signs in as `user` for the duration of `fn`, then restores the previous session. */
export async function asUser<T>(user: SessionUser, fn: () => Promise<T>): Promise<T> {
  const previous = cookieJar.get(AUTH_COOKIE_NAME)
  cookieJar.set(AUTH_COOKIE_NAME, await signSession(user))
  try {
    return await fn()
  } finally {
    if (previous === undefined) cookieJar.delete(AUTH_COOKIE_NAME)
    else cookieJar.set(AUTH_COOKIE_NAME, previous)
  }
}

/** Runs `fn` with no session cookie at all. */
export async function asGuest<T>(fn: () => Promise<T>): Promise<T> {
  const previous = cookieJar.get(AUTH_COOKIE_NAME)
  cookieJar.delete(AUTH_COOKIE_NAME)
  try {
    return await fn()
  } finally {
    if (previous !== undefined) cookieJar.set(AUTH_COOKIE_NAME, previous)
  }
}

/** Installs a syntactically valid but unverifiable token, i.e. a forged cookie. */
export async function asForgedToken<T>(fn: () => Promise<T>): Promise<T> {
  const previous = cookieJar.get(AUTH_COOKIE_NAME)
  cookieJar.set(
    AUTH_COOKIE_NAME,
    'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJmb3JnZWQiLCJyb2xlIjoiTUFOQUdFUiJ9.not-a-valid-signature'
  )
  try {
    return await fn()
  } finally {
    if (previous === undefined) cookieJar.delete(AUTH_COOKIE_NAME)
    else cookieJar.set(AUTH_COOKIE_NAME, previous)
  }
}

export function jsonRequest(url: string, body: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function routeParams<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) }
}
