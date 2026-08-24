import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import { z } from 'zod'

const updateAddonsSchema = z.object({
  addonServiceIds: z.array(z.string()),
})

export async function GET(
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
    const baseService = await prisma.service.findFirst({
      where: { id, salonId, kind: 'BASE' },
    })
    if (!baseService) {
      return NextResponse.json({ error: 'خدمت پایه یافت نشد' }, { status: 404 })
    }

    const links = await prisma.serviceAddon.findMany({
      where: { baseServiceId: id },
      include: {
        addonService: {
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
            depositAmount: true,
            isActive: true,
          },
        },
      },
    })

    const availableAddons = await prisma.service.findMany({
      where: { salonId, kind: 'ADDON', isActive: true },
      select: { id: true, name: true, price: true, duration: true, depositAmount: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      linkedAddons: links.map((l) => l.addonService),
      availableAddons,
    })
  } catch (error) {
    console.error('Service addons GET error:', error)
    return NextResponse.json({ error: 'خطا در دریافت افزونه‌ها' }, { status: 500 })
  }
}

export async function PUT(
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
    const baseService = await prisma.service.findFirst({
      where: { id, salonId, kind: 'BASE' },
    })
    if (!baseService) {
      return NextResponse.json({ error: 'خدمت پایه یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateAddonsSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر' }, { status: 400 })
    }

    const addonIds = [...new Set(validation.data.addonServiceIds)]
    if (addonIds.length > 0) {
      const addons = await prisma.service.findMany({
        where: { id: { in: addonIds }, salonId, kind: 'ADDON', isActive: true },
      })
      if (addons.length !== addonIds.length) {
        return NextResponse.json({ error: 'برخی افزونه‌ها معتبر نیستند' }, { status: 400 })
      }
    }

    await prisma.$transaction([
      prisma.serviceAddon.deleteMany({ where: { baseServiceId: id } }),
      ...addonIds.map((addonServiceId) =>
        prisma.serviceAddon.create({
          data: { baseServiceId: id, addonServiceId },
        })
      ),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Service addons PUT error:', error)
    return NextResponse.json({ error: 'خطا در ذخیره افزونه‌ها' }, { status: 500 })
  }
}
