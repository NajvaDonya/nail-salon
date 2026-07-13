import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId, getSalonCategories, saveSalonCategories } from '@/lib/salon'

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
    const categories = await getSalonCategories(salonId)
    const category = categories.find((item) => item.id === id)

    if (!category) {
      return NextResponse.json({ error: 'دسته‌بندی یافت نشد' }, { status: 404 })
    }

    const servicesCount = await prisma.service.count({
      where: {
        salonId,
        category: category.name,
      },
    })

    if (servicesCount > 0) {
      return NextResponse.json(
        { error: 'این دسته‌بندی دارای خدمت است و قابل حذف نیست' },
        { status: 400 }
      )
    }

    await saveSalonCategories(
      salonId,
      categories.filter((item) => item.id !== id)
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ error: 'خطا در حذف دسته‌بندی' }, { status: 500 })
  }
}
