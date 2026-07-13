import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import { resolveAppointmentCustomer } from '@/lib/customer'
import { assertSlotHold, releaseHoldsByToken, SlotHoldError } from '@/lib/slot-hold'
import { getStaffBreakSettings, lunchDurationMinutes } from '@/lib/staff-breaks'
import { calculateEndTime } from '@/lib/time-utils'
import { z } from 'zod'
import { endOfMonth, startOfMonth } from 'date-fns-jalali'

const createAppointmentSchema = z
  .object({
    kind: z.enum(['SERVICE', 'LUNCH']).default('SERVICE'),
    serviceIds: z.array(z.string()).optional(),
    staffId: z.string().optional(),
    date: z.string(),
    startTime: z.string(),
    customerId: z.string().optional(),
    customerPhone: z.string().min(10).optional(),
    customerName: z.string().min(2).optional(),
    notes: z.string().optional(),
    holdToken: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'SERVICE') {
      if (!data.serviceIds?.length) {
        ctx.addIssue({ code: 'custom', message: 'حداقل یک خدمت انتخاب کنید' })
      }
      if (!data.customerId && !(data.customerPhone && data.customerName)) {
        ctx.addIssue({ code: 'custom', message: 'مشتری را انتخاب کنید' })
      }
    }
  })

async function resolveSalonAccess(user: { id: string; role: string; salonId?: string | null }) {
  if (user.role === 'MANAGER') {
    const salonId = await getManagerSalonId(user.id, user.salonId)
    return { salonId, staffId: null as string | null }
  }

  if (user.role === 'STAFF') {
    const staff = await prisma.staff.findFirst({
      where: { userId: user.id },
      select: { id: true, salonId: true },
    })
    return { salonId: staff?.salonId ?? null, staffId: staff?.id ?? null }
  }

  return { salonId: null, staffId: null }
}

