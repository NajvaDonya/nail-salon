export interface SalonAppearance {
  hue: number
  welcomeBadge: string
  welcomeSubtitle: string
  showCharacter: boolean
}

export const DEFAULT_SALON_APPEARANCE: SalonAppearance = {
  hue: 300,
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

function normalizeHue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  if (rounded < 0 || rounded > 360) return null
  return rounded === 360 ? 0 : rounded
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

/**
 * Build the full booking-page CSS variable palette from a single hue (0–360).
 * Mirrors the OKLCH lightness/chroma patterns of the former fixed presets.
 */
export function buildThemeVarsFromHue(hue: number): Record<string, string> {
  const h = wrapHue(hue)
  const h2 = wrapHue(h + 50)
  const hBanner2 = wrapHue(h + 10)
  const hBanner3 = wrapHue(h + 30)

  return {
    '--salon-bg-1': `oklch(0.94 0.04 ${h})`,
    '--salon-bg-2': `oklch(0.97 0.02 ${h2})`,
    '--salon-bg-3': 'oklch(0.96 0.03 85)',
    '--salon-banner-1': `oklch(0.55 0.18 ${h})`,
    '--salon-banner-2': `oklch(0.62 0.16 ${hBanner2})`,
    '--salon-banner-3': `oklch(0.68 0.14 ${hBanner3})`,
    '--salon-text': `oklch(0.35 0.12 ${h})`,
    '--salon-text-muted': `oklch(0.45 0.08 ${h} / 0.8)`,
    '--salon-accent': `oklch(0.62 0.2 ${h2})`,
    '--salon-card-border': `oklch(0.92 0.03 ${h} / 0.6)`,
  }
}

export function parseSalonAppearance(raw: unknown): SalonAppearance {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SALON_APPEARANCE }
  }

  const value = raw as Record<string, unknown>

  return {
    hue: resolveHueFromAppearance(value),
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
  return buildThemeVarsFromHue(appearance.hue)
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
