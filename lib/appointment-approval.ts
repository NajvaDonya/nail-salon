import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { resolveAppointmentCustomer } from '@/lib/customer'
import {
  buildDateTimes,
  parsePendingChanges,
  type PendingAppointmentChanges,
} from '@/lib/appointment-pending'

export async function checkStaffConflict(
  staffId: string,
  startTime: Date,
  endTime: Date,
  excludeAppointmentId?: string
) {
  return prisma.appointment.findFirst({
    where: {
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      staffId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      pendingApproval: { not: 'DELETE' },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  })
}

export async function applyPendingUpdate(
  appointmentId: string,
  salonId: string,
  changes: PendingAppointmentChanges,
  current: {
    staffId: string
    customerId: string
    startTime: Date
    endTime: Date
    totalPrice: number
    date: Date
    notes: string | null
  }
) {
  const staffId = changes.staffId ?? current.staffId

  if (changes.staffId) {
    const staff = await prisma.staff.findFirst({
      where: {
        id: changes.staffId,
        salonId,
        isActive: true,
        user: { isActive: true },
      },
    })
    if (!staff) {
      throw new Error('پرسنل انتخاب‌شده فعال نیست')
    }
  }

  let serviceIds: string[] | undefined = changes.serviceIds
  let totalPrice = current.totalPrice
  let totalDuration =
    (current.endTime.getTime() - current.startTime.getTime()) / 60000

  if (serviceIds) {
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, salonId, isActive: true },
      select: { id: true, price: true, duration: true },
    })
    if (services.length !== serviceIds.length) {
      throw new Error('خدمات انتخاب‌شده معتبر نیستند')
    }
    totalPrice = services.reduce((sum, service) => sum + service.price, 0)
    totalDuration = services.reduce((sum, service) => sum + service.duration, 0)
  }

  const dateKey = changes.date
    ? changes.date.split('T')[0]
    : current.startTime.toISOString().split('T')[0]
  const startTimeStr = changes.startTime
    ? changes.startTime
    : `${String(current.startTime.getHours()).padStart(2, '0')}:${String(current.startTime.getMinutes()).padStart(2, '0')}`

  const { appointmentDate, startDateTime, endDateTime } = buildDateTimes(
    dateKey,
    startTimeStr,
    totalDuration
  )

  const conflict = await checkStaffConflict(staffId, startDateTime, endDateTime, appointmentId)
  if (conflict) {
    throw new Error('پرسنل در زمان جدید نوبت دیگری دارد')
  }

  let customerId = current.customerId
  if (changes.customerId) {
    const customer = await prisma.user.findFirst({
      where: { id: changes.customerId, role: 'CUSTOMER' },
    })
    if (!customer) {
      throw new Error('مشتری انتخاب‌شده یافت نشد')
    }
    customerId = customer.id
    if (changes.customerName?.trim()) {
      const nameParts = changes.customerName.trim().split(' ')
      await prisma.user.update({
        where: { id: customer.id },
        data: {
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || '',
          name: changes.customerName.trim(),
        },
      })
    }
  } else if (changes.customerPhone || changes.customerName) {
    const customer = await resolveAppointmentCustomer({
      customerPhone: changes.customerPhone,
      customerName: changes.customerName,
    })
    customerId = customer.id
  }

  if (serviceIds) {
    await prisma.appointmentService.deleteMany({ where: { appointmentId } })
    await prisma.appointmentService.createMany({
      data: serviceIds.map((serviceId) => ({ appointmentId, serviceId })),
    })
  }

  return prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      staffId,
      customerId,
      date: appointmentDate,
      startTime: startDateTime,
      endTime: endDateTime,
      totalPrice,
      notes: changes.notes !== undefined ? changes.notes : current.notes,
      status: 'CONFIRMED',
      pendingApproval: 'NONE',
      pendingChanges: Prisma.DbNull,
    },
  })
}

export { parsePendingChanges }
