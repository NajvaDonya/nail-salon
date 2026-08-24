import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { resolveSalonAccess } from '@/lib/salon-access'

const createVacationSchema = z
  .object({
    scope: z.enum(['salon', 'staff']),
    staffId: z.string().optional(),
    startDate: z.string(),
    endDate: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.scope === 'staff' && !data.staffId) {
      ctx.addIssue({ code: 'custom', message: 'پرسنل الزامی است' })
    }
    if (data.startDate > data.endDate) {
      ctx.addIssue({ code: 'custom', message: 'تاریخ پایان باید بعد از شروع باشد' })
    }
  })

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    const { salonId, staffId: ownStaffId } = await resolveSalonAccess(user)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const [salonVacations, staffVacations] = await Promise.all([
      isManager(user.role)
        ? prisma.vacation.findMany({
            where: { salonId },
            orderBy: { startDate: 'asc' },
          })
        : Promise.resolve([]),
      prisma.staffVacation.findMany({
        where: ownStaffId
          ? { staffId: ownStaffId }
          : { staff: { salonId } },
        include: {
          staff: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { startDate: 'asc' },
      }),
    ])

    return NextResponse.json({ salonVacations, staffVacations })
  } catch (error) {
    console.error('Vacation list error:', error)
    return NextResponse.json({ error: 'خطا در دریافت مرخصی‌ها' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    const { salonId, staffId: ownStaffId } = await resolveSalonAccess(user)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = createVacationSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات نامعتبر', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { scope, staffId, startDate, endDate } = validation.data
    const start = new Date(`${startDate.split('T')[0]}T00:00:00`)
    const end = new Date(`${endDate.split('T')[0]}T00:00:00`)

    if (scope === 'salon') {
      if (!isManager(user.role)) {
        return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
      }

      const vacation = await prisma.vacation.create({
        data: { salonId, startDate: start, endDate: end },
      })
      return NextResponse.json({ success: true, vacation })
    }

    const targetStaffId = user.role === 'STAFF' ? ownStaffId : staffId
    if (!targetStaffId) {
      return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 400 })
    }

    if (user.role === 'STAFF' && targetStaffId !== ownStaffId) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const staff = await prisma.staff.findFirst({
      where: { id: targetStaffId, salonId },
    })
    if (!staff) {
      return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 })
    }

    const vacation = await prisma.staffVacation.create({
      data: { staffId: targetStaffId, startDate: start, endDate: end },
    })

    return NextResponse.json({ success: true, vacation })
  } catch (error) {
    console.error('Vacation create error:', error)
    return NextResponse.json({ error: 'خطا در ثبت مرخصی' }, { status: 500 })
  }
}
