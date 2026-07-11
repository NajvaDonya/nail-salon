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
  Clock,
  Star,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Phone,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

interface TodayAppointment {
  id: string
  time: string
  customerName: string
  customerPhone: string
  customerAvatar?: string
  serviceName: string
  status: AppointmentStatus
  price: number
}

// Mock data
const mockTodayAppointments: TodayAppointment[] = [
  {
    id: '1',
    time: '10:00',
    customerName: 'سارا احمدی',
    customerPhone: '09121234567',
    serviceName: 'کراتین مو',
    status: 'CONFIRMED',
    price: 2200000,
  },
  {
    id: '2',
    time: '13:00',
    customerName: 'نازنین رضایی',
    customerPhone: '09129876543',
    serviceName: 'رنگ مو',
    status: 'PENDING',
    price: 800000,
  },
  {
    id: '3',
    time: '15:30',
    customerName: 'لیلا کاظمی',
    customerPhone: '09127654321',
    serviceName: 'اصلاح ابرو',
    status: 'CONFIRMED',
    price: 150000,
  },
]

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

  const stats = {
    todayAppointments: 3,
    weekAppointments: 18,
    monthEarnings: 4500000,
    avgRating: 4.8,
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold">سلام {user?.firstName}!</h1>
        <p className="text-muted-foreground">{formatPersianDate(new Date(), 'EEEE d MMMM yyyy')}</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={itemVariants}>
          <Card className="glass">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{englishToPersian(stats.todayAppointments.toString())}</p>
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
                  <p className="text-2xl font-bold">{englishToPersian(stats.weekAppointments.toString())}</p>
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
                  <p className="text-2xl font-bold">{englishToPersian(stats.avgRating.toFixed(1))}</p>
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
                <p className="text-lg font-bold">{formatPersianPrice(stats.monthEarnings)}</p>
                <p className="text-xs text-muted-foreground">درآمد ماه</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Today's Appointments */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>نوبت‌های امروز من</CardTitle>
            <CardDescription>لیست نوبت‌های امروز به ترتیب ساعت</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockTodayAppointments.map((appointment, index) => (
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
                      {appointment.serviceName}
                    </p>
                  </div>

                  <div className="text-left space-y-1">
                    <Badge className={STATUS_COLORS[appointment.status]}>
                      {PERSIAN_STATUS[appointment.status]}
                    </Badge>
                    <p className="text-sm font-medium">
                      {formatPersianPrice(appointment.price)}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="w-8 h-8" asChild>
                      <a href={`tel:${appointment.customerPhone}`}>
                        <Phone className="w-4 h-4" />
                      </a>
                    </Button>
                    {appointment.status === 'PENDING' && (
                      <>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-success hover:text-success">
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}

              {mockTodayAppointments.length === 0 && (
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
