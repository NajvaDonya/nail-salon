'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  StaffHoursEditor,
  SaveScheduleButton,
} from '@/components/schedule/working-hours-editor'
import {
  StaffBreakSettingsEditor,
  emptyStaffBreakForm,
  type StaffBreakFormValues,
} from '@/components/schedule/staff-break-settings-editor'
import type { SalonHourRow, StaffHourRow } from '@/lib/schedule'
import { PERSIAN_DAYS, WEEK_DAYS } from '@/lib/schedule'
import { Clock, Loader2 } from 'lucide-react'

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'خطا در دریافت برنامه کاری')
  }
  return data
}

interface ScheduleResponse {
  salonHours: SalonHourRow[]
  staffHours: StaffHourRow[]
  staffBreak?: StaffBreakFormValues
}

export default function StaffSchedulePage() {
  const [staffHours, setStaffHours] = useState<StaffHourRow[]>([])
  const [staffBreak, setStaffBreak] = useState<StaffBreakFormValues>(emptyStaffBreakForm)
  const [isSaving, setIsSaving] = useState(false)

  const { data, error, isLoading, mutate } = useSWR<ScheduleResponse>(
    '/api/dashboard/schedule',
    fetcher
  )

  useEffect(() => {
    if (data?.staffHours) setStaffHours(data.staffHours)
    if (data?.staffBreak) setStaffBreak(data.staffBreak)
  }, [data])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/dashboard/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scope: 'staff',
          staffHours,
          staffBreak,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'خطا در ذخیره')
        return
      }
      toast.success(result.message || 'برنامه شما ذخیره شد')
      await mutate()
    } catch {
      toast.error('خطا در برقراری ارتباط با سرور')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive">{error.message}</p>
      </Card>
    )
  }

  const salonHours = data?.salonHours ?? []

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">برنامه کاری من</h1>
        <p className="text-muted-foreground">
          ساعات کاری، استراحت بین مشتریان و ناهار خود را اینجا تنظیم کنید
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ساعات سالن</CardTitle>
          <CardDescription>مرجع ساعات کلی سالن</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {WEEK_DAYS.map((day) => {
              const row = salonHours.find((item) => item.dayOfWeek === day)
              return (
                <div key={day} className="flex justify-between rounded-md border px-3 py-2">
                  <span>{PERSIAN_DAYS[day]}</span>
                  <span className="text-muted-foreground" dir="ltr">
                    {row?.isClosed ? 'تعطیل' : `${row?.openTime} – ${row?.closeTime}`}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            برنامه کاری من
          </CardTitle>
          <CardDescription>روزها و ساعاتی که برای نوبت‌دهی در دسترس هستید</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <StaffHoursEditor
            hours={staffHours}
            salonHours={salonHours}
            onChange={setStaffHours}
          />
          <StaffBreakSettingsEditor values={staffBreak} onChange={setStaffBreak} />
          <div className="flex justify-end">
            <SaveScheduleButton isSaving={isSaving} onClick={handleSave} label="ذخیره برنامه من" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
