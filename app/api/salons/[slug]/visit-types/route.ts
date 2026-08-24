import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const visitTypes = await prisma.visitType.findMany({
      where: { salonId: salon.id, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        description: true,
        behavior: true,
      },
    })

    return NextResponse.json({ visitTypes })
  } catch (error) {
    console.error('Public visit types error:', error)
    return NextResponse.json({ error: 'خطا در دریافت انواع مراجعه' }, { status: 500 })
  }
}
