import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addColumn(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql)
    console.log(`Added ${label}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('Duplicate column') || message.includes('already exists')) {
      console.log(`${label} already exists`)
    } else {
      throw error
    }
  }
}

async function main() {
  await addColumn(
    'ALTER TABLE `Staff` ADD COLUMN `restMinutes` INT NOT NULL DEFAULT 0',
    'Staff.restMinutes'
  )
  await addColumn(
    'ALTER TABLE `Staff` ADD COLUMN `lunchStart` VARCHAR(191) NULL',
    'Staff.lunchStart'
  )
  await addColumn(
    'ALTER TABLE `Staff` ADD COLUMN `lunchEnd` VARCHAR(191) NULL',
    'Staff.lunchEnd'
  )
  await addColumn(
    "ALTER TABLE `Appointment` ADD COLUMN `kind` ENUM('SERVICE', 'LUNCH') NOT NULL DEFAULT 'SERVICE'",
    'Appointment.kind'
  )
}

main().finally(async () => {
  await prisma.$disconnect()
})
