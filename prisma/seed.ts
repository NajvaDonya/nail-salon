import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const managerPassword = await bcrypt.hash('manager123', 10)
  const staffPassword = await bcrypt.hash('staff123', 10)

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

  const staffUser = await prisma.user.upsert({
    where: { phone: '09122222222' },
    update: {},
    create: {
      phone: '09122222222',
      name: 'طراح ناخن',
      passwordHash: staffPassword,
      role: 'STAFF',
      salonId: salon.id,
      isActive: true,
      firstName: 'Sara',
      lastName: 'Designer',
    },
  })

  const staff = await prisma.staff.upsert({
    where: {
      userId_salonId: { userId: staffUser.id, salonId: salon.id },
    },
    update: {},
    create: {
      userId: staffUser.id,
      salonId: salon.id,
      specialties: ['طراحی ناخن', 'مانیکور', 'پدیکور'],
      isActive: true,
    },
  })

  console.log('Created manager:', manager.name, '- Phone: 09121111111, Password: manager123')
  console.log('Created staff:', staffUser.name, '- Phone: 09122222222, Password: staff123')

  const services = [
    { name: 'مانیکور ساده', duration: 30, price: 150000, category: 'مانیکور' },
    { name: 'پدیکور ساده', duration: 45, price: 200000, category: 'پدیکور' },
    { name: 'طراحی ناخن', duration: 60, price: 300000, category: 'طراحی' },
    { name: 'کاشت ناخن ژل', duration: 90, price: 500000, category: 'کاشت' },
    { name: 'لاک ژل', duration: 45, price: 250000, category: 'لاک' },
  ]

  for (const service of services) {
    await prisma.service.upsert({
      where: {
        salonId_name: { salonId: salon.id, name: service.name },
      },
      update: {},
      create: {
        salonId: salon.id,
        name: service.name,
        duration: service.duration,
        price: service.price,
        category: service.category,
        isActive: true,
      },
    })
  }

  console.log('Created', services.length, 'services')

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

    await prisma.staffWorkingHour.upsert({
      where: {
        staffId_dayOfWeek: { staffId: staff.id, dayOfWeek: day },
      },
      update: {},
      create: {
        staffId: staff.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        isOff: false,
      },
    })
  }

  console.log('Created salon and staff working hours')

  const allServices = await prisma.service.findMany({ where: { salonId: salon.id } })
  for (const service of allServices) {
    await prisma.staffService.upsert({
      where: {
        staffId_serviceId: { staffId: staff.id, serviceId: service.id },
      },
      update: {},
      create: {
        staffId: staff.id,
        serviceId: service.id,
      },
    })
  }

  console.log('Linked staff to all services')

  console.log('\n========================================')
  console.log('Seed completed successfully!')
  console.log('========================================')
  console.log('\nTest Credentials:')
  console.log('----------------------------------------')
  console.log('MANAGER:')
  console.log('  Phone: 09121111111')
  console.log('  Password: manager123')
  console.log('----------------------------------------')
  console.log('NAIL ARTIST (Staff):')
  console.log('  Phone: 09122222222')
  console.log('  Password: staff123')
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
