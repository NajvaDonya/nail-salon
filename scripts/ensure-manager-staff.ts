/**
 * Backfill Staff profiles for salon owners (MANAGER role). Idempotent.
 * Usage: npx tsx scripts/ensure-manager-staff.ts
 * Uses DATABASE_URL from .env (not .env.test unless DATABASE_URL is set for test).
 */
import { PrismaClient } from '@prisma/client'
import { ensureSalonOwnerStaffProfile } from '../lib/manager-staff'

const prisma = new PrismaClient()

async function main() {
  const salons = await prisma.salon.findMany({
    where: { ownerId: { not: null } },
    select: { id: true, name: true, slug: true, ownerId: true },
  })

  let created = 0
  let existing = 0
  let skipped = 0

  for (const salon of salons) {
    const before = await prisma.staff.findUnique({
      where: {
        userId_salonId: { userId: salon.ownerId!, salonId: salon.id },
      },
      select: { id: true },
    })

    const staff = await ensureSalonOwnerStaffProfile(salon.id, {
      syncWorkingHoursFromSalon: true,
    })

    if (!staff) {
      skipped += 1
      console.log(
        JSON.stringify({
          salonId: salon.id,
          slug: salon.slug,
          status: 'skipped',
          reason: 'owner not MANAGER or missing',
        })
      )
      continue
    }

    const status = before ? 'existing' : 'created'
    if (before) existing += 1
    else created += 1

    console.log(
      JSON.stringify({
        salonId: salon.id,
        slug: salon.slug,
        managerId: salon.ownerId,
        staffId: staff.id,
        status,
        isActive: staff.isActive,
      })
    )
  }

  console.log(
    JSON.stringify({ summary: { salons: salons.length, created, existing, skipped } })
  )
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
