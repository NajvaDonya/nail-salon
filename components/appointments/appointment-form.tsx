'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CustomerPicker, type CustomerPickerValue } from '@/components/appointments/customer-picker'
import { AppointmentDatePicker } from '@/components/appointments/appointment-date-picker'
import { formatPersianPrice, formatPersianTime, formatServiceWithDuration, toDateKey } from '@/lib/jalali'
import { calculateEndTime } from '@/lib/time-utils'
import { getHoldToken, releaseHoldToken } from '@/lib/hold-token'
import { Clock, Loader2 } from 'lucide-react'

interface Service {
  id: string
  name: string
  price: number
  duration: number
}

interface StaffMember {
  id: string
  isActive?: boolean
  user: {
    firstName: string
    lastName: string
  }
}

export interface AppointmentFormValues {
  customerId: string | null
  customerName: string
  customerPhone: string
  staffId: string
  serviceIds: string[]
  appointmentDate: string
  startTime: string
  kind: 'SERVICE' | 'LUNCH'
}

interface AppointmentFormProps {
  mode: 'add' | 'edit'
  idPrefix: string
  values: AppointmentFormValues
  staff: StaffMember[]
  services: Service[]
  excludeAppointmentId?: string
  showStaffSelect?: boolean
  allowLunchBooking?: boolean
  formError?: string
  isSubmitting: boolean
  onChange: (values: AppointmentFormValues) => void
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void
}

const HOLD_API = '/api/dashboard/appointments/slots/hold'
const SLOTS_REFRESH_MS = 5000

const slotsFetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'خطا در دریافت زمان‌های خالی')
  }
  return data as {
    slots: string[]
    durationMinutes?: number
    endTime?: string
    kind?: string
  }
}

