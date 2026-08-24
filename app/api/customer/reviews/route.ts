import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

const reviewSchema = z.object({
  appointmentId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
})

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    const body = await request.json()
    const validation = reviewSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر است' }, { status: 400 })
    }

    const { appointmentId, rating, comment } = validation.data

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        customerId: user.id,
        status: 'COMPLETED',
      },
      include: {
        reviews: { select: { id: true } },
      },
    })

    if (!appointment) {
      return NextResponse.json(
        { error: 'نوبت تکمیل‌شده‌ای برای ثبت نظر یافت نشد' },
        { status: 404 }
      )
    }

    if (appointment.reviews.length > 0) {
      return NextResponse.json({ error: 'برای این نوبت قبلاً نظر ثبت شده است' }, { status: 409 })
    }

    const review = await prisma.review.create({
      data: {
        appointmentId: appointment.id,
        customerId: user.id,
        staffId: appointment.staffId,
        rating,
        comment: comment?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, review })
  } catch (error) {
    console.error('Customer review error:', error)
    return NextResponse.json({ error: 'خطا در ثبت نظر' }, { status: 500 })
  }
}
