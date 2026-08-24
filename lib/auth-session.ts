import { jwtVerify } from 'jose'
import type { UserRole } from './types'
import { getJwtSecret } from './jwt-config'

export interface SessionPayload {
  userId: string
  phone: string
  role: UserRole
  salonId?: string
}

export async function getSessionFromToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
