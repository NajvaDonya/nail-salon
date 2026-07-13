'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PERSIAN_DAYS, WEEK_DAYS, type SalonHourRow, type StaffHourRow } from '@/lib/schedule'
import type { DayOfWeek } from '@/lib/types'
import { Loader2, Save } from 'lucide-react'

interface SalonHoursEditorProps {
  hours: SalonHourRow[]
  onChange: (hours: SalonHourRow[]) => void
  disabled?: boolean
}

export function SalonHoursEditor({ hours, onChange, disabled }: SalonHoursEditorProps) {
  const updateDay = (dayOfWeek: DayOfWeek, patch: Partial<SalonHourRow>) => {
    onChange(
      hours.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row))
    )
  }

  return (
    <div className="space-y-3">
      {WEEK_DAYS.map((dayOfWeek) => {
        const row = hours.find((item) => item.dayOfWeek === dayOfWeek)
        if (!row) return null

        return (
          <div
            key={dayOfWeek}
            className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr_auto] gap-3 items-center rounded-lg border p-3"
          >
            <span className="font-medium">{PERSIAN_DAYS[dayOfWeek]}</span>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">شروع</Label>
              <Input
                type="time"
                dir="ltr"
                value={row.openTime}
                disabled={disabled || row.isClosed}
                onChange={(e) => updateDay(dayOfWeek, { openTime: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">پایان</Label>
              <Input
                type="time"
                dir="ltr"
                value={row.closeTime}
                disabled={disabled || row.isClosed}
                onChange={(e) => updateDay(dayOfWeek, { closeTime: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={!row.isClosed}
                disabled={disabled}
                onCheckedChange={(checked) => updateDay(dayOfWeek, { isClosed: !checked })}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {row.isClosed ? 'تعطیل' : 'باز'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface StaffHoursEditorProps {
  hours: StaffHourRow[]
  salonHours: SalonHourRow[]
  onChange: (hours: StaffHourRow[]) => void
  disabled?: boolean
}

export function StaffHoursEditor({
  hours,
  salonHours,
  onChange,
  disabled,
}: StaffHoursEditorProps) {
  const updateDay = (dayOfWeek: DayOfWeek, patch: Partial<StaffHourRow>) => {
    onChange(
      hours.map((row) => (row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row))
    )
  }

  return (
    <div className="space-y-3">
      {WEEK_DAYS.map((dayOfWeek) => {
        const row = hours.find((item) => item.dayOfWeek === dayOfWeek)
        const salon = salonHours.find((item) => item.dayOfWeek === dayOfWeek)
        if (!row) return null

        return (
          <div
            key={dayOfWeek}
            className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr_auto] gap-3 items-center rounded-lg border p-3"
          >
            <div>
              <span className="font-medium">{PERSIAN_DAYS[dayOfWeek]}</span>
              {salon && (
                <p className="text-xs text-muted-foreground mt-1">
                  سالن: {salon.isClosed ? 'تعطیل' : `${salon.openTime} – ${salon.closeTime}`}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">شروع</Label>
              <Input
                type="time"
                dir="ltr"
                value={row.startTime}
                disabled={disabled || row.isOff}
                onChange={(e) => updateDay(dayOfWeek, { startTime: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">پایان</Label>
              <Input
                type="time"
                dir="ltr"
                value={row.endTime}
                disabled={disabled || row.isOff}
                onChange={(e) => updateDay(dayOfWeek, { endTime: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={!row.isOff}
                disabled={disabled}
                onCheckedChange={(checked) => updateDay(dayOfWeek, { isOff: !checked })}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {row.isOff ? 'مرخصی' : 'کار'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface SaveScheduleButtonProps {
  isSaving: boolean
  onClick: () => void
  label?: string
}

export function SaveScheduleButton({ isSaving, onClick, label = 'ذخیره برنامه' }: SaveScheduleButtonProps) {
  return (
    <Button onClick={onClick} disabled={isSaving}>
      {isSaving ? (
        <>
          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
          در حال ذخیره...
        </>
      ) : (
        <>
          <Save className="w-4 h-4 ml-2" />
          {label}
        </>
      )}
    </Button>
  )
}
