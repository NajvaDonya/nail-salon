'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PERSIAN_CALENDAR_WEEKDAYS,
  englishToPersian,
  formatPersianDate,
  getNextMonth,
  getPersianCalendarGrid,
  getPreviousMonth,
  isSamePersianMonth,
  toDateKey,
} from '@/lib/jalali'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { isSameDay, isToday } from 'date-fns-jalali'

interface PersianCalendarProps {
  viewDate: Date
  selectedDate: Date
  onViewDateChange: (date: Date) => void
  onSelectDate: (date: Date) => void
  appointmentCounts?: Record<string, number>
  minDate?: Date
  maxDate?: Date
}

export function PersianCalendar({
  viewDate,
  selectedDate,
  onViewDateChange,
  onSelectDate,
  appointmentCounts = {},
  minDate,
  maxDate,
}: PersianCalendarProps) {
  const days = useMemo(() => getPersianCalendarGrid(viewDate), [viewDate])
  const minDateKey = minDate ? toDateKey(minDate) : null
  const maxDateKey = maxDate ? toDateKey(maxDate) : null

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => onViewDateChange(getPreviousMonth(viewDate))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="text-center">
          <p className="font-bold text-lg">{formatPersianDate(viewDate, 'MMMM yyyy')}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => onViewDateChange(getNextMonth(viewDate))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1" dir="rtl">
        {PERSIAN_CALENDAR_WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}

        {days.map((day) => {
          const key = toDateKey(day)
          const count = appointmentCounts[key] ?? 0
          const inMonth = isSamePersianMonth(day, viewDate)
          const selected = isSameDay(day, selectedDate)
          const today = isToday(day)
          const disabled =
            (minDateKey ? key < minDateKey : false) || (maxDateKey ? key > maxDateKey : false)

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelectDate(day)}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-lg p-2 min-h-[52px] transition-colors',
                inMonth ? 'text-foreground' : 'text-muted-foreground/50',
                disabled && 'opacity-40 cursor-not-allowed',
                selected && 'bg-primary text-primary-foreground',
                !selected && today && 'ring-2 ring-primary/40',
                !selected && !disabled && 'hover:bg-muted'
              )}
            >
              <span className="text-sm font-semibold">{englishToPersian(formatPersianDate(day, 'd'))}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'mt-1 text-[10px] rounded-full px-1.5 py-0.5',
                    selected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary'
                  )}
                >
                  {englishToPersian(count.toString())}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
