import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId, getSalonCategories } from '@/lib/salon'
import { z } from 'zod'

const createServiceSchema = z.object({
  name: z.string().min(2),
  price: z.number().min(0),
  duration: z.number().min(5),
  categoryId: z.string().min(1),
})

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user || (user.role !== 'MANAGER' && user.role !== 'STAFF')) {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }

    let salonId: string | null = null
    if (user.role === 'MANAGER') {
      salonId = await getManagerSalonId(user.id, user.salonId)
    } else {
      const staff = await prisma.staff.findFirst({
        where: { userId: user.id },
        select: { salonId: true },
      })
      salonId = staff?.salonId ?? null
    }

    if (!salonId) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    const services = await prisma.service.findMany({
      where: {
        salonId,
        ...(user.role === 'STAFF' ? { isActive: true } : {}),
      },
      include: {
        _count: {
          select: {
            appointmentServices: true,
            staffServices: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    const categories = await getSalonCategories(salonId)
    const categoryMap = new Map(categories.map((category) => [category.id, category.name]))

    return NextResponse.json({
      services: services.map(service => {
        const matchedCategory = categories.find((category) => category.name === service.category)

        return {
          id: service.id,
          name: service.name,
          price: service.price,
          discountPrice: service.discountPrice,
          duration: service.duration,
          categoryId: matchedCategory?.id ?? service.category,
          category: service.category,
          isActive: service.isActive,
          appointmentCount: service._count.appointmentServices,
          staffCount: service._count.staffServices,
          isInUse:
            service._count.appointmentServices > 0 || service._count.staffServices > 0,
        }
      }),
      categoryMap: Object.fromEntries(categoryMap),
    })
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت خدمات' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    
    if (!user || !isManager(user.role)) {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)

    if (!salonId) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = createServiceSchema.safeParse(body)

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

    const service = await prisma.service.create({
      data: {
        name: validation.data.name,
        price: validation.data.price,
        duration: validation.data.duration,
        category: category.name,
        salonId,
      },
    })

    return NextResponse.json({
      success: true,
      service: {
        id: service.id,
        name: service.name,
        price: service.price,
        discountPrice: service.discountPrice,
        duration: service.duration,
        categoryId: category.id,
        category: category.name,
        isActive: service.isActive,
      },
    })
  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json(
      { error: 'خطا در افزودن خدمت' },
      { status: 500 }
    )
  }
}
