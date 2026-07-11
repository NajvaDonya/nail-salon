import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const createServiceSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  price: z.number().min(0),
  duration: z.number().min(5),
  category: z.string().optional(),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user || user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }

    const salon = await prisma.salon.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    const services = await prisma.service.findMany({
      where: { salonId: salon.id },
      include: {
        _count: {
          select: {
            appointments: true,
            staff: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      services: services.map(service => ({
        id: service.id,
        name: service.name,
        description: service.description,
        price: service.price,
        duration: service.duration,
        category: service.category,
        isActive: service.isActive,
        appointmentCount: service._count.appointments,
        staffCount: service._count.staff,
      })),
    })
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت خدمات' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    
    if (!user || user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }

    const salon = await prisma.salon.findFirst({
      where: { ownerId: user.id },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = createServiceSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات نامعتبر', details: validation.error.errors },
        { status: 400 }
      )
    }

    const service = await prisma.service.create({
      data: {
        ...validation.data,
        salonId: salon.id,
      },
    })

    return NextResponse.json({
      success: true,
      service,
    })
  } catch (error) {
    console.error('Error creating service:', error)
    return NextResponse.json(
      { error: 'خطا در افزودن خدمت' },
      { status: 500 }
    )
  }
}
