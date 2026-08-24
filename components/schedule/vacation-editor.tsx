'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { CalendarOff, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SalonVacation {
  id: string
  startDate: string
  endDate: string
}

interface StaffVacation {
  id: string
  startDate: string
  endDate: string
  staffId: string
  staff?: {
    user: { firstName: string; lastName: string }
  }
}

interface StaffOption {
  id: string
  user: { firstName: string; lastName: string }
}

interface VacationEditorProps {
  canManageSalon?: boolean
  staffOptions?: StaffOption[]
  ownStaffId?: string | null
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'خطا در دریافت مرخصی‌ها')
  return data
}

function formatDateInput(value: string) {
  return value.split('T')[0]
}

function formatDisplayDate(value: string) {
  return new Date(value).toLocaleDateString('fa-IR')
}

export function VacationEditor({
  canManageSalon = false,
  staffOptions = [],
  ownStaffId = null,
}: VacationEditorProps) {
  const { data, error, isLoading, mutate } = useSWR<{
    salonVacations: SalonVacation[]
    staffVacations: StaffVacation[]
  }>('/api/dashboard/vacations', fetcher)

  const [scope, setScope] = useState<'salon' | 'staff'>(canManageSalon ? 'salon' : 'staff')
  const [staffId, setStaffId] = useState(ownStaffId ?? '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleCreate = async () => {
    if (!startDate || !endDate) {
      toast.error('تاریخ شروع و پایان را وارد کنید')
      return
    }
    if (scope === 'staff' && canManageSalon && !staffId) {
      toast.error('پرسنل را انتخاب کنید')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/dashboard/vacations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scope,
          staffId: scope === 'staff' ? staffId : undefined,
          startDate,
          endDate,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'خطا در ثبت مرخصی')
        return
      }
      toast.success('مرخصی ثبت شد')
      setStartDate('')
      setEndDate('')
      await mutate()
    } catch {
      toast.error('خطا در برقراری ارتباط با سرور')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/vacations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'خطا در حذف')
        return
      }
      toast.success('مرخصی حذف شد')
      await mutate()
    } catch {
      toast.error('خطا در برقراری ارتباط با سرور')
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return <p className="text-destructive text-sm">{error.message}</p>
  }

  const salonVacations = data?.salonVacations ?? []
  const staffVacations = data?.staffVacations ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarOff className="w-5 h-5" />
          مرخصی و تعطیلات
        </CardTitle>
        <CardDescription>
          در این بازه‌ها رزرو آنلاین برای سالن یا پرسنل غیرفعال می‌شود
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {canManageSalon && (
            <div className="space-y-2">
              <Label>نوع مرخصی</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as 'salon' | 'staff')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salon">تعطیلی کل سالن</SelectItem>
                  <SelectItem value="staff">مرخصی پرسنل</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === 'staff' && canManageSalon && staffOptions.length > 0 && (
            <div className="space-y-2">
              <Label>پرسنل</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب پرسنل" />
                </SelectTrigger>
                <SelectContent>
                  {staffOptions.map((staff) => (
                    <SelectItem key={staff.id} value={staff.id}>
                      {staff.user.firstName} {staff.user.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>از تاریخ</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>تا تاریخ</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleCreate} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Plus className="w-4 h-4 ml-2" />}
            ثبت مرخصی
          </Button>
        </div>

        {canManageSalon && salonVacations.length > 0 && (
          <div className="space-y-2">
            <Label>تعطیلات سالن</Label>
            <ul className="space-y-2">
              {salonVacations.map((vacation) => (
                <li
                  key={vacation.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>
                    {formatDisplayDate(vacation.startDate)} — {formatDisplayDate(vacation.endDate)}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(vacation.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {staffVacations.length > 0 && (
          <div className="space-y-2">
            <Label>مرخصی پرسنل</Label>
            <ul className="space-y-2">
              {staffVacations.map((vacation) => (
                <li
                  key={vacation.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>
                    {vacation.staff
                      ? `${vacation.staff.user.firstName} ${vacation.staff.user.lastName} — `
                      : ''}
                    {formatDisplayDate(vacation.startDate)} — {formatDisplayDate(vacation.endDate)}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(vacation.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
