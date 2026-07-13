'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface StaffBreakFormValues {
  restMinutes: number
  lunchStart: string
  lunchEnd: string
}

interface StaffBreakSettingsEditorProps {
  values: StaffBreakFormValues
  onChange: (values: StaffBreakFormValues) => void
}

export function StaffBreakSettingsEditor({ values, onChange }: StaffBreakSettingsEditorProps) {
  return (
    <div className="space-y-4 rounded-lg border p-4" dir="rtl">
      <div>
        <h3 className="font-medium text-sm">استراحت و ناهار من</h3>
        <p className="text-xs text-muted-foreground mt-1">
          هر پرسنل زمان استراحت بین مشتریان و بازه ناهار خود را شخصاً تنظیم می‌کند
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rest-minutes">استراحت بین مشتریان (دقیقه)</Label>
        <Input
          id="rest-minutes"
          type="number"
          min={0}
          max={120}
          className="w-32"
          dir="ltr"
          value={values.restMinutes}
          onChange={(e) =>
            onChange({ ...values, restMinutes: Math.max(0, parseInt(e.target.value) || 0) })
          }
        />
        <p className="text-xs text-muted-foreground">
          مثال: خدمت ۲ ساعته از ۹ → نوبت بعدی از ۱۱ به‌علاوه این زمان
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lunch-start">شروع ناهار</Label>
          <Input
            id="lunch-start"
            type="time"
            dir="ltr"
            value={values.lunchStart}
            onChange={(e) => onChange({ ...values, lunchStart: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lunch-end">پایان ناهار</Label>
          <Input
            id="lunch-end"
            type="time"
            dir="ltr"
            value={values.lunchEnd}
            onChange={(e) => onChange({ ...values, lunchEnd: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}

export const emptyStaffBreakForm: StaffBreakFormValues = {
  restMinutes: 0,
  lunchStart: '',
  lunchEnd: '',
}
