'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PersianCalendar } from '@/components/dashboard/persian-calendar'
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
import { toast } from 'sonner'
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
  Search,
  Filter,
  Clock,
  Phone,
  ChevronRight,
  ChevronLeft,
  Plus,
  Loader2,
  Edit,
  Trash2,
  UserCog,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Service {
  id: string
  name: string
  price: number
  duration: number
}

interface StaffMember {
  id: string
  user: {
    firstName: string
    lastName: string
  }
  isActive: boolean
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
  staff: { id: string; name: string }
  services: { id: string; name: string; duration: number }[]
  totalPrice: number
  status: AppointmentStatus
  pendingApproval: 'NONE' | 'UPDATE' | 'DELETE'
  pendingChanges?: Record<string, unknown> | null
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'خطا در دریافت اطلاعات')
  }
  return data
}

const emptyForm = emptyAppointmentForm

function toTimeString(iso: string) {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function customerDisplayName(customer: Appointment['customer']) {
  return formatCustomerName(customer)
}

export default function AppointmentsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarViewDate, setCalendarViewDate] = useState(new Date())
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [form, setForm] = useState<AppointmentFormValues>(emptyForm)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  const dateParam = toDateKey(currentDate)
  const monthParam = toDateKey(calendarViewDate)
  const dayQuery =
    statusFilter === 'all' ? `date=${dateParam}` : `date=${dateParam}&status=${statusFilter}`

  const { data, error, isLoading, mutate } = useSWR<{ appointments: Appointment[] }>(
    `/api/dashboard/appointments?${dayQuery}`,
    fetcher
  )

  const { data: monthData, mutate: mutateMonth } = useSWR<{ appointments: Appointment[] }>(
    `/api/dashboard/appointments?month=${monthParam}`,
    fetcher
  )

  const { data: staffData } = useSWR<{ staff: StaffMember[] }>(
    '/api/dashboard/staff?activeOnly=true',
    fetcher
  )
  const { data: servicesData } = useSWR<{ services: Service[] }>(
    '/api/dashboard/services',
    fetcher
  )

  const appointments = data?.appointments ?? []
  const staff = staffData?.staff ?? []
  const services = servicesData?.services ?? []

  const appointmentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const apt of monthData?.appointments ?? []) {
      const key = toDateKey(new Date(apt.startTime))
      counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }, [monthData])

  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const name = customerDisplayName(apt.customer)
      const serviceNames = apt.services.map((service) => service.name).join(' ')
      return (
        name.includes(search) ||
        apt.customer.phone.includes(search) ||
        serviceNames.includes(search) ||
        apt.staff.name.includes(search)
      )
    })
  }, [appointments, search])

  const navigateDate = (days: number) => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + days)
    setCurrentDate(newDate)
    setCalendarViewDate(newDate)
  }

  const resetForm = () => {
    setForm(emptyForm)
    setFormError('')
    setEditingAppointment(null)
  }

  const openEditDialog = (appointment: Appointment) => {
    setEditingAppointment(appointment)
    const activeStaffIds = new Set(staff.map((member) => member.id))
    setForm({
      customerId: appointment.customer.id,
      customerName: customerDisplayName(appointment.customer),
      customerPhone: appointment.customer.phone,
      staffId: activeStaffIds.has(appointment.staff.id) ? appointment.staff.id : '',
      serviceIds: appointment.services.map((service) => service.id),
      appointmentDate: toDateKey(new Date(appointment.startTime)),
      startTime: toTimeString(appointment.startTime),
      kind: 'SERVICE',
    })
    setFormError('')
    setIsEditDialogOpen(true)
  }

  const closeFormDialogs = () => {
    setIsAddDialogOpen(false)
    setIsEditDialogOpen(false)
    resetForm()
  }

  const renderAppointmentForm = (mode: 'add' | 'edit') => (
    <AppointmentForm
      mode={mode}
      idPrefix={mode}
      values={form}
      staff={staff}
      services={services}
      allowLunchBooking={false}
      excludeAppointmentId={mode === 'edit' ? editingAppointment?.id : undefined}
      formError={formError}
      isSubmitting={isSubmitting}
      onChange={setForm}
      onSubmit={mode === 'add' ? handleCreateAppointment : handleEditAppointment}
      onCancel={closeFormDialogs}
    />
  )

  const handleCreateAppointment = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')

    const isLunch = form.kind === 'LUNCH'

    if (!isLunch) {
      const phone = persianToEnglish(form.customerPhone).replace(/\D/g, '')
      if (!form.customerName.trim()) {
        setFormError('نام مشتری الزامی است')
        return
      }
      if (phone.length !== 11 || !phone.startsWith('09')) {
        setFormError('شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود')
        return
      }
      if (form.serviceIds.length === 0) {
        setFormError('حداقل یک خدمت انتخاب کنید')
        return
      }
    }

    if (!form.staffId) {
      setFormError('پرسنل را انتخاب کنید')
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
          ...(isLunch
            ? {}
            : {
                ...(form.customerId ? { customerId: form.customerId } : {}),
                customerName: form.customerName.trim(),
                customerPhone: persianToEnglish(form.customerPhone).replace(/\D/g, ''),
                serviceIds: form.serviceIds,
              }),
          staffId: form.staffId,
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

      await Promise.all([mutate(), mutateMonth()])
      resetForm()
      setIsAddDialogOpen(false)
      setActionMessage(isLunch ? 'ناهار ثبت شد' : 'نوبت با موفقیت ثبت شد')
      toast.success(isLunch ? 'ناهار ثبت شد' : 'نوبت با موفقیت ثبت شد')
    } catch {
      setFormError('خطا در برقراری ارتباط با سرور')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditAppointment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingAppointment) return
    setFormError('')

    const phone = persianToEnglish(form.customerPhone).replace(/\D/g, '')
    if (!form.customerName.trim() || phone.length !== 11 || !form.staffId || form.serviceIds.length === 0) {
      setFormError('لطفاً همه فیلدهای الزامی را پر کنید')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/dashboard/appointments/${editingAppointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(form.customerId ? { customerId: form.customerId } : {}),
          customerName: form.customerName.trim(),
          customerPhone: phone,
          staffId: form.staffId,
          serviceIds: form.serviceIds,
          date: form.appointmentDate,
          startTime: form.startTime,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        setFormError(result.error || 'خطا در ویرایش نوبت')
        return
      }

      await Promise.all([mutate(), mutateMonth()])
      resetForm()
      setIsEditDialogOpen(false)
      setActionMessage('نوبت ویرایش شد')
      toast.success('نوبت ویرایش شد')
    } catch {
      setFormError('خطا در برقراری ارتباط با سرور')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteAppointment = async (appointment: Appointment) => {
    const name = customerDisplayName(appointment.customer)
    if (!confirm(`آیا از حذف نوبت «${name}» مطمئن هستید؟`)) return

    try {
      const res = await fetch(`/api/dashboard/appointments/${appointment.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'خطا در حذف نوبت')
        setFormError(result.error || 'خطا در حذف نوبت')
        return
      }

      setFormError('')
      setActionMessage('نوبت حذف شد')
      toast.success('نوبت حذف شد')
      await Promise.all([mutate(), mutateMonth()])
    } catch {
      toast.error('خطا در برقراری ارتباط با سرور')
      setFormError('خطا در برقراری ارتباط با سرور')
    }
  }

  const renderAppointmentCard = (appointment: Appointment, index: number) => {
    const isLunch = appointment.kind === 'LUNCH'
    const name = isLunch ? 'ناهار / استراحت' : customerDisplayName(appointment.customer)
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
    const canEdit = appointment.status !== 'COMPLETED' && appointment.status !== 'CANCELLED'

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

            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
              <div className="w-20 text-center lg:border-l lg:pl-4">
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
                  {!isLunch && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span dir="ltr">{appointment.customer.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <p className="font-medium">{serviceName}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <UserCog className="w-3 h-3" />
                  {appointment.staff.name}
                </p>
                <p className="text-sm text-muted-foreground">{formatPersianPrice(appointment.totalPrice)}</p>
              </div>

              <div className="text-left space-y-2">
                <Badge className={STATUS_COLORS[appointment.status]}>
                  {PERSIAN_STATUS[appointment.status]}
                </Badge>
                {canEdit && !isLunch && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8"
                      onClick={() => openEditDialog(appointment)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteAppointment(appointment)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <AppointmentApprovalButtons
              appointmentId={appointment.id}
              pendingApproval={appointment.pendingApproval}
              status={appointment.status}
              kind={appointment.kind ?? 'SERVICE'}
              viewerRole="MANAGER"
              onComplete={() => Promise.all([mutate(), mutateMonth()])}
            />
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مدیریت نوبت‌ها</h1>
          <p className="text-muted-foreground">مشاهده، ثبت و مدیریت نوبت‌ها</p>
        </div>
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            if (open) {
              setForm({ ...emptyForm, appointmentDate: dateParam })
              setFormError('')
            } else {
              resetForm()
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 ml-2" />
              ثبت نوبت جدید
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ثبت نوبت جدید</DialogTitle>
              <DialogDescription>اطلاعات نوبت را وارد کنید</DialogDescription>
            </DialogHeader>
            {renderAppointmentForm('add')}
          </DialogContent>
        </Dialog>

        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>ویرایش نوبت</DialogTitle>
              <DialogDescription>ویرایش اطلاعات نوبت</DialogDescription>
            </DialogHeader>
            {renderAppointmentForm('edit')}
          </DialogContent>
        </Dialog>
      </div>

      {(formError && !isAddDialogOpen && !isEditDialogOpen) && (
        <p className="text-sm text-destructive">{formError}</p>
      )}

      {actionMessage && (
        <p className="text-sm text-primary">{actionMessage}</p>
      )}

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
        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calendar">تقویم</TabsTrigger>
            <TabsTrigger value="list">لیست</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <PersianCalendar
                  viewDate={calendarViewDate}
                  selectedDate={currentDate}
                  onViewDateChange={setCalendarViewDate}
                  onSelectDate={(date) => {
                    setCurrentDate(date)
                    setCalendarViewDate(date)
                  }}
                  appointmentCounts={appointmentCounts}
                />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h2 className="font-semibold">
                نوبت‌های {formatPersianDate(currentDate, 'd MMMM')}
              </h2>
              {filteredAppointments.length > 0 ? (
                filteredAppointments.map((appointment, index) =>
                  renderAppointmentCard(appointment, index)
                )
              ) : (
                <Card className="p-12 text-center">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">نوبتی برای این روز ثبت نشده است</p>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            {filteredAppointments.length > 0 ? (
              filteredAppointments.map((appointment, index) =>
                renderAppointmentCard(appointment, index)
              )
            ) : (
              <Card className="p-12 text-center">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">نوبتی برای این روز ثبت نشده است</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </motion.div>
  )
}
