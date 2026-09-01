export interface SalonAppearance {
  hue: number
  colorIntensity: number
  welcomeBadge: string
  welcomeSubtitle: string
  showCharacter: boolean
}

export const DEFAULT_COLOR_INTENSITY = 50

export const DEFAULT_SALON_APPEARANCE: SalonAppearance = {
  hue: 300,
  colorIntensity: DEFAULT_COLOR_INTENSITY,
  welcomeBadge: 'خوش آمدید به فیر سالن',
  welcomeSubtitle: 'تاریخ، خدمات و زمان دلخواهت رو انتخاب کن — ما آماده‌ایم ناخن‌هات رو بدرخشونیم!',
  showCharacter: true,
}

/** Legacy preset theme → hue mapping for backward compatibility */
const LEGACY_THEME_HUE: Record<string, number> = {
  violet: 300,
  rose: 15,
  teal: 190,
  amber: 75,
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeHue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  if (rounded < 0 || rounded > 360) return null
  return rounded === 360 ? 0 : rounded
}

export function normalizeColorIntensity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_COLOR_INTENSITY
  }
  return clamp(Math.round(value), 0, 100)
}

export function resolveHueFromAppearance(raw: unknown): number {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_SALON_APPEARANCE.hue
  }

  const value = raw as Record<string, unknown>
  const fromHue = normalizeHue(value.hue)
  if (fromHue !== null) return fromHue

  if (typeof value.theme === 'string' && value.theme in LEGACY_THEME_HUE) {
    return LEGACY_THEME_HUE[value.theme]
  }

  return DEFAULT_SALON_APPEARANCE.hue
}

function wrapHue(hue: number): number {
  const normalized = ((hue % 360) + 360) % 360
  return normalized
}

function intensityFactor(colorIntensity: number): number {
  return (normalizeColorIntensity(colorIntensity) - DEFAULT_COLOR_INTENSITY) / DEFAULT_COLOR_INTENSITY
}

function adjustLightness(base: number, delta: number, factor: number): number {
  return clamp(base - factor * delta, 0, 1)
}

function adjustChroma(base: number, delta: number, factor: number): number {
  return clamp(base + factor * delta, 0, 0.26)
}

function oklch(l: number, c: number, h: number, alpha?: number): string {
  const lStr = l.toFixed(2).replace(/\.?0+$/, '')
  const cStr = c.toFixed(2).replace(/\.?0+$/, '')
  if (alpha !== undefined) {
    return `oklch(${lStr} ${cStr} ${h} / ${alpha})`
  }
  return `oklch(${lStr} ${cStr} ${h})`
}

/**
 * Build the full booking-page CSS variable palette from hue (0–360) and intensity (0–100).
 * Intensity 50 matches the original fixed preset lightness/chroma values.
 */
export function buildThemeVarsFromHue(
  hue: number,
  colorIntensity = DEFAULT_COLOR_INTENSITY
): Record<string, string> {
  const h = wrapHue(hue)
  const h2 = wrapHue(h + 50)
  const hBanner2 = wrapHue(h + 10)
  const hBanner3 = wrapHue(h + 30)
  const factor = intensityFactor(colorIntensity)

  return {
    '--salon-bg-1': oklch(adjustLightness(0.94, 0.06, factor), adjustChroma(0.04, 0.03, factor), h),
    '--salon-bg-2': oklch(adjustLightness(0.97, 0.05, factor), adjustChroma(0.02, 0.02, factor), h2),
    '--salon-bg-3': oklch(adjustLightness(0.96, 0.04, factor), adjustChroma(0.03, 0.02, factor), 85),
    '--salon-banner-1': oklch(adjustLightness(0.55, 0.15, factor), adjustChroma(0.18, 0.08, factor), h),
    '--salon-banner-2': oklch(
      adjustLightness(0.62, 0.14, factor),
      adjustChroma(0.16, 0.07, factor),
      hBanner2
    ),
    '--salon-banner-3': oklch(
      adjustLightness(0.68, 0.12, factor),
      adjustChroma(0.14, 0.06, factor),
      hBanner3
    ),
    '--salon-text': oklch(adjustLightness(0.35, 0.08, factor), adjustChroma(0.12, 0.04, factor), h),
    '--salon-text-muted': oklch(
      adjustLightness(0.45, 0.07, factor),
      adjustChroma(0.08, 0.03, factor),
      h,
      0.8
    ),
    '--salon-accent': oklch(adjustLightness(0.62, 0.1, factor), adjustChroma(0.2, 0.06, factor), h2),
    '--salon-card-border': oklch(
      adjustLightness(0.92, 0.04, factor),
      adjustChroma(0.03, 0.02, factor),
      h,
      0.6
    ),
  }
}

export function parseSalonAppearance(raw: unknown): SalonAppearance {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SALON_APPEARANCE }
  }

  const value = raw as Record<string, unknown>

  return {
    hue: resolveHueFromAppearance(value),
    colorIntensity: normalizeColorIntensity(value.colorIntensity),
    welcomeBadge:
      typeof value.welcomeBadge === 'string' && value.welcomeBadge.trim()
        ? value.welcomeBadge.trim()
        : DEFAULT_SALON_APPEARANCE.welcomeBadge,
    welcomeSubtitle:
      typeof value.welcomeSubtitle === 'string' && value.welcomeSubtitle.trim()
        ? value.welcomeSubtitle.trim()
        : DEFAULT_SALON_APPEARANCE.welcomeSubtitle,
    showCharacter: typeof value.showCharacter === 'boolean' ? value.showCharacter : true,
  }
}

export function extractSalonAppearance(settings: unknown): SalonAppearance {
  if (!settings || typeof settings !== 'object') {
    return { ...DEFAULT_SALON_APPEARANCE }
  }

  return parseSalonAppearance((settings as Record<string, unknown>).appearance)
}

export function appearanceStyleVars(appearance: SalonAppearance): Record<string, string> {
  return buildThemeVarsFromHue(appearance.hue, appearance.colorIntensity)
}

/** Normalize appearance patch: convert legacy theme → hue, drop theme key */
export function normalizeAppearancePatch(
  patch: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...patch }

  if (normalizeHue(next.hue) === null && typeof next.theme === 'string') {
    next.hue = resolveHueFromAppearance(next)
  }

  delete next.theme

  if (typeof next.hue === 'number') {
    const hue = normalizeHue(next.hue)
    if (hue !== null) next.hue = hue
  }

  if (typeof next.colorIntensity === 'number') {
    next.colorIntensity = normalizeColorIntensity(next.colorIntensity)
  }

  return next
}

export function mergeSalonSettings(existing: unknown, incoming: unknown): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  const patch =
    incoming && typeof incoming === 'object' && !Array.isArray(incoming)
      ? (incoming as Record<string, unknown>)
      : {}

  const merged = { ...base, ...patch }

  if (patch.appearance && typeof patch.appearance === 'object') {
    const appearancePatch = normalizeAppearancePatch(
      patch.appearance as Record<string, unknown>
    )
    const baseAppearance =
      base.appearance && typeof base.appearance === 'object'
        ? normalizeAppearancePatch(base.appearance as Record<string, unknown>)
        : {}

    merged.appearance = {
      ...baseAppearance,
      ...appearancePatch,
    }
  }

  return merged
}
