'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { getPostLoginRedirect } from '@/lib/auth-redirect'
import { Scissors, Phone, Lock, ArrowLeft, User, Loader2, Eye, EyeOff } from 'lucide-react'

type AuthMode = 'phone' | 'otp' | 'password' | 'register'

interface LoginFormProps {
  onSuccess?: () => void
  redirectTo?: string
}

export function LoginForm({ onSuccess, redirectTo }: LoginFormProps) {
  const router = useRouter()
  const { login, loginWithOTP, requestOTP, refreshUser } = useAuth()
  const [mode, setMode] = useState<AuthMode>('phone')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null)

  // Countdown timer for OTP resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const navigateAfterLogin = (destination: string) => {
    onSuccess?.()
    router.replace(destination)
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await requestOTP(phone)
    
    if (result.success) {
      setMode('otp')
      setCountdown(60)
      setDevOtpCode(result.devCode || null)
    } else {
      setError(result.error || 'خطا در ارسال کد')
    }
    
    setLoading(false)
  }

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await loginWithOTP(phone, otp)
    
    if (result.success) {
      const destination = result.redirectTo || redirectTo
      if (destination) {
        navigateAfterLogin(destination)
        return
      }
    } else if (result.error?.includes('needsRegistration')) {
      setMode('register')
    } else {
      setError(result.error || 'کد نامعتبر است')
    }
    
    setLoading(false)
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Re-request OTP and verify with name
    const otpResult = await requestOTP(phone)
    if (!otpResult.success) {
      setError(otpResult.error || 'خطا در ارسال کد')
      setLoading(false)
      return
    }

    // For now, create user with OTP verify
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ phone, code: otp, firstName, lastName }),
    })
    
    if (res.ok) {
      const data = await res.json()
      await refreshUser()
      navigateAfterLogin(getPostLoginRedirect(data.user.role))
      return
    } else {
      const data = await res.json()
      setError(data.error || 'خطا در ثبت‌نام')
    }
    
    setLoading(false)
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(phone, password)
    
    if (result.success) {
      const destination = result.redirectTo || redirectTo
      if (destination) {
        navigateAfterLogin(destination)
        return
      }
    } else {
      setError(result.error || 'خطا در ورود')
    }
    
    setLoading(false)
  }

  const resendOTP = useCallback(async () => {
    if (countdown > 0) return
    setLoading(true)
    const result = await requestOTP(phone)
    if (result.success) {
      setCountdown(60)
      setDevOtpCode(result.devCode || null)
    } else {
      setError(result.error || 'خطا در ارسال مجدد')
    }
    setLoading(false)
  }, [countdown, phone, requestOTP])

  const formatPhone = (value: string) => {
    // Only allow numbers and format as 09xxxxxxxxx
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length <= 11) {
      setPhone(cleaned)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto glass">
      <CardHeader className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center"
        >
          <Scissors className="w-8 h-8 text-primary" />
        </motion.div>
        <div>
          <CardTitle className="text-2xl">فیر سالن</CardTitle>
          <CardDescription className="mt-2">
            {mode === 'phone' && 'برای ورود شماره موبایل خود را وارد کنید'}
            {mode === 'otp' && 'کد تایید ارسال شده را وارد کنید'}
            {mode === 'password' && 'رمز عبور خود را وارد کنید'}
            {mode === 'register' && 'اطلاعات خود را تکمیل کنید'}
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent>
        <AnimatePresence mode="wait">
          {/* Phone Input Mode */}
          {mode === 'phone' && (
            <motion.form
              key="phone"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handlePhoneSubmit}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="phone">شماره موبایل</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    value={phone}
                    onChange={(e) => formatPhone(e.target.value)}
                    className="pr-10 text-left dir-ltr"
                    dir="ltr"
                    required
                    pattern="09[0-9]{9}"
                  />
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-destructive text-center"
                >
                  {error}
                </motion.p>
              )}

              <Button type="submit" className="w-full" disabled={loading || phone.length !== 11}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'دریافت کد تایید'}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">یا</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setMode('password')}
              >
                <Lock className="w-4 h-4 ml-2" />
                ورود با رمز عبور
              </Button>
            </motion.form>
          )}

          {/* OTP Input Mode */}
          {mode === 'otp' && (
            <motion.form
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleOTPSubmit}
              className="space-y-4"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode('phone')}
                className="mb-2"
              >
                <ArrowLeft className="w-4 h-4 ml-1" />
                تغییر شماره
              </Button>

              <div className="text-center text-sm text-muted-foreground mb-4">
                کد تایید به شماره <span className="font-medium text-foreground dir-ltr">{phone}</span> ارسال شد
              </div>

              {devOtpCode && (
                <div className="rounded-lg bg-muted p-3 text-center text-sm">
                  <p className="text-muted-foreground">حالت تست (بدون پیامک)</p>
                  <p className="font-mono text-lg font-bold tracking-widest dir-ltr">{devOtpCode}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="otp">کد تایید</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="۱۲۳۴۵۶"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-widest dir-ltr"
                  dir="ltr"
                  required
                  maxLength={6}
                />
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-destructive text-center"
                >
                  {error}
                </motion.p>
              )}

              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تایید و ورود'}
              </Button>

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    ارسال مجدد کد تا {countdown} ثانیه دیگر
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="link"
                    onClick={resendOTP}
                    disabled={loading}
                  >
                    ارسال مجدد کد
                  </Button>
                )}
              </div>
            </motion.form>
          )}

          {/* Password Mode */}
          {mode === 'password' && (
            <motion.form
              key="password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handlePasswordSubmit}
              className="space-y-4"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode('phone')}
                className="mb-2"
              >
                <ArrowLeft className="w-4 h-4 ml-1" />
                بازگشت
              </Button>

              <div className="space-y-2">
                <Label htmlFor="phone-pass">شماره موبایل</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="phone-pass"
                    type="tel"
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    value={phone}
                    onChange={(e) => formatPhone(e.target.value)}
                    className="pr-10 text-left dir-ltr"
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">رمز عبور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="رمز عبور"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-destructive text-center"
                >
                  {error}
                </motion.p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ورود'}
              </Button>
            </motion.form>
          )}

          {/* Register Mode */}
          {mode === 'register' && (
            <motion.form
              key="register"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleRegisterSubmit}
              className="space-y-4"
            >
              <div className="text-center text-sm text-muted-foreground mb-4">
                به فیر سالن خوش آمدید! لطفا اطلاعات خود را تکمیل کنید.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">نام</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="نام"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pr-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">نام خانوادگی</Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="نام خانوادگی"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-destructive text-center"
                >
                  {error}
                </motion.p>
              )}

              <Button type="submit" className="w-full" disabled={loading || !firstName || !lastName}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ثبت‌نام و ورود'}
              </Button>
            </motion.form>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
