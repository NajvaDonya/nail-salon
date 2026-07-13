import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE \`SlotHold\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`salonId\` VARCHAR(191) NOT NULL,
        \`staffId\` VARCHAR(191) NOT NULL,
        \`date\` DATE NOT NULL,
        \`startTime\` VARCHAR(191) NOT NULL,
        \`endTime\` VARCHAR(191) NOT NULL,
        \`holdToken\` VARCHAR(191) NOT NULL,
        \`expiresAt\` DATETIME(3) NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`SlotHold_staffId_date_startTime_key\`(\`staffId\`, \`date\`, \`startTime\`),
        INDEX \`SlotHold_holdToken_idx\`(\`holdToken\`),
        INDEX \`SlotHold_expiresAt_idx\`(\`expiresAt\`),
        CONSTRAINT \`SlotHold_salonId_fkey\` FOREIGN KEY (\`salonId\`) REFERENCES \`Salon\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`SlotHold_staffId_fkey\` FOREIGN KEY (\`staffId\`) REFERENCES \`Staff\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `)
    console.log('Created SlotHold table')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('already exists')) {
      console.log('SlotHold table already exists')
    } else {
      throw error
    }
  }
}

main().finally(async () => {
  await prisma.$disconnect()
})
