import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import { applyPendingUpdate } from '@/lib/appointment-approval'
import { z } from 'zod'

const managerEditSchema = z.object({
  customerId: z.string().optional(),
  staffId: z.string().optional(),
  serviceIds: z.array(z.string()).min(1).optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  customerName: z.string().min(2).optional(),
  customerPhone: z.string().min(10).optional(),
  notes: z.string().nullable().optional(),
})

const staffApprovalSchema = z.object({
  approvalAction: z.enum(['approve', 'reject']),
})

const staffStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'NO_SHOW', 'CANCELLED']),
})

const appointmentInclude = {
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
} as const

function mapResponse(appointment: {
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
    id: appointment.id,
    trackingCode: appointment.trackingCode,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    status: appointment.status,
    kind: appointment.kind,
    pendingApproval: appointment.pendingApproval,
    pendingChanges: appointment.pendingChanges,
    totalPrice: appointment.totalPrice,
    notes: appointment.notes,
    customer: appointment.customer,
    staff: {
      id: appointment.staff.id,
      name: `${appointment.staff.user.firstName ?? ''} ${appointment.staff.user.lastName ?? ''}`.trim(),
    },
    services: appointment.services.map((item) => item.service),
    createdAt: appointment.createdAt,
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        salon: { select: { id: true, ownerId: true } },
        staff: { select: { id: true, userId: true } },
        services: { select: { serviceId: true } },
      },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'نوبت یافت نشد' }, { status: 404 })
    }

    const managerSalonId = isManager(user.role)
      ? await getManagerSalonId(user.id, user.salonId)
      : null
    const isManagerOfSalon = managerSalonId === appointment.salon.id
    const isAssignedStaff = appointment.staff.userId === user.id

    if (!isManagerOfSalon && !isAssignedStaff) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const approvalValidation = staffApprovalSchema.safeParse(body)
    if (approvalValidation.success) {
      const isLunch = appointment.kind === 'LUNCH'

      if (isLunch) {
        if (!isManagerOfSalon) {
          return NextResponse.json(
            { error: 'فقط مدیر می‌تواند ناهار را تایید کند' },
            { status: 403 }
          )
        }
      } else if (!isAssignedStaff) {
        return NextResponse.json(
          { error: 'فقط پرسنل اختصاص‌یافته می‌تواند تایید کند' },
          { status: 403 }
        )
      }

      const { approvalAction } = approvalValidation.data

      if (approvalAction === 'approve') {
        const updated = await prisma.appointment.update({
          where: { id },
          data: {
            status: 'CONFIRMED',
            pendingApproval: 'NONE',
            pendingChanges: Prisma.DbNull,
          },
          include: appointmentInclude,
        })

        return NextResponse.json({
          success: true,
          appointment: mapResponse(updated),
        })
      }

      const updated = await prisma.appointment.update({
        where: { id },
        data: { status: 'CANCELLED', pendingApproval: 'NONE', pendingChanges: Prisma.DbNull },
        include: appointmentInclude,
      })

      return NextResponse.json({
        success: true,
        appointment: mapResponse(updated),
      })
    }

    const statusValidation = staffStatusSchema.safeParse(body)
    if (statusValidation.success) {
      if (!isAssignedStaff && !isManagerOfSalon) {
        return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
      }

      if (!isManagerOfSalon && appointment.status === 'PENDING') {
        return NextResponse.json(
          { error: 'ابتدا نوبت باید تایید شود' },
          { status: 400 }
        )
      }

      const updated = await prisma.appointment.update({
        where: { id },
        data: { status: statusValidation.data.status },
        include: appointmentInclude,
      })

      return NextResponse.json({
        success: true,
        appointment: mapResponse(updated),
      })
    }

    if (!isManager(user.role)) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const editValidation = managerEditSchema.safeParse(body)
    if (!editValidation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر' }, { status: 400 })
    }

    const data = editValidation.data
    const changes = {
      customerId: data.customerId,
      staffId: data.staffId,
      serviceIds: data.serviceIds,
      date: data.date,
      startTime: data.startTime,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      notes: data.notes,
    }

    const hasChanges = Object.values(changes).some(
      (value) => value !== undefined && value !== null
    )

    if (!hasChanges) {
      return NextResponse.json({ error: 'تغییری برای ذخیره وجود ندارد' }, { status: 400 })
    }

    try {
      await applyPendingUpdate(id, appointment.salon.id, changes, {
        staffId: appointment.staffId,
        customerId: appointment.customerId,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        totalPrice: appointment.totalPrice,
        date: appointment.date,
        notes: appointment.notes,
      })

      const full = await prisma.appointment.findUnique({
        where: { id },
        include: appointmentInclude,
      })

      return NextResponse.json({
        success: true,
        appointment: full ? mapResponse(full) : null,
        message: 'نوبت ویرایش شد',
      })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'خطا در ویرایش نوبت' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json({ error: 'خطا در بروزرسانی نوبت' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || !isManager(user.role)) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const { id } = await params
    const salonId = await getManagerSalonId(user.id, user.salonId)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const appointment = await prisma.appointment.findFirst({
      where: { id, salonId },
      include: { payment: { select: { status: true } } },
    })

    if (!appointment) {
      return NextResponse.json({ error: 'نوبت یافت نشد' }, { status: 404 })
    }

    if (appointment.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'نوبت انجام‌شده قابل حذف نیست' },
        { status: 400 }
      )
    }

    if (appointment.payment?.status === 'PAID') {
      await prisma.appointment.update({
        where: { id },
        data: { status: 'CANCELLED', pendingApproval: 'NONE' },
      })
      return NextResponse.json({
        success: true,
        cancelled: true,
        message: 'نوبت لغو شد',
      })
    }

    await prisma.appointment.delete({ where: { id } })

    return NextResponse.json({
      success: true,
      deleted: true,
      message: 'نوبت حذف شد',
    })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    return NextResponse.json({ error: 'خطا در حذف نوبت' }, { status: 500 })
  }
}
