'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AppointmentForm,
  emptyAppointmentForm,
  getHoldToken,
  type AppointmentFormValues,
} from '@/components/appointments/appointment-form'
import {
  AppointmentApprovalButtons,
  getPendingApprovalLabel,
} from '@/components/appointments/appointment-approval-buttons'
import { formatCustomerName } from '@/lib/customer'
import {
  formatPersianDate,
  formatPersianPrice,
  formatPersianTime,
  formatServiceWithDuration,
  persianToEnglish,
  toDateKey,
} from '@/lib/jalali'
import { PERSIAN_STATUS, STATUS_COLORS } from '@/lib/types'
import type { AppointmentStatus } from '@/lib/types'
import {
  Calendar,
  Clock,
  Phone,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Plus,
} from 'lucide-react'

interface Service {
  id: string
  name: string
  price: number
  duration: number
}

interface Appointment {
  id: string
  startTime: string
  endTime: string
  kind?: 'SERVICE' | 'LUNCH'
  customer: {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string
  }
  services: { name: string; duration: number }[]
  totalPrice: number
  status: AppointmentStatus
  pendingApproval: 'NONE' | 'UPDATE' | 'DELETE'
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'خطا در دریافت نوبت‌ها')
  }
  return data
}

function toTimeString(iso: string) {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function StaffAppointmentsPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [form, setForm] = useState<AppointmentFormValues>(emptyAppointmentForm)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const dateParam = toDateKey(currentDate)

  const { data, error, isLoading, mutate } = useSWR<{ appointments: Appointment[] }>(
    `/api/dashboard/appointments?date=${dateParam}`,
    fetcher
  )
  const { data: servicesData } = useSWR<{ services: Service[] }>(
    '/api/dashboard/services',
    fetcher
  )

  const appointments = useMemo(() => data?.appointments ?? [], [data])
  const services = servicesData?.services ?? []

  const navigateDate = (days: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + days)
    setCurrentDate(newDate)
  }

  const resetForm = () => {
    setForm(emptyAppointmentForm)
    setFormError('')
  }

  const handleCreateAppointment = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')

    const phone = persianToEnglish(form.customerPhone).replace(/\D/g, '')
    const isLunch = form.kind === 'LUNCH'

    if (!isLunch && !form.customerName.trim()) {
      setFormError('نام مشتری الزامی است')
      return
    }
    if (!isLunch && (phone.length !== 11 || !phone.startsWith('09'))) {
      setFormError('شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود')
      return
    }
    if (!isLunch && form.serviceIds.length === 0) {
      setFormError('حداقل یک خدمت انتخاب کنید')
      return
    }
    if (!form.startTime) {
      setFormError('ساعت نوبت را انتخاب کنید')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/dashboard/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: form.kind,
          ...(form.kind === 'SERVICE' && form.customerId ? { customerId: form.customerId } : {}),
          ...(form.kind === 'SERVICE'
            ? {
                customerName: form.customerName.trim(),
                customerPhone: phone,
                serviceIds: form.serviceIds,
              }
            : {}),
          date: form.appointmentDate,
          startTime: form.startTime,
          holdToken: getHoldToken(),
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        setFormError(result.error || 'خطا در ثبت نوبت')
        return
      }

      await mutate()
      resetForm()
      setIsAddDialogOpen(false)
      toast.success(
        isLunch ? 'درخواست ناهار ثبت شد و در انتظار تایید است' : 'نوبت با موفقیت ثبت شد'
      )
    } catch {
      setFormError('خطا در برقراری ارتباط با سرور')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">نوبت‌های من</h1>
          <p className="text-muted-foreground">مشاهده، ثبت و مدیریت نوبت‌های شما</p>
        </div>
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            if (open) {
              setForm({ ...emptyAppointmentForm, appointmentDate: dateParam })
              setFormError('')
            } else {
              resetForm()
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 ml-2" />
              ثبت نوبت
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ثبت نوبت جدید</DialogTitle>
              <DialogDescription>اطلاعات نوبت را وارد کنید</DialogDescription>
            </DialogHeader>
            <AppointmentForm
              mode="add"
              idPrefix="staff-add"
              values={form}
              staff={[]}
              services={services}
              showStaffSelect={false}
              formError={formError}
              isSubmitting={isSubmitting}
              onChange={setForm}
              onSubmit={handleCreateAppointment}
              onCancel={() => {
                setIsAddDialogOpen(false)
                resetForm()
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

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

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <Card className="p-8 text-center">
          <p className="text-destructive">{error.message}</p>
        </Card>
      )}

      {!isLoading && !error && (
        <div className="space-y-4">
          {appointments.length > 0 ? (
            appointments.map((appointment, index) => {
              const isLunch = appointment.kind === 'LUNCH'
              const name = isLunch ? 'ناهار / استراحت' : formatCustomerName(appointment.customer)
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="glass hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-4">
                      {pendingLabel && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          {pendingLabel}
                        </Badge>
                      )}

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-20 text-center sm:border-l sm:pl-4">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                            <Clock className="w-4 h-4" />
                          </div>
                          <p className="font-bold text-lg">
                            {formatPersianTime(toTimeString(appointment.startTime))}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            تا {formatPersianTime(toTimeString(appointment.endTime))}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 flex-1">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{name}</p>
                            <p className="text-sm text-muted-foreground">{serviceName}</p>
                          </div>
                        </div>

                        <div className="text-left space-y-2">
                          {!isLunch && (
                            <p className="font-bold">{formatPersianPrice(appointment.totalPrice)}</p>
                          )}
                          <Badge className={STATUS_COLORS[appointment.status]}>
                            {PERSIAN_STATUS[appointment.status]}
                          </Badge>
                        </div>

                        {!isLunch && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="w-9 h-9" asChild>
                            <a href={`tel:${appointment.customer.phone}`}>
                              <Phone className="w-4 h-4" />
                            </a>
                          </Button>
                        </div>
                        )}
                      </div>

                      <AppointmentApprovalButtons
                        appointmentId={appointment.id}
                        pendingApproval={appointment.pendingApproval}
                        status={appointment.status}
                        kind={appointment.kind ?? 'SERVICE'}
                        viewerRole="STAFF"
                        onComplete={() => mutate()}
                      />
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })
          ) : (
            <Card className="p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">نوبتی برای این روز ثبت نشده است</p>
            </Card>
          )}
        </div>
      )}
    </motion.div>
  )
}
