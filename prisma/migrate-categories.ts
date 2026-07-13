import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TARGET_CATEGORIES = [
  { id: 'cat_ناخن', name: 'ناخن' },
  { id: 'cat_مو', name: 'مو' },
  { id: 'cat_پاکسازی', name: 'پاکسازی' },
] as const

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

function mapLegacyCategory(category: string): string {
  return LEGACY_CATEGORY_MAP[category] ?? 'ناخن'
}

async function main() {
  const salons = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
    SELECT id, name FROM Salon
  `

  for (const salon of salons) {
    const services = await prisma.$queryRaw<Array<{ id: string; category: string }>>`
      SELECT id, category FROM Service WHERE salonId = ${salon.id}
    `

    for (const service of services) {
      const mappedCategory = mapLegacyCategory(service.category)
      if (mappedCategory !== service.category) {
        await prisma.$executeRaw`
          UPDATE Service SET category = ${mappedCategory} WHERE id = ${service.id}
        `
      }
    }

    const settings = JSON.stringify({
      serviceCategories: TARGET_CATEGORIES,
    })

    await prisma.$executeRaw`
      UPDATE Salon SET settings = ${settings} WHERE id = ${salon.id}
    `

    console.log(`Updated salon "${salon.name}" → categories: ناخن, مو, پاکسازی`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
