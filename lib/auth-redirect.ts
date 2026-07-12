import type { UserRole } from './types'

export function getPostLoginRedirect(role: UserRole): string {
  switch (role) {
    case 'MANAGER':
    case 'SUPER_ADMIN':
      return '/dashboard'
    case 'STAFF':
      return '/staff'
    default:
      return '/'
  }
}
