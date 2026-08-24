import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import { z } from 'zod'

const createVisitTypeSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  behavior: z.enum(['GENERAL', 'FIRST_TIME', 'RETURNING', 'PREFERRED_STAFF']).optional(),
  isActive: z.boolean().optional(),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || !isManager(user.role)) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const visitTypes = await prisma.visitType.findMany({
      where: { salonId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ visitTypes })
  } catch (error) {
    console.error('Visit types list error:', error)
    return NextResponse.json({ error: 'خطا در دریافت انواع مراجعه' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || !isManager(user.role)) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = createVisitTypeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات نامعتبر', details: validation.error.errors },
        { status: 400 }
      )
    }

    const visitType = await prisma.visitType.create({
      data: {
        salonId,
        name: validation.data.name,
        description: validation.data.description,
        sortOrder: validation.data.sortOrder ?? 0,
        behavior: validation.data.behavior ?? 'GENERAL',
        isActive: validation.data.isActive ?? true,
      },
    })

    return NextResponse.json({ success: true, visitType })
  } catch (error) {
    console.error('Visit type create error:', error)
    return NextResponse.json({ error: 'خطا در ثبت نوع مراجعه' }, { status: 500 })
  }
}
