import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import {
  buildDefaultCategories,
  createCategoryId,
  getManagerSalonId,
  getSalonCategories,
  mapLegacyCategory,
  saveSalonCategories,
} from '@/lib/salon'
import { z } from 'zod'

const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'نام دسته‌بندی باید حداقل ۲ کاراکتر باشد'),
})

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user || !isManager(user.role)) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const categories = await getSalonCategories(salonId)
    const services = await prisma.service.findMany({
      where: { salonId },
      select: { category: true },
    })

    const counts = services.reduce<Record<string, number>>((acc, service) => {
      acc[service.category] = (acc[service.category] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      categories: categories.map((category) => ({
        ...category,
        servicesCount: counts[category.name] || 0,
      })),
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'خطا در دریافت دسته‌بندی‌ها' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user || !isManager(user.role)) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = createCategorySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'اطلاعات نامعتبر' },
        { status: 400 }
      )
    }

    const categories = await getSalonCategories(salonId)
    const name = validation.data.name

    if (categories.some((category) => category.name === name)) {
      return NextResponse.json({ error: 'این دسته‌بندی قبلاً ثبت شده است' }, { status: 409 })
    }

    const newCategory = {
      id: createCategoryId(name),
      name,
    }

    await saveSalonCategories(salonId, [...categories, newCategory])

    return NextResponse.json({
      success: true,
      category: {
        ...newCategory,
        servicesCount: 0,
      },
    })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'خطا در افزودن دسته‌بندی' }, { status: 500 })
  }
}
