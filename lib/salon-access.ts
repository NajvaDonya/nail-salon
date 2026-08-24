import { prisma } from '@/lib/db'
import { isManager } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import type { UserRole } from '@/lib/types'

export interface SalonAccessContext {
  salonId: string | null
  staffId: string | null
}

export async function resolveSalonAccess(user: {
  id: string
  role: string
  salonId?: string | null
}): Promise<SalonAccessContext> {
  if (isManager(user.role as UserRole)) {
    const salonId = await getManagerSalonId(user.id, user.salonId)
    return { salonId, staffId: null }
  }

  if (user.role === 'STAFF') {
    const staff = await prisma.staff.findFirst({
      where: { userId: user.id },
      select: { id: true, salonId: true },
    })
    return { salonId: staff?.salonId ?? null, staffId: staff?.id ?? null }
  }

  return { salonId: null, staffId: null }
}

export async function assertSalonMembership(
  user: { id: string; role: string; salonId?: string | null },
  salonId: string
): Promise<SalonAccessContext> {
  const access = await resolveSalonAccess(user)
  if (!access.salonId || access.salonId !== salonId) {
    throw new Error('دسترسی غیرمجاز')
  }
  return access
}
