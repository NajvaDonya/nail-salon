import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const WEEK_DAYS = [
  'SATURDAY',
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
] as const

function dateTime(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0)
}

function endTime(start: string, durationMinutes: number): string {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + durationMinutes
  const eh = Math.floor(total / 60)
  const em = total % 60
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
}

const CUSTOMERS = [
  { firstName: 'مریم', lastName: 'احمدی', phone: '09121234501' },
  { firstName: 'سارا', lastName: 'رضایی', phone: '09121234502' },
  { firstName: 'فاطمه', lastName: 'کریمی', phone: '09121234503' },
  { firstName: 'زهرا', lastName: 'موسوی', phone: '09121234504' },
  { firstName: 'نرگس', lastName: 'حسینی', phone: '09121234505' },
  { firstName: 'الهام', lastName: 'جعفری', phone: '09121234506' },
  { firstName: 'پریسا', lastName: 'محمدی', phone: '09121234507' },
  { firstName: 'آتوسا', lastName: 'علوی', phone: '09121234508' },
  { firstName: 'شیما', lastName: 'نوری', phone: '09121234509' },
  { firstName: 'راحیل', lastName: 'صادقی', phone: '09121234510' },
]

// date, startTime, customer index, status
const SLOTS: Array<{
  date: string
  startTime: string
  customerIndex: number
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
}> = [
  { date: '2026-07-13', startTime: '09:00', customerIndex: 0, status: 'COMPLETED' },
  { date: '2026-07-13', startTime: '11:15', customerIndex: 1, status: 'COMPLETED' },
  { date: '2026-07-13', startTime: '14:00', customerIndex: 2, status: 'COMPLETED' },
  { date: '2026-07-14', startTime: '09:00', customerIndex: 3, status: 'COMPLETED' },
  { date: '2026-07-14', startTime: '11:15', customerIndex: 4, status: 'COMPLETED' },
  { date: '2026-07-14', startTime: '14:00', customerIndex: 5, status: 'CONFIRMED' },
  { date: '2026-07-15', startTime: '09:00', customerIndex: 6, status: 'CONFIRMED' },
  { date: '2026-07-15', startTime: '11:15', customerIndex: 7, status: 'CONFIRMED' },
  { date: '2026-07-16', startTime: '09:00', customerIndex: 8, status: 'CONFIRMED' },
  { date: '2026-07-16', startTime: '14:00', customerIndex: 9, status: 'CONFIRMED' },
  { date: '2026-07-17', startTime: '09:00', customerIndex: 0, status: 'CONFIRMED' },
  { date: '2026-07-17', startTime: '11:15', customerIndex: 1, status: 'CONFIRMED' },
  { date: '2026-07-20', startTime: '09:00', customerIndex: 2, status: 'CONFIRMED' },
  { date: '2026-07-20', startTime: '14:00', customerIndex: 3, status: 'PENDING' },
  { date: '2026-07-21', startTime: '09:00', customerIndex: 4, status: 'CONFIRMED' },
]

async function main() {
  const staff = await prisma.staff.findFirst({
    where: {
      user: { firstName: 'دنیا', lastName: 'نجوی' },
    },
    include: { user: true },
  })

  if (!staff) {
    throw new Error('پرسنل «دنیا نجوی» یافت نشد')
  }

  const salonId = staff.salonId
  const service = await prisma.service.findFirst({
    where: { salonId, isActive: true },
    orderBy: { name: 'asc' },
  })

  if (!service) {
    throw new Error('خدمتی در سالن یافت نشد')
  }

  await prisma.staffService.upsert({
    where: { staffId_serviceId: { staffId: staff.id, serviceId: service.id } },
    update: {},
    create: { staffId: staff.id, serviceId: service.id },
  })

  await prisma.staff.update({
    where: { id: staff.id },
    data: {
      restMinutes: 15,
      lunchStart: '12:00',
      lunchEnd: '13:00',
    },
  })

  for (const day of WEEK_DAYS) {
    const isFriday = day === 'FRIDAY'
    await prisma.staffWorkingHour.upsert({
      where: { staffId_dayOfWeek: { staffId: staff.id, dayOfWeek: day } },
      update: {
        startTime: isFriday ? '00:00' : '09:00',
        endTime: isFriday ? '00:00' : '18:00',
        isOff: isFriday,
      },
      create: {
        staffId: staff.id,
        dayOfWeek: day,
        startTime: isFriday ? '00:00' : '09:00',
        endTime: isFriday ? '00:00' : '18:00',
        isOff: isFriday,
      },
    })
  }

  const customerIds: string[] = []

  for (const customer of CUSTOMERS) {
    const user = await prisma.user.upsert({
      where: { phone: customer.phone },
      update: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        role: 'CUSTOMER',
        isActive: true,
      },
      create: {
        phone: customer.phone,
        firstName: customer.firstName,
        lastName: customer.lastName,
        name: `${customer.firstName} ${customer.lastName}`.trim(),
        role: 'CUSTOMER',
        isActive: true,
      },
    })
    customerIds.push(user.id)
  }

  const deletedReviews = await prisma.review.deleteMany({
    where: { staffId: staff.id },
  })
  if (deletedReviews.count > 0) {
    console.log(`Removed ${deletedReviews.count} old review(s) for دنیا نجوی`)
  }

  const deleted = await prisma.appointment.deleteMany({
    where: { staffId: staff.id },
  })
  console.log(`Removed ${deleted.count} old appointment(s) for دنیا نجوی`)

  let created = 0

  for (const slot of SLOTS) {
    const customerId = customerIds[slot.customerIndex]
    const end = endTime(slot.startTime, service.duration)
    const trackingCode = `SL${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`

    await prisma.appointment.create({
      data: {
        salonId,
        customerId,
        staffId: staff.id,
        date: dateTime(slot.date, '00:00'),
        startTime: dateTime(slot.date, slot.startTime),
        endTime: dateTime(slot.date, end),
        totalPrice: service.price,
        status: slot.status,
        kind: 'SERVICE',
        pendingApproval: 'NONE',
        trackingCode,
        services: {
          create: [{ serviceId: service.id }],
        },
      },
    })
    created++
  }

  console.log(`\nSeeded ${created} appointments for دنیا نجوی`)
  console.log(`Service: ${service.name} (${service.duration} min)`)
  console.log(`Rest: 15 min | Lunch: 12:00–13:00`)
  console.log(`Customers: ${CUSTOMERS.length}`)
  console.log('\nSample customers:')
  for (const c of CUSTOMERS.slice(0, 5)) {
    console.log(`  ${c.firstName} ${c.lastName} — ${c.phone}`)
  }
  console.log('  ...')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
