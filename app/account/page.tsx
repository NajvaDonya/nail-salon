'use client'

import { motion } from 'framer-motion'
import useSWR from 'swr'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatJalaliDate, formatJalaliTime, formatPersianPrice } from '@/lib/jalali'
import { PERSIAN_STATUS, STATUS_COLORS } from '@/lib/types'
import type { AppointmentStatus } from '@/lib/types'
import { Calendar, Clock, Loader2, LogOut, Scissors } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

interface Appointment {
  id: string
  trackingCode: string | null
  status: AppointmentStatus
  startTime: string
  endTime: string
  totalPrice: number
  salon: { name: string; slug: string }
  staff: { name: string }
  services: { name: string; duration: number }[]
  payment: { status: string; paidAt: string | null } | null
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'خطا در دریافت نوبت‌ها')
  return data
}

export default function AccountPage() {
  const { user, logout } = useAuth()
  const { data, error, isLoading } = useSWR<{ appointments: Appointment[] }>(
    '/api/customer/appointments',
    fetcher
  )

  const appointments = data?.appointments ?? []

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
              <Link href="/salon/nail-art-studio/book">رزرو نوبت</Link>
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

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-bold text-primary">{formatPersianPrice(apt.totalPrice)}</span>
                  {apt.trackingCode && (
                    <span className="text-xs text-muted-foreground font-mono">
                      کد: {apt.trackingCode}
                    </span>
                  )}
                </div>

                {apt.status === 'AWAITING_PAYMENT' && apt.salon.slug && (
                  <Button size="sm" asChild>
                    <Link href={`/salon/${apt.salon.slug}/book`}>ادامه پرداخت</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </main>
    </div>
  )
}
