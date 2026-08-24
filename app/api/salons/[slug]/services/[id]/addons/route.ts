import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params
    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const baseService = await prisma.service.findFirst({
      where: { id, salonId: salon.id, kind: 'BASE', isActive: true },
    })
    if (!baseService) {
      return NextResponse.json({ error: 'خدمت یافت نشد' }, { status: 404 })
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
            allowQuantity: true,
            maxQuantity: true,
          },
        },
      },
    })

    const addons = links
      .map((l) => l.addonService)
      .filter((s) => s !== null)

    return NextResponse.json({ addons })
  } catch (error) {
    console.error('Public service addons error:', error)
    return NextResponse.json({ error: 'خطا در دریافت افزونه‌ها' }, { status: 500 })
  }
}
