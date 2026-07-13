import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId, validateStaffSpecialties } from '@/lib/salon'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const createStaffSchema = z.object({
  phone: z.string().min(10),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  password: z.string().min(6).optional(),
  specialties: z.array(z.string()).min(1, 'حداقل یک تخصص باید انتخاب شود'),
  serviceIds: z.array(z.string()).optional(),
})

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    
    if (!user || !isManager(user.role)) {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)

    if (!salonId) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    const url = new URL(request.url)
    const activeOnly = url.searchParams.get('activeOnly') === 'true'

    const staff = await prisma.staff.findMany({
      where: {
        salonId,
        ...(activeOnly
          ? {
              isActive: true,
              user: { isActive: true },
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            avatar: true,
            isActive: true,
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
      isActive: member.isActive && member.user.isActive,
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
    
    if (!user || !isManager(user.role)) {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)

    if (!salonId) {
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

    const specialtyValidation = await validateStaffSpecialties(salonId, specialties)
    if ('error' in specialtyValidation) {
      return NextResponse.json({ error: specialtyValidation.error }, { status: 400 })
    }

    const validatedSpecialties = specialtyValidation.valid

    let staffUser = await prisma.user.findUnique({
      where: { phone },
    })

    if (staffUser) {
      if (staffUser.role === 'MANAGER' || staffUser.role === 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'نمی‌توانید مدیر را به عنوان پرسنل اضافه کنید' },
          { status: 400 }
        )
      }

      const existingStaff = await prisma.staff.findFirst({
        where: { userId: staffUser.id, salonId },
      })

      if (existingStaff) {
        return NextResponse.json(
          { error: 'این کاربر قبلا به عنوان کارمند اضافه شده است' },
          { status: 400 }
        )
      }

      staffUser = await prisma.user.update({
        where: { id: staffUser.id },
        data: {
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim(),
          role: 'STAFF',
          salonId,
          ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        },
      })
    } else {
      if (!password) {
        return NextResponse.json(
          { error: 'رمز عبور برای پرسنل جدید الزامی است' },
          { status: 400 }
        )
      }

      staffUser = await prisma.user.create({
        data: {
          phone,
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim(),
          passwordHash: await bcrypt.hash(password, 10),
          role: 'STAFF',
          salonId,
        },
      })
    }

    // Create staff record
    const staff = await prisma.staff.create({
      data: {
        userId: staffUser.id,
        salonId,
        specialties: validatedSpecialties,
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
