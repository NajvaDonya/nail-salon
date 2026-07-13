'use client'

import { motion } from 'framer-motion'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AppointmentApprovalButtons,
  getPendingApprovalLabel,
} from '@/components/appointments/appointment-approval-buttons'
import { formatPersianDate, formatPersianPrice, englishToPersian, formatPersianTime, formatServiceWithDuration } from '@/lib/jalali'
import { PERSIAN_STATUS, STATUS_COLORS } from '@/lib/types'
import type { AppointmentStatus } from '@/lib/types'
import {
  Calendar,
  Clock,
  Star,
  TrendingUp,
  Phone,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

interface Appointment {
  id: string
  startTime: string
  status: AppointmentStatus
  kind?: 'SERVICE' | 'LUNCH'
  pendingApproval: 'NONE' | 'UPDATE' | 'DELETE'
  totalPrice: number
  customer: {
    firstName: string | null
    lastName: string | null
    phone: string
  }
  services: { name: string; duration: number }[]
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'خطا در دریافت اطلاعات')
  }
  return data
}

function toTimeString(iso: string) {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function customerName(customer: Appointment['customer']) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'مشتری'
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function StaffDashboardPage() {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  const { data: statsData, isLoading: statsLoading } = useSWR('/api/dashboard/stats', fetcher)
  const { data: appointmentsData, isLoading: appointmentsLoading, mutate: mutateAppointments } = useSWR(
    `/api/dashboard/appointments?date=${today}`,
    fetcher
  )

  const stats = statsData?.stats ?? {
    todayAppointments: 0,
    weekAppointments: 0,
    monthRevenue: 0,
  }

  const todayAppointments: Appointment[] = appointmentsData?.appointments ?? []

  const avgRating =
    statsData?.recentReviews?.length > 0
      ? statsData.recentReviews.reduce((sum: number, review: { rating: number }) => sum + review.rating, 0) /
        statsData.recentReviews.length
      : 0

  if (statsLoading || appointmentsLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold">سلام {user?.firstName}!</h1>
        <p className="text-muted-foreground">{formatPersianDate(new Date(), 'EEEE d MMMM yyyy')}</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {englishToPersian(stats.todayAppointments.toString())}
                  </p>
                  <p className="text-xs text-muted-foreground">نوبت امروز</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {englishToPersian(stats.weekAppointments.toString())}
                  </p>
                  <p className="text-xs text-muted-foreground">نوبت هفته</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <Star className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{englishToPersian(avgRating.toFixed(1))}</p>
                  <p className="text-xs text-muted-foreground">امتیاز من</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass">
            <CardContent className="p-4">
              <div>
                <p className="text-lg font-bold">{formatPersianPrice(stats.monthRevenue)}</p>
                <p className="text-xs text-muted-foreground">درآمد ماه</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>نوبت‌های امروز من</CardTitle>
            <CardDescription>لیست نوبت‌های امروز به ترتیب ساعت</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todayAppointments.map((appointment, index) => {
                const isLunch = appointment.kind === 'LUNCH'
                const name = isLunch ? 'ناهار / استراحت' : customerName(appointment.customer)
                const serviceName = isLunch
                  ? 'ناهار'
                  : appointment.services
                      .map((service) => formatServiceWithDuration(service.name, service.duration))
                      .join('، ') || 'خدمت'
                const pendingLabel = getPendingApprovalLabel(
                  appointment.pendingApproval,
                  appointment.status,
                  appointment.kind ?? 'SERVICE'
                )

                return (
                  <motion.div
                    key={appointment.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors space-y-3"
                  >
                    {pendingLabel && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        {pendingLabel}
                      </Badge>
                    )}

                    <div className="flex items-center gap-4">
                      <div className="w-16 text-center">
                        <Clock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                        <span className="text-lg font-bold">
                          {formatPersianTime(toTimeString(appointment.startTime))}
                        </span>
                      </div>

                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{name}</p>
                        <p className="text-sm text-muted-foreground truncate">{serviceName}</p>
                      </div>

                      <div className="text-left space-y-1">
                        <Badge className={STATUS_COLORS[appointment.status]}>
                          {PERSIAN_STATUS[appointment.status]}
                        </Badge>
                        {!isLunch && (
                          <p className="text-sm font-medium">
                            {formatPersianPrice(appointment.totalPrice)}
                          </p>
                        )}
                      </div>

                      {!isLunch && (
                      <Button variant="ghost" size="icon" className="w-8 h-8" asChild>
                        <a href={`tel:${appointment.customer.phone}`}>
                          <Phone className="w-4 h-4" />
                        </a>
                      </Button>
                      )}
                    </div>

                    <AppointmentApprovalButtons
                      appointmentId={appointment.id}
                      pendingApproval={appointment.pendingApproval}
                      status={appointment.status}
                      kind={appointment.kind ?? 'SERVICE'}
                      viewerRole="STAFF"
                      onComplete={() => mutateAppointments()}
                    />
                  </motion.div>
                )
              })}

              {todayAppointments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>هیچ نوبتی برای امروز ثبت نشده است</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
