'use client'

import { AuthGuard } from '@/components/auth'
import { DashboardLayout } from '@/components/dashboard'

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard allowedRoles={['MANAGER', 'SUPER_ADMIN']}>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </AuthGuard>
  )
}
