import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import { z } from 'zod'

const replySchema = z.object({
  reply: z.string().min(1, 'پاسخ الزامی است'),
})

export async function PATCH(
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
    const body = await request.json()
    const validation = replySchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات نامعتبر', details: validation.error.errors },
        { status: 400 }
      )
    }

    const review = await prisma.review.findFirst({
      where: {
        id,
        appointment: { salonId },
      },
      select: { id: true },
    })

    if (!review) {
      return NextResponse.json({ error: 'نظر یافت نشد' }, { status: 404 })
    }

    const updated = await prisma.review.update({
      where: { id },
      data: { reply: validation.data.reply },
      include: {
        customer: {
          select: { firstName: true, lastName: true },
        },
        staff: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        appointment: {
          include: {
            services: {
              include: {
                service: { select: { name: true } },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      review: {
        id: updated.id,
        rating: updated.rating,
        comment: updated.comment,
        reply: updated.reply,
        createdAt: updated.createdAt,
        customer: updated.customer,
        staff: {
          id: updated.staff.id,
          name: `${updated.staff.user.firstName} ${updated.staff.user.lastName}`,
        },
        services: updated.appointment.services.map((s) => s.service.name),
      },
    })
  } catch (error) {
    console.error('Error replying to review:', error)
    return NextResponse.json({ error: 'خطا در ثبت پاسخ' }, { status: 500 })
  }
}
