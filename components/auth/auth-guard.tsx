'use client'

import { useAuth } from '@/contexts/auth-context'
import { getPostLoginRedirect } from '@/lib/auth-redirect'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import type { UserRole } from '@/lib/types'

interface AuthGuardProps {
  children: ReactNode
  allowedRoles?: UserRole[]
  redirectTo?: string
}

function getRoleRedirect(role: UserRole): string {
  return getPostLoginRedirect(role)
}

export function AuthGuard({ children, allowedRoles, redirectTo = '/auth/login' }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return

    if (!user) {
      if (pathname !== redirectTo) {
        router.replace(redirectTo)
      }
      return
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      const destination = getRoleRedirect(user.role)
      if (pathname !== destination) {
        router.replace(destination)
      }
    }
  }, [user, loading, allowedRoles, redirectTo, router, pathname])

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
