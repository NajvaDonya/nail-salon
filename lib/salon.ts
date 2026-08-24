import { prisma } from './db'
import { Prisma } from '@prisma/client'
import { mapLegacyCategory } from './category-map'

export { mapLegacyCategory } from './category-map'

export async function getManagerSalonId(
  userId: string,
  salonId: string | null | undefined
): Promise<string | null> {
  if (salonId) return salonId

  const salon = await prisma.salon.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  })

  return salon?.id ?? null
}

export interface SalonServiceCategory {
  id: string
  name: string
}

interface SalonSettings {
  serviceCategories?: SalonServiceCategory[]
}

export function parseSalonSettings(settings: unknown): SalonSettings {
  if (!settings || typeof settings !== 'object') {
    return {}
  }

  return settings as SalonSettings
}

export async function getSalonCategories(salonId: string): Promise<SalonServiceCategory[]> {
  const salon = await prisma.salon.findUnique({
    where: { id: salonId },
    select: { settings: true },
  })

  return parseSalonSettings(salon?.settings).serviceCategories ?? []
}

export async function saveSalonCategories(
  salonId: string,
  categories: SalonServiceCategory[]
): Promise<void> {
  const salon = await prisma.salon.findUnique({
    where: { id: salonId },
    select: { settings: true },
  })

  const settings = parseSalonSettings(salon?.settings)

  await prisma.salon.update({
    where: { id: salonId },
    data: {
      settings: {
        ...settings,
        serviceCategories: categories,
      } as unknown as Prisma.InputJsonValue,
    },
  })
}

export function createCategoryId(name: string): string {
  return `cat_${name.trim().replace(/\s+/g, '_')}_${Date.now().toString(36)}`
}

export const DEFAULT_SERVICE_CATEGORIES = ['ناخن', 'مو', 'پاکسازی'] as const

export function buildDefaultCategories(
  names: readonly string[] = DEFAULT_SERVICE_CATEGORIES
): SalonServiceCategory[] {
  return names.map((name) => ({
    id: `cat_${name}`,
    name,
  }))
}

export async function validateStaffSpecialties(
  salonId: string,
  specialties: string[]
): Promise<{ valid: string[] } | { error: string }> {
  const categories = await getSalonCategories(salonId)

  if (categories.length === 0) {
    return { error: 'ابتدا دسته‌بندی خدمات را در بخش خدمات تعریف کنید' }
  }

  const validNames = new Set(categories.map((category) => category.name))
  const normalized = [...new Set(specialties.map(mapLegacyCategory))]

  if (normalized.length === 0) {
    return { error: 'حداقل یک تخصص باید انتخاب شود' }
  }

  const invalid = normalized.filter((name) => !validNames.has(name))
  if (invalid.length > 0) {
    return { error: 'تخصص‌های انتخاب‌شده معتبر نیستند' }
  }

  return { valid: normalized }
}
