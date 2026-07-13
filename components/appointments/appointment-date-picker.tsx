'use client'

import { useEffect, useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { PersianCalendar } from '@/components/dashboard/persian-calendar'
import { formatPersianDate, toDateKey } from '@/lib/jalali'

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

interface AppointmentDatePickerProps {
  value: string
  onChange: (dateKey: string) => void
  idPrefix?: string
}

export function AppointmentDatePicker({
  value,
  onChange,
  idPrefix = 'appointment',
}: AppointmentDatePickerProps) {
  const [open, setOpen] = useState(false)
  const selectedDate = value ? parseDateKey(value) : new Date()
  const [viewDate, setViewDate] = useState(selectedDate)

  useEffect(() => {
    if (value) {
      setViewDate(parseDateKey(value))
    }
  }, [value])

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-date`}>تاریخ *</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={`${idPrefix}-date`}
            type="button"
            variant="outline"
            className="w-full justify-start font-normal"
          >
            <CalendarIcon className="w-4 h-4 ml-2 shrink-0" />
            {value
              ? formatPersianDate(selectedDate, 'EEEE d MMMM yyyy')
              : 'انتخاب تاریخ'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start" dir="rtl">
          <PersianCalendar
            viewDate={viewDate}
            selectedDate={selectedDate}
            onViewDateChange={setViewDate}
            onSelectDate={(date) => {
              onChange(toDateKey(date))
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
