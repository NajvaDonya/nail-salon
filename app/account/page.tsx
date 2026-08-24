'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatJalaliDate, formatJalaliTime, formatPersianPrice } from '@/lib/jalali'
import { PERSIAN_STATUS, STATUS_COLORS } from '@/lib/types'
import type { AppointmentStatus } from '@/lib/types'
import { Calendar, Clock, Loader2, LogOut, Scissors, Star } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

interface Appointment {
  id: string
  trackingCode: string | null
  status: AppointmentStatus
  startTime: string
  endTime: string
  totalPrice: number
  depositAmount: number
  balanceDue: number
  salon: { name: string; slug: string }
  staff: { name: string }
  services: { name: string; duration: number }[]
  payment: { status: string; paidAt: string | null } | null
  hasReview: boolean
  reviewRating: number | null
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'خطا در دریافت نوبت‌ها')
  return data
}

export default function AccountPage() {
  const { user, logout } = useAuth()
  const { data, error, isLoading, mutate } = useSWR<{ appointments: Appointment[] }>(
    '/api/customer/appointments',
    fetcher
  )
  const [resumeLoadingId, setResumeLoadingId] = useState<string | null>(null)
  const [resumeError, setResumeError] = useState('')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState('')

  const appointments = data?.appointments ?? []

  const handleResumePayment = async (appointmentId: string) => {
    setResumeError('')
    setResumeLoadingId(appointmentId)
    try {
      const res = await fetch(`/api/customer/appointments/${appointmentId}/resume-payment`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.expired) {
          await mutate()
        }
        throw new Error(json.error || 'خطا در ادامه پرداخت')
      }
      window.location.href = json.paymentUrl
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'خطا در ادامه پرداخت')
      setResumeLoadingId(null)
    }
  }

  const handleCancelAppointment = async (appointmentId: string) => {
    setCancelError('')
    setCancelLoadingId(appointmentId)
    try {
      const res = await fetch(`/api/customer/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'cancel' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'خطا در لغو نوبت')
      await mutate()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'خطا در لغو نوبت')
    } finally {
      setCancelLoadingId(null)
    }
  }

  const handleSubmitReview = async (appointmentId: string) => {
    setReviewError('')
    setReviewSubmitting(true)
    try {
      const res = await fetch('/api/customer/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          appointmentId,
          rating,
          comment: comment.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'خطا در ثبت نظر')
      setReviewingId(null)
      setComment('')
      setRating(5)
      await mutate()
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'خطا در ثبت نظر')
    } finally {
      setReviewSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">نوبت‌های من</h1>
            <p className="text-sm text-muted-foreground">
              {user?.firstName} {user?.lastName} — {user?.phone}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => logout()}>
            <LogOut className="w-4 h-4 ml-2" />
            خروج
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {cancelError && (
          <Card className="p-4 border-destructive/40">
            <p className="text-sm text-destructive">{cancelError}</p>
          </Card>
        )}

        {resumeError && (
          <Card className="p-4 border-destructive/40">
            <p className="text-sm text-destructive">{resumeError}</p>
            {resumeError.includes('دوباره رزرو') && (
              <Button asChild size="sm" className="mt-3">
                <Link href="/">رزرو نوبت جدید</Link>
              </Button>
            )}
          </Card>
        )}

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <Card className="p-8 text-center">
            <p className="text-destructive">{error.message}</p>
          </Card>
        )}

        {!isLoading && !error && appointments.length === 0 && (
          <Card className="p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground mb-4">هنوز نوبتی ثبت نکرده‌اید</p>
            <Button asChild>
              <Link href="/">رزرو نوبت</Link>
            </Button>
          </Card>
        )}

        {appointments.map((apt, index) => (
          <motion.div
            key={apt.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{apt.salon.name}</p>
                    <p className="text-sm text-muted-foreground">{apt.staff.name}</p>
                  </div>
                  <Badge className={cn('shrink-0', STATUS_COLORS[apt.status])}>
                    {PERSIAN_STATUS[apt.status]}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatJalaliDate(new Date(apt.startTime), 'EEEE d MMMM yyyy')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatJalaliTime(apt.startTime)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Scissors className="w-4 h-4" />
                    {apt.services.map((s) => s.name).join('، ')}
                  </span>
                </div>

                <div className="flex flex-col gap-1 pt-2 border-t text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">مبلغ کل:</span>
                    <span className="font-bold">{formatPersianPrice(apt.totalPrice)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">بیعانه:</span>
                    <span>{formatPersianPrice(apt.depositAmount)}</span>
                  </div>
                  {apt.balanceDue > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">مانده در سالن:</span>
                      <span>{formatPersianPrice(apt.balanceDue)}</span>
                    </div>
                  )}
                  {apt.trackingCode && (
                    <span className="text-xs text-muted-foreground font-mono text-left">
                      کد: {apt.trackingCode}
                    </span>
                  )}
                </div>

                {['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'].includes(apt.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancelLoadingId === apt.id}
                    onClick={() => handleCancelAppointment(apt.id)}
                  >
                    {cancelLoadingId === apt.id ? 'در حال لغو...' : 'لغو نوبت'}
                  </Button>
                )}

                {apt.status === 'AWAITING_PAYMENT' && (
                  <Button
                    size="sm"
                    disabled={resumeLoadingId === apt.id}
                    onClick={() => handleResumePayment(apt.id)}
                  >
                    {resumeLoadingId === apt.id ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        در حال انتقال...
                      </>
                    ) : (
                      'ادامه پرداخت'
                    )}
                  </Button>
                )}

                {apt.status === 'COMPLETED' && !apt.hasReview && reviewingId !== apt.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setReviewingId(apt.id)
                      setReviewError('')
                      setRating(5)
                      setComment('')
                    }}
                  >
                    ثبت نظر
                  </Button>
                )}

                {apt.hasReview && apt.reviewRating && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Star className="w-4 h-4 fill-warning text-warning" />
                    امتیاز شما: {apt.reviewRating}
                  </p>
                )}

                {reviewingId === apt.id && (
                  <div className="space-y-3 rounded-xl border p-3 bg-muted/30">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setRating(value)}
                          className="p-1"
                          aria-label={`${value} ستاره`}
                        >
                          <Star
                            className={cn(
                              'w-6 h-6',
                              value <= rating
                                ? 'fill-warning text-warning'
                                : 'text-muted-foreground'
                            )}
                          />
                        </button>
                      ))}
                    </div>
                    <Textarea
                      placeholder="نظر شما (اختیاری)"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={2}
                    />
                    {reviewError && <p className="text-sm text-destructive">{reviewError}</p>}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={reviewSubmitting}
                        onClick={() => handleSubmitReview(apt.id)}
                      >
                        {reviewSubmitting ? 'در حال ثبت...' : 'ارسال نظر'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setReviewingId(null)}
                      >
                        انصراف
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </main>
    </div>
  )
}
