import type { AuthUser } from './types'
import { isManager } from './auth'
import { getManagerSalonId } from './salon'

export async function requireManagerUser(user: AuthUser | null): Promise<
  | { ok: true; salonId: string; user: AuthUser }
  | { ok: false; status: 403 | 404; error: string }
> {
  if (!user || !isManager(user.role)) {
    return { ok: false, status: 403, error: 'دسترسی غیرمجاز' }
  }

  const salonId = await getManagerSalonId(user.id, user.salonId)
  if (!salonId) {
    return { ok: false, status: 404, error: 'سالن یافت نشد' }
  }

  return { ok: true, salonId, user }
}
