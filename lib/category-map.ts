const LEGACY_CATEGORY_MAP: Record<string, string> = {
  مانیکور: 'ناخن',
  پدیکور: 'ناخن',
  طراحی: 'ناخن',
  کاشت: 'ناخن',
  لاک: 'ناخن',
  ناخن: 'ناخن',
  مو: 'مو',
  صورت: 'پاکسازی',
  پاکسازی: 'پاکسازی',
  ماساژ: 'مو',
}

export function mapLegacyCategory(category: string): string {
  return LEGACY_CATEGORY_MAP[category] ?? category
}
