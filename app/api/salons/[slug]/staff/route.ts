import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const url = new URL(request.url)
    const serviceIds = url.searchParams.get('services')?.split(',').filter(Boolean) || []

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    // Find staff that can perform the selected services
    const whereClause: Record<string, unknown> = {
      salonId: salon.id,
      isActive: true,
      user: { isActive: true },
    }

    if (serviceIds.length > 0) {
      whereClause.services = {
        some: {
          serviceId: { in: serviceIds },
        },
      }
    }

    const staff = await prisma.staff.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    })

    const staffWithRating = staff.map(member => ({
      id: member.id,
      user: member.user,
      specialties: member.specialties as string[],
      averageRating: member.reviews.length > 0
        ? member.reviews.reduce((sum, r) => sum + r.rating, 0) / member.reviews.length
        : 0,
    }))

    return NextResponse.json({ staff: staffWithRating })
  } catch (error) {
    console.error('Error fetching staff:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت لیست متخصصان' },
      { status: 500 }
    )
  }
}
