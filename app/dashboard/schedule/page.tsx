'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  SalonHoursEditor,
  SaveScheduleButton,
} from '@/components/schedule/working-hours-editor'
import { VacationEditor } from '@/components/schedule/vacation-editor'
import type { SalonHourRow } from '@/lib/schedule'
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
}

export default function DashboardSchedulePage() {
  const [salonHours, setSalonHours] = useState<SalonHourRow[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const { data, error, isLoading, mutate } = useSWR<ScheduleResponse>(
    '/api/dashboard/schedule',
    fetcher
  )

  const { data: staffData } = useSWR<{
    staff: { id: string; user: { firstName: string; lastName: string } }[]
  }>('/api/dashboard/staff', fetcher)

  useEffect(() => {
    if (data?.salonHours) setSalonHours(data.salonHours)
  }, [data])

  const staffOptions = staffData?.staff ?? []

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/dashboard/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scope: 'salon', salonHours }),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'خطا در ذخیره')
        return
      }
      toast.success(result.message || 'برنامه سالن ذخیره شد')
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">برنامه کاری سالن</h1>
        <p className="text-muted-foreground">
          ساعات کلی باز بودن سالن. زمان ناهار و استراحت هر پرسنل فقط توسط خودش در
          {' '}
          <span className="font-medium">برنامه کاری من</span>
          {' '}
          تنظیم می‌شود.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            ساعات باز بودن سالن
          </CardTitle>
          <CardDescription>مرجع ساعات کلی سالن برای رزرو آنلاین</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SalonHoursEditor hours={salonHours} onChange={setSalonHours} />
          <div className="flex justify-end">
            <SaveScheduleButton isSaving={isSaving} onClick={handleSave} label="ذخیره برنامه سالن" />
          </div>
        </CardContent>
      </Card>

      <VacationEditor canManageSalon staffOptions={staffOptions} />
    </motion.div>
  )
}
