'use client'

import { AuthProvider } from '@/contexts/auth-context'
import { AuthGuard } from '@/components/auth'
import { StaffLayout } from '@/components/staff'

export default function StaffRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <AuthGuard allowedRoles={['STAFF', 'MANAGER', 'SUPER_ADMIN']}>
        <StaffLayout>
          {children}
        </StaffLayout>
      </AuthGuard>
    </AuthProvider>
  )
}
