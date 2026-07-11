import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'لطفا وارد شوید' },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const validation = updateStatusSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'وضعیت نامعتبر' },
        { status: 400 }
      )
    }

    // Verify user has access to this appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        salon: {
          select: { ownerId: true },
        },
        staff: {
          select: { userId: true },
        },
      },
    })

    if (!appointment) {
      return NextResponse.json(
        { error: 'نوبت یافت نشد' },
        { status: 404 }
      )
    }

    // Check authorization
    const isOwner = appointment.salon.ownerId === user.id
    const isStaff = appointment.staff.userId === user.id

    if (!isOwner && !isStaff) {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }

    // Update appointment status
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: validation.data.status,
        ...(validation.data.status === 'COMPLETED' && { completedAt: new Date() }),
        ...(validation.data.status === 'CANCELLED' && { cancelledAt: new Date() }),
      },
    })

    return NextResponse.json({
      success: true,
      appointment: updated,
    })
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json(
      { error: 'خطا در بروزرسانی نوبت' },
      { status: 500 }
    )
  }
}
