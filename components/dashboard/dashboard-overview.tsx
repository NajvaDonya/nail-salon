'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPersianDate, formatPersianPrice, englishToPersian } from '@/lib/jalali'
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
} from 'lucide-react'
import Link from 'next/link'

// Animation variants
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
  trend?: number
  color?: string
}

function StatCard({ title, value, description, icon, trend, color = 'primary' }: StatCardProps) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="glass hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-3xl font-bold">{typeof value === 'number' ? englishToPersian(value.toString()) : value}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl bg-${color}/10 flex items-center justify-center`}>
              {icon}
            </div>
          </div>
          {trend !== undefined && (
            <div className="mt-4 flex items-center gap-1 text-sm">
              <TrendingUp className={`w-4 h-4 ${trend >= 0 ? 'text-success' : 'text-destructive rotate-180'}`} />
              <span className={trend >= 0 ? 'text-success' : 'text-destructive'}>
                {englishToPersian(Math.abs(trend).toString())}%
              </span>
              <span className="text-muted-foreground">نسبت به ماه قبل</span>
            </div>
          )}
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

interface DashboardOverviewProps {
  stats?: {
    todayAppointments: number
    weekAppointments: number
    monthRevenue: number
    avgRating: number
  }
  todayAppointments?: TodayAppointment[]
}

export function DashboardOverview({ stats, todayAppointments = [] }: DashboardOverviewProps) {
  // Default mock data for initial display
  const displayStats = stats || {
    todayAppointments: 8,
    weekAppointments: 42,
    monthRevenue: 15600000,
    avgRating: 4.7,
  }

  const displayAppointments: TodayAppointment[] = todayAppointments.length > 0 ? todayAppointments : [
    {
      id: '1',
      time: '10:00',
      customerName: 'سارا احمدی',
      serviceName: 'کراتین مو',
      staffName: 'مریم کریمی',
      status: 'CONFIRMED',
      price: 850000,
    },
    {
      id: '2',
      time: '11:30',
      customerName: 'نازنین رضایی',
      serviceName: 'رنگ مو',
      staffName: 'فاطمه حسینی',
      status: 'PENDING',
      price: 650000,
    },
    {
      id: '3',
      time: '14:00',
      customerName: 'مینا محمدی',
      serviceName: 'مانیکور',
      staffName: 'زهرا علیزاده',
      status: 'CONFIRMED',
      price: 350000,
    },
    {
      id: '4',
      time: '15:30',
      customerName: 'لیلا کاظمی',
      serviceName: 'اصلاح ابرو',
      staffName: 'مریم کریمی',
      status: 'IN_PROGRESS',
      price: 150000,
    },
  ]

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">داشبورد</h1>
          <p className="text-muted-foreground">{formatPersianDate(new Date(), 'EEEE d MMMM yyyy')}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/appointments/new">
            <Calendar className="w-4 h-4 ml-2" />
            ثبت نوبت جدید
          </Link>
        </Button>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="نوبت‌های امروز"
          value={displayStats.todayAppointments}
          description={`${englishToPersian('3')} تکمیل شده`}
          icon={<Calendar className="w-6 h-6 text-primary" />}
          color="primary"
        />
        <StatCard
          title="نوبت‌های هفته"
          value={displayStats.weekAppointments}
          description="از شنبه تا الان"
          icon={<Users className="w-6 h-6 text-accent-foreground" />}
          trend={12}
          color="accent"
        />
        <StatCard
          title="درآمد ماه"
          value={formatPersianPrice(displayStats.monthRevenue)}
          description="تا امروز"
          icon={<DollarSign className="w-6 h-6 text-success" />}
          trend={8}
          color="success"
        />
        <StatCard
          title="امتیاز کلی"
          value={englishToPersian(displayStats.avgRating.toFixed(1))}
          description="از ۵ ستاره"
          icon={<Star className="w-6 h-6 text-warning" />}
          color="warning"
        />
      </div>

      {/* Today's Appointments */}
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
              {displayAppointments.map((appointment, index) => (
                <motion.div
                  key={appointment.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="w-16 text-center">
                    <Clock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                    <span className="text-lg font-bold">{englishToPersian(appointment.time)}</span>
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

                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-success hover:text-success">
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive">
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}

              {displayAppointments.length === 0 && (
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
