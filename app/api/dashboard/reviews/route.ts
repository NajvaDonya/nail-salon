import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { resolveSalonAccess } from '@/lib/salon-access'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'لطفا وارد شوید' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const staffId = url.searchParams.get('staffId')
    const rating = url.searchParams.get('rating')

    const { salonId, staffId: specificStaffId } = await resolveSalonAccess(user)

    if (!salonId) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    const whereClause: Record<string, unknown> = {
      appointment: { salonId },
    }

    if (specificStaffId) {
      whereClause.staffId = specificStaffId
    } else if (staffId) {
      whereClause.staffId = staffId
    }

    if (rating) {
      whereClause.rating = parseInt(rating)
    }

    const reviews = await prisma.review.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
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
        appointment: {
          include: {
            services: {
              include: {
                service: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Calculate stats
    const stats = {
      total: reviews.length,
      average: reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0,
      distribution: {
        1: reviews.filter(r => r.rating === 1).length,
        2: reviews.filter(r => r.rating === 2).length,
        3: reviews.filter(r => r.rating === 3).length,
        4: reviews.filter(r => r.rating === 4).length,
        5: reviews.filter(r => r.rating === 5).length,
      },
    }

    return NextResponse.json({
      reviews: reviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        reply: review.reply,
        createdAt: review.createdAt,
        customer: review.customer,
        staff: {
          id: review.staff.id,
          name: `${review.staff.user.firstName} ${review.staff.user.lastName}`,
        },
        services: review.appointment.services.map(s => s.service.name),
      })),
      stats,
    })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت نظرات' },
      { status: 500 }
    )
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'ثبت نظر فقط از طریق حساب مشتری امکان‌پذیر است',
      useEndpoint: '/api/customer/reviews',
    },
    { status: 405 }
  )
}
