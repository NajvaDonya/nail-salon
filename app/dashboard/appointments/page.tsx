'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatPersianDate, formatPersianPrice, englishToPersian } from '@/lib/jalali'
import { PERSIAN_STATUS, STATUS_COLORS } from '@/lib/types'
import type { AppointmentStatus } from '@/lib/types'
import {
  Calendar,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  Phone,
  ChevronRight,
  ChevronLeft,
  Plus,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Appointment {
  id: string
  date: string
  startTime: string
  endTime: string
  customer: {
    name: string
    phone: string
    avatar?: string
  }
  staff: {
    name: string
    avatar?: string
  }
  service: {
    name: string
    price: number
  }
  status: AppointmentStatus
}

// Mock data
const mockAppointments: Appointment[] = [
  {
    id: '1',
    date: '2024-01-15',
    startTime: '10:00',
    endTime: '11:30',
    customer: { name: 'سارا احمدی', phone: '09121234567' },
    staff: { name: 'مریم کریمی' },
    service: { name: 'کراتین مو', price: 2200000 },
    status: 'CONFIRMED',
  },
  {
    id: '2',
    date: '2024-01-15',
    startTime: '11:30',
    endTime: '13:00',
    customer: { name: 'نازنین رضایی', phone: '09129876543' },
    staff: { name: 'فاطمه حسینی' },
    service: { name: 'رنگ مو', price: 800000 },
    status: 'PENDING',
  },
  {
    id: '3',
    date: '2024-01-15',
    startTime: '14:00',
    endTime: '15:00',
    customer: { name: 'مینا محمدی', phone: '09123456789' },
    staff: { name: 'زهرا علیزاده' },
    service: { name: 'مانیکور', price: 250000 },
    status: 'IN_PROGRESS',
  },
  {
    id: '4',
    date: '2024-01-15',
    startTime: '15:30',
    endTime: '16:00',
    customer: { name: 'لیلا کاظمی', phone: '09127654321' },
    staff: { name: 'مریم کریمی' },
    service: { name: 'اصلاح ابرو', price: 150000 },
    status: 'COMPLETED',
  },
  {
    id: '5',
    date: '2024-01-14',
    startTime: '10:00',
    endTime: '11:00',
    customer: { name: 'فرشته امینی', phone: '09126543210' },
    staff: { name: 'فاطمه حسینی' },
    service: { name: 'پاکسازی صورت', price: 450000 },
    status: 'COMPLETED',
  },
  {
    id: '6',
    date: '2024-01-14',
    startTime: '12:00',
    endTime: '12:30',
    customer: { name: 'شیما نوروزی', phone: '09125432109' },
    staff: { name: 'زهرا علیزاده' },
    service: { name: 'اصلاح ابرو', price: 150000 },
    status: 'CANCELLED',
  },
]

export default function AppointmentsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentDate, setCurrentDate] = useState(new Date())

  const filteredAppointments = mockAppointments.filter((apt) => {
    const matchesSearch =
      apt.customer.name.includes(search) ||
      apt.customer.phone.includes(search) ||
      apt.service.name.includes(search)
    const matchesStatus = statusFilter === 'all' || apt.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const todayAppointments = filteredAppointments.filter(
    (apt) => apt.date === currentDate.toISOString().split('T')[0]
  )

  const navigateDate = (days: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + days)
    setCurrentDate(newDate)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مدیریت نوبت‌ها</h1>
          <p className="text-muted-foreground">مشاهده و مدیریت نوبت‌های مشتریان</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 ml-2" />
          ثبت نوبت جدید
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="جستجو در نوبت‌ها..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 ml-2" />
                <SelectValue placeholder="فیلتر وضعیت" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                <SelectItem value="PENDING">در انتظار تایید</SelectItem>
                <SelectItem value="CONFIRMED">تایید شده</SelectItem>
                <SelectItem value="IN_PROGRESS">در حال انجام</SelectItem>
                <SelectItem value="COMPLETED">تکمیل شده</SelectItem>
                <SelectItem value="CANCELLED">لغو شده</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Date Navigator */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <p className="font-bold text-lg">{formatPersianDate(currentDate, 'EEEE')}</p>
          <p className="text-sm text-muted-foreground">
            {formatPersianDate(currentDate, 'd MMMM yyyy')}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => navigateDate(1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">لیست</TabsTrigger>
          <TabsTrigger value="calendar">تقویم</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {todayAppointments.length > 0 ? (
            todayAppointments.map((appointment, index) => (
              <motion.div
                key={appointment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="glass hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* Time */}
                      <div className="w-20 text-center sm:border-l sm:pl-4">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                          <Clock className="w-4 h-4" />
                        </div>
                        <p className="font-bold text-lg">
                          {englishToPersian(appointment.startTime)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          تا {englishToPersian(appointment.endTime)}
                        </p>
                      </div>

                      {/* Customer */}
                      <div className="flex items-center gap-3 flex-1">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={appointment.customer.avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {appointment.customer.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{appointment.customer.name}</p>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span dir="ltr">{appointment.customer.phone}</span>
                          </div>
                        </div>
                      </div>

                      {/* Service */}
                      <div className="flex-1">
                        <p className="font-medium">{appointment.service.name}</p>
                        <p className="text-sm text-muted-foreground">
                          توسط {appointment.staff.name}
                        </p>
                      </div>

                      {/* Price & Status */}
                      <div className="text-left space-y-2">
                        <p className="font-bold">
                          {formatPersianPrice(appointment.service.price)}
                        </p>
                        <Badge className={STATUS_COLORS[appointment.status]}>
                          {PERSIAN_STATUS[appointment.status]}
                        </Badge>
                      </div>

                      {/* Actions */}
                      {appointment.status === 'PENDING' && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-9 h-9 text-success hover:text-success hover:bg-success/10"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-9 h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <XCircle className="w-5 h-5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <Card className="p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">نوبتی برای این روز ثبت نشده است</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <Card className="p-6 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>نمای تقویم به زودی اضافه خواهد شد</p>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
