'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { formatPersianDate, formatPersianPrice, englishToPersian } from '@/lib/jalali'
import { PERSIAN_STATUS, STATUS_COLORS } from '@/lib/types'
import type { AppointmentStatus } from '@/lib/types'
import {
  Calendar,
  Clock,
  Phone,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'

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
    service: { name: 'کراتین مو', price: 2200000 },
    status: 'CONFIRMED',
  },
  {
    id: '2',
    date: '2024-01-15',
    startTime: '13:00',
    endTime: '14:30',
    customer: { name: 'نازنین رضایی', phone: '09129876543' },
    service: { name: 'رنگ مو', price: 800000 },
    status: 'PENDING',
  },
  {
    id: '3',
    date: '2024-01-15',
    startTime: '15:30',
    endTime: '16:00',
    customer: { name: 'لیلا کاظمی', phone: '09127654321' },
    service: { name: 'اصلاح ابرو', price: 150000 },
    status: 'COMPLETED',
  },
]

export default function StaffAppointmentsPage() {
  const [currentDate, setCurrentDate] = useState(new Date())

  const filteredAppointments = mockAppointments.filter(
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
      <div>
        <h1 className="text-2xl font-bold">نوبت‌های من</h1>
        <p className="text-muted-foreground">مشاهده و مدیریت نوبت‌های شما</p>
      </div>

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

      {/* Appointments List */}
      <div className="space-y-4">
        {filteredAppointments.length > 0 ? (
          filteredAppointments.map((appointment, index) => (
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
                        <p className="text-sm text-muted-foreground">
                          {appointment.service.name}
                        </p>
                      </div>
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
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="w-9 h-9" asChild>
                        <a href={`tel:${appointment.customer.phone}`}>
                          <Phone className="w-4 h-4" />
                        </a>
                      </Button>
                      {appointment.status === 'PENDING' && (
                        <>
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
                        </>
                      )}
                    </div>
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
      </div>
    </motion.div>
  )
}
