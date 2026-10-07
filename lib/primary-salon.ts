import { prisma } from './db'

const primarySalonSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  settings: true,
} as const

/**
 * Single-salon public surface (`/`, `/blog`, hero/blog API aliases).
 * Prefer the managed salon (ownerId set) so CMS uploads match the homepage;
 * fall back to oldest active salon when none is owned.
 */
export async function getPrimarySalon() {
  const managed = await prisma.salon.findFirst({
    where: { isActive: true, ownerId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: primarySalonSelect,
  })
  if (managed) return managed

  return prisma.salon.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: primarySalonSelect,
  })
}

export async function getPrimarySalonSlug(): Promise<string | null> {
  const salon = await getPrimarySalon()
  return salon?.slug ?? null
}
