'use client'

import { AuthGuard } from '@/components/auth'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard allowedRoles={['CUSTOMER']}>{children}</AuthGuard>
}
