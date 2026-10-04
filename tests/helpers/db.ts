// Side-effect import, and it must stay first: ES modules evaluate in import order, so this
// calls loadTestEnv() before @/lib/db constructs PrismaClient and reads DATABASE_URL.
import './load-env'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { WEEK_DAYS } from '@/lib/schedule'
import { computePaymentExpiresAt } from '@/lib/appointment-cleanup'
import {
  DEFAULT_PAYMENT_EXPIRATION_MINUTES,
  type SalonPaymentInfo,
} from '@/lib/salon-settings'
import type { Appointment, Payment, Prisma, Salon, Service, Staff, User } from '@prisma/client'
import { ensureManagerStaffProfile } from '@/lib/manager-staff'

export const MANAGER_PASSWORD = 'test1234'

/**
 * Every table declared in prisma/schema.prisma, children before parents.
 * `_prisma_migrations` is deliberately excluded. No model uses @@map, so the MySQL table
 * names are the model names verbatim.
 */
export const ALL_TABLES = [
  'SmsLog',
  'Review',
  'AppointmentService',
  'Payment',
  'Appointment',
  'SlotHold',
  'StaffVacation',
  'Vacation',
  'StaffWorkingHour',
  'WorkingHour',
  'StaffService',
  'ServiceAddon',
  'Service',
  'VisitType',
  'Staff',
  'OtpCode',
  'User',
  'Salon',
] as const

/** Wipes every table. FK checks are disabled so TRUNCATE works regardless of order. */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0')
  try {
    for (const table of ALL_TABLES) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``)
    }
  } finally {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1')
  }
}

export const TEST_SALON_PAYMENT: SalonPaymentInfo = {
  bankCardNumber: '6037000000000000',
  bankAccountOwner: 'تست سالن',
  paymentPhone: '09120000000',
  telegramReceiptUrl: 'https://t.me/TestSalon',
  paymentExpirationMinutes: DEFAULT_PAYMENT_EXPIRATION_MINUTES,
}

export interface SalonSettingsSeed {
  allowOnlineBooking: boolean
  requireConfirmation: boolean
  maxAdvanceBookingDays: number
  sendReminders: boolean
  reminderHours: number
  payment: SalonPaymentInfo
}

export const TEST_SALON_SETTINGS: SalonSettingsSeed = {
  allowOnlineBooking: true,
  requireConfirmation: false,
  maxAdvanceBookingDays: 30,
  sendReminders: true,
  reminderHours: 24,
  payment: TEST_SALON_PAYMENT,
}

export interface SeedSalonOverrides {
  name?: string
  slug?: string
  phone?: string
  city?: string
  isActive?: boolean
  settings?: SalonSettingsSeed
}

export async function seedSalon(overrides: SeedSalonOverrides = {}): Promise<Salon> {
  const { settings, ...rest } = overrides

  return prisma.salon.create({
    data: {
      name: 'سالن تست',
      slug: 'test-salon',
      phone: '02100000000',
      city: 'تهران',
      isActive: true,
      ...rest,
      settings: { ...TEST_SALON_SETTINGS, ...settings } as unknown as Prisma.InputJsonObject,
    },
  })
}

/** Phones must be unique, so every seeded user gets its own suffix. */
let phoneCounter = 0
function nextPhone(): string {
  phoneCounter += 1
  return `0912${String(1_000_000 + phoneCounter).slice(-7)}`
}

export interface SeedUserOverrides {
  phone?: string
  email?: string
  firstName?: string
  lastName?: string
  name?: string
  isActive?: boolean
}

export async function seedManager(
  salonId: string,
  overrides: SeedUserOverrides = {}
): Promise<User> {
  return prisma.user.create({
    data: {
      phone: nextPhone(),
      firstName: 'مدیر',
      lastName: 'تست',
      name: 'مدیر تست',
      role: 'MANAGER',
      salonId,
      passwordHash: await hashPassword(MANAGER_PASSWORD),
      isActive: true,
      ...overrides,
    },
  })
}

export interface SeededManagerStaff {
  manager: User
  staff: Staff
  service: Service
}

/** Manager (MANAGER role) with a bookable Staff profile, hours, and one linked service. */
export async function seedManagerWithStaffProfile(
  salonId: string,
  options: {
    serviceName?: string
    duration?: number
    depositAmount?: number
    staffActive?: boolean
  } = {}
): Promise<SeededManagerStaff> {
  const manager = await seedManager(salonId)

  for (const dayOfWeek of WEEK_DAYS) {
    await prisma.workingHour.upsert({
      where: { salonId_dayOfWeek: { salonId, dayOfWeek } },
      update: { openTime: '09:00', closeTime: '21:00', isClosed: false },
      create: {
        salonId,
        dayOfWeek,
        openTime: '09:00',
        closeTime: '21:00',
        isClosed: false,
      },
    })
  }

  const service = await prisma.service.create({
    data: {
      salonId,
      name: options.serviceName ?? 'خدمت مدیر',
      duration: options.duration ?? 60,
      price: 400_000,
      depositAmount: options.depositAmount ?? 80_000,
      category: 'ناخن',
      bufferTime: 0,
      kind: 'BASE',
      isActive: true,
    },
  })

  const staff = await ensureManagerStaffProfile(manager.id, salonId, {
    specialties: ['مدیریت'],
    serviceIds: [service.id],
    isActive: options.staffActive ?? true,
    syncWorkingHoursFromSalon: true,
  })

  return { manager, staff, service }
}

