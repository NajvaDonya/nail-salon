'use client'

import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import type { UserRole } from '@/lib/types'

interface AuthGuardProps {
  children: ReactNode
  allowedRoles?: UserRole[]
  redirectTo?: string
}

export function AuthGuard({ children, allowedRoles, redirectTo = '/auth/login' }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push(redirectTo)
      } else if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect based on role
        if (user.role === 'CUSTOMER') {
          router.push('/booking')
        } else if (user.role === 'STAFF') {
          router.push('/staff')
        } else if (user.role === 'MANAGER' || user.role === 'SUPER_ADMIN') {
          router.push('/dashboard')
        }
      }
    }
  }, [user, loading, allowedRoles, redirectTo, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null
  }

  return <>{children}</>
}
