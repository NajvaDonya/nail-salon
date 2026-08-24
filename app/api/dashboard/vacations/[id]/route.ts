import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { resolveSalonAccess } from '@/lib/salon-access'

const updateSchema = z
  .object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine((data) => data.startDate || data.endDate, {
    message: 'حداقل یک فیلد برای بروزرسانی لازم است',
  })

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    const { salonId, staffId: ownStaffId } = await resolveSalonAccess(user)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const { id } = await params
    const body = await request.json()
    const validation = updateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر' }, { status: 400 })
    }

    const salonVacation = await prisma.vacation.findFirst({ where: { id, salonId } })
    if (salonVacation) {
      if (!isManager(user.role)) {
        return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
      }
      const updated = await prisma.vacation.update({
        where: { id },
        data: {
          ...(validation.data.startDate
            ? { startDate: new Date(`${validation.data.startDate.split('T')[0]}T00:00:00`) }
            : {}),
          ...(validation.data.endDate
            ? { endDate: new Date(`${validation.data.endDate.split('T')[0]}T00:00:00`) }
            : {}),
        },
      })
      return NextResponse.json({ success: true, vacation: updated })
    }

    const staffVacation = await prisma.staffVacation.findFirst({
      where: {
        id,
        staff: user.role === 'STAFF' ? { id: ownStaffId ?? '' } : { salonId },
      },
    })

    if (!staffVacation) {
      return NextResponse.json({ error: 'مرخصی یافت نشد' }, { status: 404 })
    }

    const updated = await prisma.staffVacation.update({
      where: { id },
      data: {
        ...(validation.data.startDate
          ? { startDate: new Date(`${validation.data.startDate.split('T')[0]}T00:00:00`) }
          : {}),
        ...(validation.data.endDate
          ? { endDate: new Date(`${validation.data.endDate.split('T')[0]}T00:00:00`) }
          : {}),
      },
    })

    return NextResponse.json({ success: true, vacation: updated })
  } catch (error) {
    console.error('Vacation update error:', error)
    return NextResponse.json({ error: 'خطا در بروزرسانی مرخصی' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    const { salonId, staffId: ownStaffId } = await resolveSalonAccess(user)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const { id } = await params

    const salonVacation = await prisma.vacation.findFirst({ where: { id, salonId } })
    if (salonVacation) {
      if (!isManager(user.role)) {
        return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
      }
      await prisma.vacation.delete({ where: { id } })
      return NextResponse.json({ success: true })
    }

    const staffVacation = await prisma.staffVacation.findFirst({
      where: {
        id,
        staff: user.role === 'STAFF' ? { id: ownStaffId ?? '' } : { salonId },
      },
    })

    if (!staffVacation) {
      return NextResponse.json({ error: 'مرخصی یافت نشد' }, { status: 404 })
    }

    await prisma.staffVacation.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Vacation delete error:', error)
    return NextResponse.json({ error: 'خطا در حذف مرخصی' }, { status: 500 })
  }
}
