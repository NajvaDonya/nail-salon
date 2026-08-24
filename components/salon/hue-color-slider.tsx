'use client'

import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { buildThemeVarsFromHue } from '@/lib/salon-appearance'
import { englishToPersian } from '@/lib/jalali'

interface HueColorSliderProps {
  value: number
  onChange: (hue: number) => void
}

const RAINBOW_GRADIENT =
  'linear-gradient(to right, hsl(0 90% 55%), hsl(60 90% 50%), hsl(120 80% 45%), hsl(180 80% 45%), hsl(240 80% 55%), hsl(300 80% 55%), hsl(360 90% 55%))'

export function HueColorSlider({ value, onChange }: HueColorSliderProps) {
  const hue = Number.isFinite(value) ? Math.min(360, Math.max(0, Math.round(value))) : 300
  const vars = buildThemeVarsFromHue(hue)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label>انتخاب رنگ</Label>
        <span className="text-sm text-muted-foreground tabular-nums" dir="ltr">
          {englishToPersian(String(hue))}°
        </span>
      </div>

      <div
        className="h-10 rounded-xl border shadow-inner"
        style={{
          background: `linear-gradient(135deg, ${vars['--salon-banner-1']}, ${vars['--salon-banner-2']}, ${vars['--salon-banner-3']})`,
        }}
      />

      <div className="relative pt-1 pb-2" dir="ltr">
        <div
          className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full"
          style={{ background: RAINBOW_GRADIENT }}
          aria-hidden
        />
        <Slider
          min={0}
          max={360}
          step={1}
          value={[hue]}
          onValueChange={(values) => {
            const next = values[0]
            if (typeof next === 'number') onChange(next)
          }}
          className="relative z-10 [&_[data-slot=slider-track]]:bg-transparent [&_[data-slot=slider-range]]:bg-transparent"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        با جابه‌جایی اسلایدر، رنگ صفحه رزرو مشتریان را انتخاب کنید
      </p>
    </div>
  )
}
