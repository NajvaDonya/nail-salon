import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const createStaffSchema = z.object({
  phone: z.string().min(10),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  password: z.string().min(6).optional(),
  specialties: z.array(z.string()).optional(),
  serviceIds: z.array(z.string()).optional(),
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

    const staff = await prisma.staff.findMany({
      where: { salonId: salon.id },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        services: {
          include: {
            service: {
              select: { id: true, name: true },
            },
          },
        },
        reviews: {
          select: { rating: true },
        },
        _count: {
          select: { appointments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const staffWithStats = staff.map(member => ({
      id: member.id,
      user: member.user,
      specialties: member.specialties,
      services: member.services.map(s => s.service),
      isActive: member.isActive,
      appointmentCount: member._count.appointments,
      averageRating: member.reviews.length > 0
        ? member.reviews.reduce((sum, r) => sum + r.rating, 0) / member.reviews.length
        : 0,
      reviewCount: member.reviews.length,
      createdAt: member.createdAt,
    }))

    return NextResponse.json({ staff: staffWithStats })
  } catch (error) {
    console.error('Error fetching staff:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت لیست کارکنان' },
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
    const validation = createStaffSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات نامعتبر', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { phone, firstName, lastName, password, specialties, serviceIds } = validation.data

    // Check if user already exists
    let staffUser = await prisma.user.findFirst({
      where: { phone },
    })

    if (staffUser) {
      // Check if already staff at this salon
      const existingStaff = await prisma.staff.findFirst({
        where: { userId: staffUser.id, salonId: salon.id },
      })

      if (existingStaff) {
        return NextResponse.json(
          { error: 'این کاربر قبلا به عنوان کارمند اضافه شده است' },
          { status: 400 }
        )
      }
    } else {
      // Create new user
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null

      staffUser = await prisma.user.create({
        data: {
          phone,
          firstName,
          lastName,
          password: hashedPassword,
          role: 'STAFF',
        },
      })
    }

    // Create staff record
    const staff = await prisma.staff.create({
      data: {
        userId: staffUser.id,
        salonId: salon.id,
        specialties: specialties || [],
        services: serviceIds && serviceIds.length > 0 ? {
          create: serviceIds.map(serviceId => ({ serviceId })),
        } : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        services: {
          include: {
            service: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      staff: {
        id: staff.id,
        user: staff.user,
        specialties: staff.specialties,
        services: staff.services.map(s => s.service),
      },
    })
  } catch (error) {
    console.error('Error creating staff:', error)
    return NextResponse.json(
      { error: 'خطا در افزودن کارمند' },
      { status: 500 }
    )
  }
}
