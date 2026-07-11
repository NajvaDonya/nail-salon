'use client'

import { AuthProvider } from '@/contexts/auth-context'
import { AuthGuard } from '@/components/auth'
import { DashboardLayout } from '@/components/dashboard'

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <AuthGuard allowedRoles={['MANAGER', 'SUPER_ADMIN']}>
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </AuthGuard>
    </AuthProvider>
  )
}
