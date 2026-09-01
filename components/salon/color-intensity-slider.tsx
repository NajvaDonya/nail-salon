'use client'

import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { englishToPersian } from '@/lib/jalali'

interface ColorIntensitySliderProps {
  value: number
  onChange: (colorIntensity: number) => void
}

export function ColorIntensitySlider({ value, onChange }: ColorIntensitySliderProps) {
  const intensity = Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 50

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label>شدت رنگ</Label>
        <span className="text-sm text-muted-foreground tabular-nums" dir="ltr">
          {englishToPersian(String(intensity))}
        </span>
      </div>

      <div className="relative pt-1 pb-2" dir="ltr">
        <div
          className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-gradient-to-r from-violet-100 via-violet-400 to-violet-900"
          aria-hidden
        />
        <Slider
          min={0}
          max={100}
          step={1}
          value={[intensity]}
          onValueChange={(values) => {
            const next = values[0]
            if (typeof next === 'number') onChange(next)
          }}
          className="relative z-10 [&_[data-slot=slider-track]]:bg-transparent [&_[data-slot=slider-range]]:bg-transparent"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        ملایم و روشن‌تر در سمت چپ — پررنگ و تیره‌تر در سمت راست
      </p>
    </div>
  )
}