export async function seedCustomer(overrides: SeedUserOverrides = {}): Promise<User> {
  return prisma.user.create({
    data: {
      phone: nextPhone(),
      firstName: 'مشتری',
      lastName: 'تست',
      name: 'مشتری تست',
      role: 'CUSTOMER',
      isActive: true,
      ...overrides,
    },
  })
}

export interface SeededStaffWithService {
  staffUser: User
  staff: Staff
  service: Service
}

/**
 * Creates a bookable staff member: salon hours and staff hours for all seven days plus a
 * service linked to that staff, so getAvailableSlots() returns slots.
 */
export async function seedStaffWithService(
  salonId: string,
  options: {
    serviceName?: string
    duration?: number
    price?: number
    depositAmount?: number
    openTime?: string
    closeTime?: string
  } = {}
): Promise<SeededStaffWithService> {
  const openTime = options.openTime ?? '09:00'
  const closeTime = options.closeTime ?? '21:00'

  const staffUser = await prisma.user.create({
    data: {
      phone: nextPhone(),
      firstName: 'آرایشگر',
      lastName: 'تست',
      name: 'آرایشگر تست',
      role: 'STAFF',
      salonId,
      isActive: true,
    },
  })

  const staff = await prisma.staff.create({
    data: {
      userId: staffUser.id,
      salonId,
      isActive: true,
      restMinutes: 0,
    },
  })

  const service = await prisma.service.create({
    data: {
      salonId,
      name: options.serviceName ?? 'کاشت ناخن',
      duration: options.duration ?? 60,
      price: options.price ?? 500_000,
      depositAmount: options.depositAmount ?? 100_000,
      category: 'ناخن',
      bufferTime: 0,
      kind: 'BASE',
      isActive: true,
    },
  })

  await prisma.staffService.create({
    data: { staffId: staff.id, serviceId: service.id },
  })

  for (const dayOfWeek of WEEK_DAYS) {
    await prisma.workingHour.upsert({
      where: { salonId_dayOfWeek: { salonId, dayOfWeek } },
      update: { openTime, closeTime, isClosed: false },
      create: { salonId, dayOfWeek, openTime, closeTime, isClosed: false },
    })

    await prisma.staffWorkingHour.create({
      data: { staffId: staff.id, dayOfWeek, startTime: openTime, endTime: closeTime, isOff: false },
    })
  }

  return { staffUser, staff, service }
}

export interface SeedAwaitingPaymentInput {
  salonId: string
  customerId: string
  staffId: string
  serviceId: string
  /** Calendar day of the booking. Defaults to today. */
  date?: Date
  startTime?: Date
  durationMinutes?: number
  totalPrice?: number
  depositAmount?: number
  expirationMinutes?: number
  /** Row creation time, i.e. the pre-submission countdown start. */
  createdAt?: Date
  paymentStatus?: Payment['status']
  paymentSubmittedAt?: Date | null
}

export interface SeededAwaitingPaymentAppointment {
  appointment: Appointment
  payment: Payment
}

function atMidnight(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

/** A booking parked in AWAITING_PAYMENT with its PENDING card-to-card Payment row. */
export async function seedAwaitingPaymentAppointment(
  input: SeedAwaitingPaymentInput
): Promise<SeededAwaitingPaymentAppointment> {
  const createdAt = input.createdAt ?? new Date()
  const date = atMidnight(input.date ?? createdAt)

  const startTime = input.startTime ?? new Date(date.getTime() + 10 * 60 * 60 * 1000)
  const durationMinutes = input.durationMinutes ?? 60
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)

  const totalPrice = input.totalPrice ?? 500_000
  const depositAmount = input.depositAmount ?? 100_000
  const expirationMinutes = input.expirationMinutes ?? DEFAULT_PAYMENT_EXPIRATION_MINUTES
  const paymentStatus = input.paymentStatus ?? 'PENDING'
  const paymentSubmittedAt = input.paymentSubmittedAt ?? null

  const service = await prisma.service.findUniqueOrThrow({
    where: { id: input.serviceId },
  })

  const appointment = await prisma.appointment.create({
    data: {
      salonId: input.salonId,
      customerId: input.customerId,
      staffId: input.staffId,
      date,
      startTime,
      endTime,
      totalPrice,
      depositAmount,
      balanceDue: totalPrice - depositAmount,
      status: 'AWAITING_PAYMENT',
      kind: 'SERVICE',
      createdAt,
      services: {
        create: {
          serviceId: service.id,
          serviceName: service.name,
          price: service.price,
          finalPrice: service.discountPrice ?? service.price,
          duration: service.duration,
          bufferTime: service.bufferTime,
          depositAmount: service.depositAmount,
          quantity: 1,
        },
      },
    },
  })

  const payment = await prisma.payment.create({
    data: {
      appointmentId: appointment.id,
      amount: depositAmount,
      status: paymentStatus,
      createdAt,
      expirationMinutes,
      paymentSubmittedAt,
      paymentExpiresAt: paymentSubmittedAt
        ? computePaymentExpiresAt(paymentSubmittedAt, expirationMinutes)
        : null,
    },
  })

  return { appointment, payment }
}

export { prisma }