export function AppointmentForm({
  mode,
  idPrefix,
  values,
  staff,
  services,
  excludeAppointmentId,
  showStaffSelect = true,
  allowLunchBooking = true,
  formError,
  isSubmitting,
  onChange,
  onSubmit,
  onCancel,
}: AppointmentFormProps) {
  const holdToken = useMemo(() => getHoldToken(), [])
  const [holdError, setHoldError] = useState('')
  const holdingRef = useRef(false)

  const customerValue: CustomerPickerValue = {
    customerId: values.customerId,
    customerName: values.customerName,
    customerPhone: values.customerPhone,
  }

  const toggleService = (serviceId: string) => {
    onChange({
      ...values,
      serviceIds: values.serviceIds.includes(serviceId)
        ? values.serviceIds.filter((id) => id !== serviceId)
        : [...values.serviceIds, serviceId],
      startTime: '',
    })
  }

  const activeStaff = staff.filter((member) => member.isActive !== false)

  const selectedStaffMember = activeStaff.find((member) => member.id === values.staffId)

  const isLunch = allowLunchBooking && values.kind === 'LUNCH'
  const [isHoldingSlot, setIsHoldingSlot] = useState(false)

  useEffect(() => {
    if (!allowLunchBooking && values.kind === 'LUNCH') {
      onChange({ ...values, kind: 'SERVICE', startTime: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowLunchBooking, values.kind])

  const selectedDurationMinutes = useMemo(() => {
    if (isLunch) return 0
    return values.serviceIds.reduce((total, serviceId) => {
      const service = services.find((item) => item.id === serviceId)
      return total + (service?.duration ?? 0)
    }, 0)
  }, [isLunch, values.serviceIds, services])

  const canLoadSlots =
    values.appointmentDate &&
    (showStaffSelect ? Boolean(values.staffId) : true) &&
    (isLunch || values.serviceIds.length > 0)

  const slotsQuery = useMemo(() => {
    const hasStaff = showStaffSelect ? Boolean(values.staffId) : true
    if (!hasStaff || !values.appointmentDate || !canLoadSlots) {
      return null
    }

    const params = new URLSearchParams({
      date: values.appointmentDate,
    })

    if (isLunch) {
      params.set('kind', 'LUNCH')
    } else {
      params.set('serviceIds', values.serviceIds.join(','))
    }

    if (showStaffSelect && values.staffId) {
      params.set('staffId', values.staffId)
    }

    if (excludeAppointmentId) {
      params.set('excludeAppointmentId', excludeAppointmentId)
    }

    if (holdToken) {
      params.set('holdToken', holdToken)
    }

    return `/api/dashboard/appointments/slots?${params.toString()}`
  }, [
    excludeAppointmentId,
    holdToken,
    showStaffSelect,
    values.appointmentDate,
    values.serviceIds,
    values.staffId,
    values.kind,
  ])

  const { data: slotsData, isLoading: slotsLoading, error: slotsError, mutate: refreshSlots } = useSWR(
    slotsQuery,
    slotsFetcher,
    { refreshInterval: canLoadSlots ? SLOTS_REFRESH_MS : 0 }
  )

  const availableSlots = slotsData?.slots ?? []
  const durationMinutes = slotsData?.durationMinutes ?? selectedDurationMinutes

  useEffect(() => {
    if (!values.startTime || !canLoadSlots || holdingRef.current) return

    let cancelled = false

    const reserveSlot = async () => {
      holdingRef.current = true
      setIsHoldingSlot(true)
      setHoldError('')

      try {
        const res = await fetch(HOLD_API, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            holdToken,
            date: values.appointmentDate,
            startTime: values.startTime,
            kind: values.kind,
            ...(isLunch ? {} : { serviceIds: values.serviceIds }),
            ...(showStaffSelect && values.staffId ? { staffId: values.staffId } : {}),
          }),
        })

        if (cancelled) return

        if (!res.ok) {
          const data = await res.json()
          setHoldError(data.error || 'این زمان دیگر در دسترس نیست')
          onChange({ ...values, startTime: '' })
          await refreshSlots()
        }
      } catch {
        if (!cancelled) {
          setHoldError('خطا در رزرو موقت زمان')
        }
      } finally {
        holdingRef.current = false
        if (!cancelled) setIsHoldingSlot(false)
      }
    }

    reserveSlot()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.startTime, values.staffId, values.serviceIds.join(','), values.appointmentDate, values.kind, holdToken, canLoadSlots])

  useEffect(() => {
    if (values.startTime || !holdToken) return
    void releaseHoldToken(holdToken, HOLD_API)
  }, [values.startTime, holdToken])

  useEffect(() => {
    return () => {
      void releaseHoldToken(holdToken, HOLD_API)
    }
  }, [holdToken])

  useEffect(() => {
    if (slotsLoading || !canLoadSlots) return

    if (availableSlots.length === 0) {
      if (values.startTime !== '') {
        onChange({ ...values, startTime: '' })
      }
      return
    }

    if (!values.startTime || !availableSlots.includes(values.startTime)) {
      const nextTime = availableSlots[0]
      if (values.startTime !== nextTime) {
        onChange({ ...values, startTime: nextTime })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSlots.join(','), slotsLoading, canLoadSlots, values.staffId, values.serviceIds.join(',')])

  const handleCancel = () => {
    void releaseHoldToken(holdToken, HOLD_API)
    onCancel()
  }

  const computedEndTime = useMemo(() => {
    if (!values.startTime) return null
    if (isLunch) {
      return slotsData?.endTime ?? null
    }
    if (durationMinutes <= 0) return null
    return calculateEndTime(values.startTime, durationMinutes)
  }, [values.startTime, isLunch, slotsData?.endTime, durationMinutes])

  const staffRequired = showStaffSelect
  const canSubmit =
    !isSubmitting &&
    !isHoldingSlot &&
    !holdError &&
    (isLunch || services.length > 0) &&
    (!staffRequired || activeStaff.length > 0) &&
    (isLunch || Boolean(values.customerName.trim())) &&
    (isLunch || values.customerPhone.replace(/\D/g, '').length === 11) &&
    (isLunch || values.serviceIds.length > 0) &&
    (!staffRequired || Boolean(values.staffId)) &&
    Boolean(values.appointmentDate) &&
    Boolean(values.startTime) &&
    Boolean(computedEndTime)

  const submitDisabled = !canSubmit

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label>نوع نوبت</Label>
        {allowLunchBooking ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant={!isLunch ? 'default' : 'outline'}
            onClick={() =>
              onChange({ ...values, kind: 'SERVICE', startTime: '', serviceIds: [] })
            }
          >
            خدمت
          </Button>
          <Button
            type="button"
            variant={isLunch ? 'default' : 'outline'}
            onClick={() =>
              onChange({
                ...values,
                kind: 'LUNCH',
                startTime: '',
                serviceIds: [],
                customerId: null,
                customerName: '',
                customerPhone: '',
              })
            }
          >
            ناهار / استراحت
          </Button>
        </div>
        ) : (
          <p className="text-sm text-muted-foreground">خدمت مشتری</p>
        )}
        {isLunch && (
          <p className="text-xs text-muted-foreground">
            ناهار نیاز به تایید دارد (برای پرسنل: در انتظار تایید مدیر)
          </p>
        )}
      </div>

      {!isLunch && (
        <CustomerPicker
          idPrefix={`${idPrefix}-customer`}
          value={customerValue}
          onChange={(customer) =>
            onChange({
              ...values,
              customerId: customer.customerId,
              customerName: customer.customerName,
              customerPhone: customer.customerPhone,
            })
          }
        />
      )}

      <AppointmentDatePicker
        idPrefix={`${idPrefix}-date`}
        value={values.appointmentDate}
        onChange={(appointmentDate) =>
          onChange({ ...values, appointmentDate, startTime: '' })
        }
      />

      {showStaffSelect && (
        <div className="space-y-2">
          <Label>پرسنل *</Label>
          <Select
            value={
              values.staffId && activeStaff.some((member) => member.id === values.staffId)
                ? values.staffId
                : undefined
            }
            onValueChange={(staffId) => onChange({ ...values, staffId, startTime: '' })}
          >
            <SelectTrigger>
              <SelectValue placeholder="انتخاب پرسنل فعال" />
            </SelectTrigger>
            <SelectContent>
              {activeStaff.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.user.firstName} {member.user.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!isLunch && (
      <div className="space-y-2">
        <Label>خدمات *</Label>
        {services.length === 0 ? (
          <p className="text-sm text-destructive">ابتدا خدمت تعریف کنید</p>
        ) : (
          <div className="rounded-lg border p-3 space-y-2 max-h-40 overflow-y-auto">
            {services.map((service) => (
              <label
                key={service.id}
                className="flex items-center gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/50"
              >
                <Checkbox
                  checked={values.serviceIds.includes(service.id)}
                  onCheckedChange={() => toggleService(service.id)}
                />
                <span className="text-sm flex-1">
                  {formatServiceWithDuration(service.name, service.duration)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatPersianPrice(service.price)}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      )}

      <div className="space-y-2">
        <Label>
          ساعت شروع *
          {selectedStaffMember && (
            <span className="font-normal text-muted-foreground mr-2">
              ({selectedStaffMember.user.firstName} {selectedStaffMember.user.lastName})
            </span>
          )}
        </Label>
        {!canLoadSlots ? (
          <p className="text-sm text-muted-foreground">
            {showStaffSelect && !values.staffId
              ? 'ابتدا پرسنل را انتخاب کنید'
              : isLunch
                ? 'تاریخ را انتخاب کنید'
                : 'ابتدا حداقل یک خدمت انتخاب کنید'}
          </p>
        ) : slotsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            در حال بارگذاری زمان‌های خالی...
          </div>
        ) : slotsError ? (
          <p className="text-sm text-destructive">{slotsError.message}</p>
        ) : availableSlots.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
            {selectedStaffMember
              ? `در این روز زمان خالی برای ${selectedStaffMember.user.firstName} ${selectedStaffMember.user.lastName} وجود ندارد`
              : 'در این روز زمان خالی وجود ندارد'}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {availableSlots.map((time) => (
              <Button
                key={time}
                type="button"
                variant={values.startTime === time ? 'default' : 'outline'}
                className="h-10"
                onClick={() => onChange({ ...values, startTime: time })}
              >
                {formatPersianTime(time)}
              </Button>
            ))}
          </div>
        )}
        {holdError && <p className="text-sm text-destructive">{holdError}</p>}
        {values.startTime && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">شروع</span>
              <span className="font-medium" dir="ltr">
                {formatPersianTime(values.startTime)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">پایان (محاسبه‌شده)</span>
              <span className="font-medium" dir="ltr">
                {computedEndTime ? formatPersianTime(computedEndTime) : '—'}
              </span>
            </div>
            {!isLunch && durationMinutes > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                مدت خدمات: {durationMinutes} دقیقه
              </p>
            )}
            {values.startTime && !computedEndTime && (
              <p className="text-xs text-destructive pt-1">
                {isLunch
                  ? 'بازه ناهار پرسنل تنظیم نشده — ابتدا در برنامه کاری تنظیم کنید'
                  : 'در حال محاسبه زمان پایان...'}
              </p>
            )}
          </div>
        )}
      </div>

      {mode === 'edit' && (
        <p className="text-xs text-muted-foreground">تغییرات بلافاصله ذخیره می‌شود</p>
      )}

      {formError && <p className="text-sm text-destructive text-center">{formError}</p>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={handleCancel}>
          انصراف
        </Button>
        <Button type="submit" disabled={submitDisabled}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              در حال ذخیره...
            </>
          ) : mode === 'add' ? (
            isLunch ? 'ثبت درخواست ناهار' : 'ثبت نوبت'
          ) : (
            'ذخیره تغییرات'
          )}
        </Button>
      </div>
    </form>
  )
}

export const emptyAppointmentForm: AppointmentFormValues = {
  customerId: null,
  customerName: '',
  customerPhone: '',
  staffId: '',
  serviceIds: [],
  appointmentDate: toDateKey(new Date()),
  startTime: '',
  kind: 'SERVICE',
}

export { getHoldToken }
