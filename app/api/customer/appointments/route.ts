import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    const appointments = await prisma.appointment.findMany({
      where: { customerId: user.id },
      include: {
        salon: { select: { name: true, slug: true } },
        staff: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        services: {
          include: {
            service: { select: { name: true, duration: true } },
          },
        },
        payment: { select: { status: true, paidAt: true } },
        reviews: { select: { id: true, rating: true } },
      },
      orderBy: { startTime: 'desc' },
    })

    return NextResponse.json({
      appointments: appointments.map((apt) => ({
        id: apt.id,
        trackingCode: apt.trackingCode,
        status: apt.status,
        startTime: apt.startTime,
        endTime: apt.endTime,
        totalPrice: apt.totalPrice,
        depositAmount: apt.depositAmount,
        balanceDue: apt.balanceDue,
        notes: apt.notes,
        salon: apt.salon,
        staff: {
          name: `${apt.staff.user.firstName} ${apt.staff.user.lastName}`,
        },
        services: apt.services.map((s) => ({
          name: s.service.name,
          duration: s.service.duration,
        })),
        payment: apt.payment,
        hasReview: apt.reviews.length > 0,
        reviewRating: apt.reviews[0]?.rating ?? null,
      })),
    })
  } catch (error) {
    console.error('Customer appointments error:', error)
    return NextResponse.json({ error: 'خطا در دریافت نوبت‌ها' }, { status: 500 })
  }
}
