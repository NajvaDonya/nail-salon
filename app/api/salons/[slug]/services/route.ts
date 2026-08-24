import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    
    const salon = await prisma.salon.findUnique({
      where: { slug },
      include: {
        services: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            price: true,
            duration: true,
            depositAmount: true,
            category: true,
            kind: true,
            allowQuantity: true,
            maxQuantity: true,
          },
        },
      },
    })

    if (!salon) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    return NextResponse.json({ services: salon.services })
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت خدمات' },
      { status: 500 }
    )
  }
}