function mapAppointment(apt: {
  id: string
  trackingCode: string | null
  startTime: Date
  endTime: Date
  status: string
  kind: string
  pendingApproval: string
  pendingChanges: unknown
  totalPrice: number
  notes: string | null
  createdAt: Date
  customer: {
    id: string
    phone: string
    firstName: string | null
    lastName: string | null
  }
  staff: {
    id: string
    user: { firstName: string | null; lastName: string | null }
  }
  services: Array<{ service: { id: string; name: string; price: number; duration: number } }>
}) {
  return {
    id: apt.id,
    trackingCode: apt.trackingCode,
    startTime: apt.startTime,
    endTime: apt.endTime,
    status: apt.status,
    kind: apt.kind,
    pendingApproval: apt.pendingApproval,
    pendingChanges: apt.pendingChanges,
    totalPrice: apt.totalPrice,
    notes: apt.notes,
    customer: apt.customer,
    staff: {
      id: apt.staff.id,
      name: `${apt.staff.user.firstName ?? ''} ${apt.staff.user.lastName ?? ''}`.trim(),
    },
    services: apt.services.map((item) => item.service),
    createdAt: apt.createdAt,
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const date = url.searchParams.get('date')
    const month = url.searchParams.get('month')
    const staffIdParam = url.searchParams.get('staffId')

    const { salonId, staffId: ownStaffId } = await resolveSalonAccess(user)

    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const whereClause: Record<string, unknown> = { salonId }

    if (ownStaffId) {
      whereClause.staffId = ownStaffId
    } else if (staffIdParam) {
      whereClause.staffId = staffIdParam
    }

    if (status) {
      whereClause.status = status
    }

    if (month) {
      const viewDate = new Date(month)
      whereClause.startTime = {
        gte: startOfMonth(viewDate),
        lte: endOfMonth(viewDate),
      }
    } else if (date) {
      const targetDate = new Date(date)
      const nextDate = new Date(targetDate)
      nextDate.setDate(nextDate.getDate() + 1)

      whereClause.startTime = {
        gte: targetDate,
        lt: nextDate,
      }
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        staff: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                price: true,
                duration: true,
              },
            },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    })

    return NextResponse.json({
      appointments: appointments.map(mapAppointment),
    })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json({ error: 'خطا در دریافت نوبت‌ها' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user || (user.role !== 'MANAGER' && user.role !== 'STAFF')) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const { salonId, staffId: ownStaffId } = await resolveSalonAccess(user)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = createAppointmentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات وارد شده نامعتبر است', details: validation.error.errors },
        { status: 400 }
      )
    }

    const {
      kind = 'SERVICE',
      serviceIds = [],
      staffId: requestedStaffId,
      date,
      startTime,
      customerId,
      customerPhone,
      customerName,
      notes,
      holdToken,
    } = validation.data

    if (kind === 'LUNCH' && user.role === 'MANAGER') {
      return NextResponse.json(
        { error: 'تنظیم و ثبت ناهار فقط توسط خود پرسنل امکان‌پذیر است' },
        { status: 403 }
      )
    }

    const staffId = user.role === 'STAFF' ? ownStaffId : requestedStaffId

    if (!staffId) {
      return NextResponse.json({ error: 'پرسنل را انتخاب کنید' }, { status: 400 })
    }

    if (user.role === 'STAFF' && staffId !== ownStaffId) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const staff = await prisma.staff.findFirst({
      where: {
        id: staffId,
        salonId,
        isActive: true,
        user: { isActive: true },
      },
      include: { user: { select: { id: true } } },
    })

    if (!staff) {
      return NextResponse.json({ error: 'پرسنل انتخاب‌شده معتبر نیست' }, { status: 400 })
    }

    const dateKey = date.split('T')[0]
    const appointmentDate = new Date(`${dateKey}T00:00:00`)
    const startDateTime = new Date(`${dateKey}T${startTime}`)

    let totalPrice = 0
    let totalDuration = 0
    let endTimeStr = ''

    if (kind === 'LUNCH') {
      const breakSettings = await getStaffBreakSettings(staffId, salonId)
      if (!breakSettings.lunch) {
        return NextResponse.json({ error: 'بازه ناهار برای این پرسنل تنظیم نشده' }, { status: 400 })
      }
      totalDuration = lunchDurationMinutes(breakSettings.lunch)
      endTimeStr = breakSettings.lunch.end
    } else {
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds }, salonId, isActive: true },
        select: { id: true, price: true, duration: true },
      })

      if (services.length !== serviceIds.length) {
        return NextResponse.json({ error: 'خدمات انتخاب‌شده معتبر نیستند' }, { status: 400 })
      }

      totalPrice = services.reduce((sum, service) => sum + service.price, 0)
      totalDuration = services.reduce((sum, service) => sum + service.duration, 0)
      endTimeStr = calculateEndTime(startTime, totalDuration)
    }

    const endDateTime = new Date(`${dateKey}T${endTimeStr}`)

    const conflict = await prisma.appointment.findFirst({
      where: {
        staffId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startTime: { lt: endDateTime },
        endTime: { gt: startDateTime },
      },
    })

    if (conflict) {
      return NextResponse.json(
        { error: 'این پرسنل در این زمان نوبت دیگری دارد' },
        { status: 409 }
      )
    }

    try {
      await assertSlotHold({
        staffId,
        date: dateKey,
        startTime,
        durationMinutes: totalDuration,
        holdToken,
      })
    } catch (error) {
      if (error instanceof SlotHoldError) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      throw error
    }

    let customer
    if (kind === 'LUNCH') {
      customer = { id: staff.user.id }
    } else {
      try {
        customer = await resolveAppointmentCustomer({
          customerId,
          customerPhone,
          customerName,
        })
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'خطا در ثبت مشتری' },
          { status: 400 }
        )
      }
    }

    const trackingCode = `SL${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`
    const appointmentStatus = kind === 'LUNCH' ? 'PENDING' : 'CONFIRMED'

    const appointment = await prisma.appointment.create({
      data: {
        salonId,
        customerId: customer.id,
        staffId,
        date: appointmentDate,
        startTime: startDateTime,
        endTime: endDateTime,
        totalPrice,
        status: appointmentStatus,
        kind,
        trackingCode,
        notes,
        ...(kind === 'SERVICE' && serviceIds.length > 0
          ? {
              services: {
                create: serviceIds.map((serviceId) => ({ serviceId })),
              },
            }
          : {}),
      },
      include: {
        customer: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        staff: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                price: true,
                duration: true,
              },
            },
          },
        },
      },
    })

    if (holdToken) {
      await releaseHoldsByToken(holdToken)
    }

    return NextResponse.json({
      success: true,
      appointment: mapAppointment(appointment),
    })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json({ error: 'خطا در ثبت نوبت' }, { status: 500 })
  }
}
