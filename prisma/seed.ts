import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { buildDefaultCategories } from '../lib/salon'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const managerPassword = await bcrypt.hash('manager123', 10)

  const manager = await prisma.user.upsert({
    where: { phone: '09121111111' },
    update: {},
    create: {
      phone: '09121111111',
      name: 'مدیر سالن',
      passwordHash: managerPassword,
      role: 'MANAGER',
      isActive: true,
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
    },
  })

  const salon = await prisma.salon.upsert({
    where: { slug: 'nail-art-studio' },
    update: { ownerId: manager.id },
    create: {
      name: 'استودیو ناخن هنری',
      slug: 'nail-art-studio',
      description: 'بهترین سالن ناخن در تهران',
      phone: '09121234567',
      address: 'تهران، خیابان ولیعصر',
      isActive: true,
      ownerId: manager.id,
    },
  })

  await prisma.user.update({
    where: { id: manager.id },
    data: { salonId: salon.id },
  })

  console.log('Created salon:', salon.name)
  console.log('Created manager:', manager.name, '- Phone: 09121111111, Password: manager123')

  const categoryNames = buildDefaultCategories()

  await prisma.salon.update({
    where: { id: salon.id },
    data: {
      settings: {
        serviceCategories: categoryNames,
      },
    },
  })

  console.log('Created default categories')

  const days = ['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']

  for (const day of days) {
    await prisma.workingHour.upsert({
      where: {
        salonId_dayOfWeek: { salonId: salon.id, dayOfWeek: day },
      },
      update: {},
      create: {
        salonId: salon.id,
        dayOfWeek: day,
        openTime: '09:00',
        closeTime: '18:00',
        isClosed: false,
      },
    })
  }

  console.log('Created salon working hours')
  console.log('Seed completed successfully!')
  console.log('========================================')
  console.log('\nTest Credentials:')
  console.log('----------------------------------------')
  console.log('MANAGER:')
  console.log('  Phone: 09121111111')
  console.log('  Password: manager123')
  console.log('----------------------------------------')
  console.log('\nSalon URL: /salon/nail-art-studio/book')
  console.log('========================================\n')
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
