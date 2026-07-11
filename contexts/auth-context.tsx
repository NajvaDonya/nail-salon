'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { AuthUser } from '@/lib/types'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  login: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginWithOTP: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>
  requestOTP: (phone: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = async (phone: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      })
      const data = await res.json()
      
      if (res.ok) {
        setUser(data.user)
        return { success: true }
      }
      return { success: false, error: data.error }
    } catch {
      return { success: false, error: 'خطا در برقراری ارتباط' }
    }
  }

  const requestOTP = async (phone: string) => {
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      
      if (res.ok) {
        return { success: true }
      }
      return { success: false, error: data.error }
    } catch {
      return { success: false, error: 'خطا در برقراری ارتباط' }
    }
  }

  const loginWithOTP = async (phone: string, code: string) => {
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      const data = await res.json()
      
      if (res.ok) {
        setUser(data.user)
        return { success: true }
      }
      return { success: false, error: data.error }
    } catch {
      return { success: false, error: 'خطا در برقراری ارتباط' }
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithOTP, requestOTP, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
