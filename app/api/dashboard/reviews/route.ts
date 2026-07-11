import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const createReviewSchema = z.object({
  appointmentId: z.string(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional(),
})

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

    // Get user's salon
    let salonId: string | null = null
    let specificStaffId: string | null = null

    if (user.role === 'MANAGER') {
      const salon = await prisma.salon.findFirst({
        where: { ownerId: user.id },
        select: { id: true },
      })
      salonId = salon?.id || null
    } else if (user.role === 'STAFF') {
      const staff = await prisma.staff.findFirst({
        where: { userId: user.id },
        select: { id: true, salonId: true },
      })
      salonId = staff?.salonId || null
      specificStaffId = staff?.id || null
    }

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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validation = createReviewSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات نامعتبر', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { appointmentId, rating, comment } = validation.data

    // Get appointment details
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        customerId: true,
        staffId: true,
        status: true,
      },
    })

    if (!appointment) {
      return NextResponse.json(
        { error: 'نوبت یافت نشد' },
        { status: 404 }
      )
    }

    if (appointment.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'فقط برای نوبت‌های انجام شده می‌توانید نظر ثبت کنید' },
        { status: 400 }
      )
    }

    // Check if review already exists
    const existingReview = await prisma.review.findFirst({
      where: { appointmentId },
    })

    if (existingReview) {
      return NextResponse.json(
        { error: 'قبلا برای این نوبت نظر ثبت شده است' },
        { status: 400 }
      )
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        appointmentId,
        customerId: appointment.customerId,
        staffId: appointment.staffId,
        rating,
        comment,
      },
    })

    return NextResponse.json({
      success: true,
      review,
    })
  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json(
      { error: 'خطا در ثبت نظر' },
      { status: 500 }
    )
  }
}
