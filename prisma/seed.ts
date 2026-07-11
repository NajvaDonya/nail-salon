import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create a test salon
  const salon = await prisma.salon.upsert({
    where: { slug: 'nail-art-studio' },
    update: {},
    create: {
      name: 'استودیو ناخن هنری',
      slug: 'nail-art-studio',
      description: 'بهترین سالن ناخن در تهران',
      phone: '09121234567',
      address: 'تهران، خیابان ولیعصر',
      isActive: true,
    },
  })

  console.log('Created salon:', salon.name)

  // Create Manager user
  const managerPassword = await bcrypt.hash('manager123', 10)
  const manager = await prisma.user.upsert({
    where: { phone: '09121111111' },
    update: {},
    create: {
      phone: '09121111111',
      name: 'مدیر سالن',
      passwordHash: managerPassword, // fixed: was 'password', field is now 'passwordHash'
      role: 'MANAGER',
      salonId: salon.id,
      isActive: true,
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
      avatar: null,
    },
  })

  console.log('Created manager:', manager.name, '- Phone: 09121111111, Password: manager123')

  // Create Nail Artist (Staff) user
  const staffPassword = await bcrypt.hash('staff123', 10)
  const staff = await prisma.user.upsert({
    where: { phone: '09122222222' },
    update: {},
    create: {
      phone: '09122222222',
      name: 'طراح ناخن',
      passwordHash: staffPassword, // fixed: was 'password', field is now 'passwordHash'
      role: 'STAFF',
      salonId: salon.id,
      isActive: true,
    },
  })

  console.log('Created staff:', staff.name, '- Phone: 09122222222, Password: staff123')

  // Create staff profile for the nail artist
  await prisma.staffProfile.upsert({
    where: { userId: staff.id },
    update: {},
    create: {
      userId: staff.id,
      bio: 'متخصص طراحی ناخن با ۵ سال سابقه',
      specialties: ['طراحی ناخن', 'مانیکور', 'پدیکور'],
    },
  })

  // Create sample services
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

  // Create working hours for the staff (Saturday to Thursday, 9 AM to 6 PM)
  const days = ['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY']

  for (const day of days) {
    await prisma.workingHours.upsert({
      where: {
        staffId_dayOfWeek: { staffId: staff.id, dayOfWeek: day },
      },
      update: {},
      create: {
        staffId: staff.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      },
    })
  }

  console.log('Created working hours for staff')

  // Link staff to all services
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
