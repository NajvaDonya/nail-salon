'use client'

import { motion } from 'framer-motion'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPersianDate, formatPersianPrice, englishToPersian, formatPersianTime } from '@/lib/jalali'
import { PERSIAN_STATUS, STATUS_COLORS } from '@/lib/types'
import type { AppointmentStatus } from '@/lib/types'
import {
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  Star,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import Link from 'next/link'

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

interface StatCardProps {
  title: string
  value: string | number
  description: string
  icon: React.ReactNode
  color?: string
}

function StatCard({ title, value, description, icon, color = 'primary' }: StatCardProps) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="glass hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-3xl font-bold">
                {typeof value === 'number' ? englishToPersian(value.toString()) : value}
              </p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl bg-${color}/10 flex items-center justify-center`}>
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

interface TodayAppointment {
  id: string
  time: string
  customerName: string
  customerAvatar?: string
  serviceName: string
  staffName: string
  status: AppointmentStatus
  price: number
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

function mapAppointment(apt: {
  id: string
  startTime: string
  status: AppointmentStatus
  totalPrice: number
  customer: { firstName: string | null; lastName: string | null }
  staff: { name: string }
  services: { name: string }[]
}): TodayAppointment {
  const customerName = [apt.customer.firstName, apt.customer.lastName].filter(Boolean).join(' ') || 'مشتری'
  return {
    id: apt.id,
    time: formatPersianTime(toTimeString(apt.startTime)),
    customerName,
    serviceName: apt.services.map((service) => service.name).join('، ') || 'خدمت',
    staffName: apt.staff.name,
    status: apt.status,
    price: apt.totalPrice,
  }
}

export function DashboardOverview() {
  const today = new Date().toISOString().split('T')[0]

  const { data: statsData, isLoading: statsLoading, error: statsError } = useSWR(
    '/api/dashboard/stats',
    fetcher
  )

  const { data: appointmentsData, isLoading: appointmentsLoading } = useSWR(
    `/api/dashboard/appointments?date=${today}`,
    fetcher
  )

  const stats = statsData?.stats ?? {
    todayAppointments: 0,
    weekAppointments: 0,
    monthRevenue: 0,
    avgRating: 0,
  }

  const todayAppointments: TodayAppointment[] = (appointmentsData?.appointments ?? []).map(mapAppointment)
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

  if (statsError) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive">{statsError.message}</p>
      </Card>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">داشبورد</h1>
          <p className="text-muted-foreground">{formatPersianDate(new Date(), 'EEEE d MMMM yyyy')}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/appointments">
            <Calendar className="w-4 h-4 ml-2" />
            مدیریت نوبت‌ها
          </Link>
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="نوبت‌های امروز"
          value={stats.todayAppointments}
          description="نوبت ثبت‌شده برای امروز"
          icon={<Calendar className="w-6 h-6 text-primary" />}
          color="primary"
        />
        <StatCard
          title="نوبت‌های هفته"
          value={stats.weekAppointments}
          description="از ابتدای هفته"
          icon={<Users className="w-6 h-6 text-accent-foreground" />}
          color="accent"
        />
        <StatCard
          title="درآمد ماه"
          value={formatPersianPrice(stats.monthRevenue)}
          description="نوبت‌های تکمیل‌شده"
          icon={<DollarSign className="w-6 h-6 text-success" />}
          color="success"
        />
        <StatCard
          title="امتیاز کلی"
          value={englishToPersian(avgRating.toFixed(1))}
          description={statsData?.recentReviews?.length ? 'از نظرات اخیر' : 'هنوز نظری ثبت نشده'}
          icon={<Star className="w-6 h-6 text-warning" />}
          color="warning"
        />
      </div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>نوبت‌های امروز</CardTitle>
              <CardDescription>لیست نوبت‌های امروز به ترتیب ساعت</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/appointments">
                مشاهده همه
                <ArrowLeft className="w-4 h-4 mr-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todayAppointments.map((appointment, index) => (
                <motion.div
                  key={appointment.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="w-16 text-center">
                    <Clock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <span className="text-lg font-bold">{appointment.time}</span>
                  </div>

                  <Avatar className="w-10 h-10">
                    <AvatarImage src={appointment.customerAvatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {appointment.customerName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{appointment.customerName}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {appointment.serviceName} • {appointment.staffName}
                    </p>
                  </div>

                  <div className="text-left">
                    <p className="font-medium">{formatPersianPrice(appointment.price)}</p>
                    <Badge className={STATUS_COLORS[appointment.status]}>
                      {PERSIAN_STATUS[appointment.status]}
                    </Badge>
                  </div>

                  {appointment.status === 'PENDING' && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-success hover:text-success">
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive">
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))}

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
