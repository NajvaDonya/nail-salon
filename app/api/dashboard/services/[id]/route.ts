import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId, getSalonCategories } from '@/lib/salon'
import { z } from 'zod'

const updateServiceSchema = z.object({
  name: z.string().min(2),
  price: z.number().min(0),
  duration: z.number().min(5),
  depositAmount: z.number().min(0).optional(),
  categoryId: z.string().min(1),
  kind: z.enum(['BASE', 'ADDON']).optional(),
  allowQuantity: z.boolean().optional(),
  maxQuantity: z.number().int().min(1).nullable().optional(),
})

function isServiceInUse(counts: { appointmentServices: number; staffServices: number }) {
  return counts.appointmentServices > 0 || counts.staffServices > 0
}

async function getOwnedService(serviceId: string, salonId: string) {
  return prisma.service.findFirst({
    where: { id: serviceId, salonId },
    include: {
      _count: {
        select: {
          appointmentServices: true,
          staffServices: true,
        },
      },
    },
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()

    if (!user || !isManager(user.role)) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const { id } = await params
    const service = await getOwnedService(id, salonId)

    if (!service) {
      return NextResponse.json({ error: 'خدمت یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateServiceSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات نامعتبر', details: validation.error.errors },
        { status: 400 }
      )
    }

    const categories = await getSalonCategories(salonId)
    const category = categories.find((item) => item.id === validation.data.categoryId)

    if (!category) {
      return NextResponse.json(
        { error: 'دسته‌بندی انتخاب‌شده معتبر نیست' },
        { status: 400 }
      )
    }

    const updated = await prisma.service.update({
      where: { id },
      data: {
        name: validation.data.name,
        price: validation.data.price,
        duration: validation.data.duration,
        depositAmount: validation.data.depositAmount ?? service.depositAmount,
        kind: validation.data.kind ?? service.kind,
        allowQuantity: validation.data.allowQuantity ?? service.allowQuantity,
        maxQuantity:
          validation.data.maxQuantity === null
            ? null
            : validation.data.maxQuantity ?? service.maxQuantity,
        category: category.name,
      },
    })

    return NextResponse.json({
      success: true,
      service: {
        id: updated.id,
        name: updated.name,
        price: updated.price,
        discountPrice: updated.discountPrice,
        duration: updated.duration,
        depositAmount: updated.depositAmount,
        kind: updated.kind,
        allowQuantity: updated.allowQuantity,
        maxQuantity: updated.maxQuantity,
        categoryId: category.id,
        category: category.name,
        isActive: updated.isActive,
        appointmentCount: service._count.appointmentServices,
        staffCount: service._count.staffServices,
        isInUse: isServiceInUse(service._count),
      },
    })
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json({ error: 'خطا در ویرایش خدمت' }, { status: 500 })
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

    const salonId = await getManagerSalonId(user.id, user.salonId)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const { id } = await params
    const service = await getOwnedService(id, salonId)

    if (!service) {
      return NextResponse.json({ error: 'خدمت یافت نشد' }, { status: 404 })
    }

    if (isServiceInUse(service._count)) {
      return NextResponse.json(
        { error: 'این خدمت در نوبت یا پرسنل استفاده شده و قابل حذف نیست' },
        { status: 400 }
      )
    }

    await prisma.service.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json({ error: 'خطا در حذف خدمت' }, { status: 500 })
  }
}
