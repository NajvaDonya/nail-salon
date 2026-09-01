import { describe, it, expect } from 'vitest'
import {
  buildThemeVarsFromHue,
  DEFAULT_COLOR_INTENSITY,
  DEFAULT_SALON_APPEARANCE,
  normalizeColorIntensity,
  parseSalonAppearance,
  appearanceStyleVars,
} from '@/lib/salon-appearance'

describe('normalizeColorIntensity', () => {
  it('defaults invalid values to 50', () => {
    expect(normalizeColorIntensity(undefined)).toBe(50)
    expect(normalizeColorIntensity(null)).toBe(50)
    expect(normalizeColorIntensity('abc')).toBe(50)
  })

  it('clamps to 0–100', () => {
    expect(normalizeColorIntensity(-10)).toBe(0)
    expect(normalizeColorIntensity(150)).toBe(100)
    expect(normalizeColorIntensity(72.6)).toBe(73)
  })
})

describe('parseSalonAppearance', () => {
  it('defaults colorIntensity when missing', () => {
    const appearance = parseSalonAppearance({ hue: 300 })
    expect(appearance.colorIntensity).toBe(DEFAULT_COLOR_INTENSITY)
  })

  it('reads colorIntensity when set', () => {
    const appearance = parseSalonAppearance({ hue: 300, colorIntensity: 80 })
    expect(appearance.colorIntensity).toBe(80)
  })
})

describe('buildThemeVarsFromHue', () => {
  const baseline = buildThemeVarsFromHue(300, DEFAULT_COLOR_INTENSITY)

  it('matches original palette at default intensity', () => {
    expect(baseline['--salon-bg-1']).toBe('oklch(0.94 0.04 300)')
    expect(baseline['--salon-banner-1']).toBe('oklch(0.55 0.18 300)')
    expect(baseline['--salon-text']).toBe('oklch(0.35 0.12 300)')
    expect(baseline['--salon-text-muted']).toBe('oklch(0.45 0.08 300 / 0.8)')
  })

  it('darkens and saturates banners at high intensity', () => {
    const bold = buildThemeVarsFromHue(300, 100)
    expect(bold['--salon-banner-1']).toBe('oklch(0.4 0.26 300)')
    expect(bold['--salon-bg-1']).toBe('oklch(0.88 0.07 300)')
  })

  it('lightens and softens banners at low intensity', () => {
    const soft = buildThemeVarsFromHue(300, 0)
    expect(soft['--salon-banner-1']).toBe('oklch(0.7 0.1 300)')
    expect(soft['--salon-bg-1']).toBe('oklch(1 0.01 300)')
  })

  it('passes colorIntensity through appearanceStyleVars', () => {
    const appearance = {
      ...DEFAULT_SALON_APPEARANCE,
      hue: 190,
      colorIntensity: 100,
    }
    const vars = appearanceStyleVars(appearance)
    expect(vars['--salon-banner-1']).toBe('oklch(0.4 0.26 190)')
  })
})
