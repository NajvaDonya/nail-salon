import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `Appointment` ADD COLUMN `pendingApproval` ENUM('NONE', 'UPDATE', 'DELETE') NOT NULL DEFAULT 'NONE'"
    )
    console.log('Added pendingApproval column')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('Duplicate column')) {
      console.log('pendingApproval already exists')
    } else {
      throw error
    }
  }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE `Appointment` ADD COLUMN `pendingChanges` JSON NULL')
    console.log('Added pendingChanges column')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('Duplicate column')) {
      console.log('pendingChanges already exists')
    } else {
      throw error
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
