// Auth utilities
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { JWTPayload, AuthUser, UserRole } from './types'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

const COOKIE_NAME = 'fair_session'
const TOKEN_EXPIRY = '7d'

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// JWT functions
export async function createToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

// Cookie management
export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value || null
}

export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

// Get current user from cookie
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getAuthCookie()
  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload) return null

  // Import prisma dynamically to avoid circular dependencies
  const { prisma } = await import('./db')
  
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      phone: true,
      email: true,
      firstName: true,
      lastName: true,
      avatar: true,
      role: true,
      salonId: true,
      salon: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  })

  if (!user) return null

  return user as AuthUser
}

// OTP generation
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Check permission
export function hasPermission(role: UserRole, permission: string): boolean {
  const { ROLE_PERMISSIONS } = require('./types')
  const permissions = ROLE_PERMISSIONS[role]
  
  if (permissions.includes('*')) return true
  if (permissions.includes(permission)) return true
  
  // Check for wildcard permissions
  const [resource] = permission.split(':')
  if (permissions.includes(`${resource}:*`)) return true
  
  return false
}

// Role check helpers
export function isManager(role: UserRole): boolean {
  return role === 'MANAGER' || role === 'SUPER_ADMIN'
}

export function isStaff(role: UserRole): boolean {
  return role === 'STAFF' || isManager(role)
}

export function isCustomer(role: UserRole): boolean {
  return role === 'CUSTOMER'
}
