import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import { z } from 'zod'

const updateVisitTypeSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  behavior: z.enum(['GENERAL', 'FIRST_TIME', 'RETURNING', 'PREFERRED_STAFF']).optional(),
  isActive: z.boolean().optional(),
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
    const existing = await prisma.visitType.findFirst({ where: { id, salonId } })
    if (!existing) {
      return NextResponse.json({ error: 'نوع مراجعه یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateVisitTypeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر' }, { status: 400 })
    }

    const visitType = await prisma.visitType.update({
      where: { id },
      data: validation.data,
    })

    return NextResponse.json({ success: true, visitType })
  } catch (error) {
    console.error('Visit type update error:', error)
    return NextResponse.json({ error: 'خطا در بروزرسانی' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
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
    const existing = await prisma.visitType.findFirst({ where: { id, salonId } })
    if (!existing) {
      return NextResponse.json({ error: 'نوع مراجعه یافت نشد' }, { status: 404 })
    }

    await prisma.visitType.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Visit type delete error:', error)
    return NextResponse.json({ error: 'خطا در حذف' }, { status: 500 })
  }
}
