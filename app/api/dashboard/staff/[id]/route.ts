import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId, validateStaffSpecialties } from '@/lib/salon'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const updateStaffSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(6).optional(),
  specialties: z.array(z.string()).min(1, 'حداقل یک تخصص باید انتخاب شود').optional(),
  serviceIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

async function getOwnedStaff(staffId: string, salonId: string) {
  return prisma.staff.findFirst({
    where: { id: staffId, salonId },
    include: {
      user: true,
      _count: {
        select: { appointments: true },
      },
    },
  })
}

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
    const staff = await getOwnedStaff(id, salonId)

    if (!staff) {
      return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = updateStaffSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات نامعتبر', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { firstName, lastName, phone, password, specialties, serviceIds, isActive } = validation.data

    if (phone && phone !== staff.user.phone) {
      const existingUser = await prisma.user.findUnique({ where: { phone } })
      if (existingUser && existingUser.id !== staff.userId) {
        return NextResponse.json(
          { error: 'این شماره موبایل قبلا ثبت شده است' },
          { status: 400 }
        )
      }
    }

    const userUpdate: {
      firstName?: string
      lastName?: string
      name?: string
      phone?: string
      passwordHash?: string
      isActive?: boolean
    } = {}

    if (firstName !== undefined) userUpdate.firstName = firstName
    if (lastName !== undefined) userUpdate.lastName = lastName
    if (firstName !== undefined || lastName !== undefined) {
      const fn = firstName ?? staff.user.firstName ?? ''
      const ln = lastName ?? staff.user.lastName ?? ''
      userUpdate.name = `${fn} ${ln}`.trim()
    }
    if (phone !== undefined) userUpdate.phone = phone
    if (password) userUpdate.passwordHash = await bcrypt.hash(password, 10)
    if (isActive !== undefined) userUpdate.isActive = isActive

    const staffUpdate: {
      specialties?: string[]
      isActive?: boolean
    } = {}

    if (specialties !== undefined) {
      const specialtyValidation = await validateStaffSpecialties(salonId, specialties)
      if ('error' in specialtyValidation) {
        return NextResponse.json({ error: specialtyValidation.error }, { status: 400 })
      }
      staffUpdate.specialties = specialtyValidation.valid
    }
    if (isActive !== undefined) staffUpdate.isActive = isActive

    if (serviceIds !== undefined) {
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds }, salonId, isActive: true },
        select: { id: true },
      })
      if (services.length !== serviceIds.length) {
        return NextResponse.json({ error: 'برخی خدمات انتخاب‌شده معتبر نیست' }, { status: 400 })
      }
      await prisma.staffService.deleteMany({ where: { staffId: id } })
      if (serviceIds.length > 0) {
        await prisma.staffService.createMany({
          data: serviceIds.map((serviceId) => ({ staffId: id, serviceId })),
        })
      }
    }

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: staff.userId }, data: userUpdate })
    }

    const updatedStaff = await prisma.staff.update({
      where: { id },
      data: staffUpdate,
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: { appointments: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      staff: {
        id: updatedStaff.id,
        user: updatedStaff.user,
        specialties: updatedStaff.specialties,
        isActive: updatedStaff.isActive,
        appointmentCount: updatedStaff._count.appointments,
      },
    })
  } catch (error) {
    console.error('Error updating staff:', error)
    return NextResponse.json({ error: 'خطا در ویرایش پرسنل' }, { status: 500 })
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
    const staff = await getOwnedStaff(id, salonId)

    if (!staff) {
      return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 })
    }

    if (staff._count.appointments > 0) {
      return NextResponse.json(
        { error: 'این پرسنل نوبت دارد و قابل حذف نیست. می‌توانید غیرفعالش کنید.' },
        { status: 400 }
      )
    }

    const userId = staff.userId

    await prisma.staff.delete({ where: { id } })

    const remainingStaff = await prisma.staff.count({ where: { userId } })
    if (remainingStaff === 0) {
      const staffUser = await prisma.user.findUnique({ where: { id: userId } })
      if (staffUser?.role === 'STAFF') {
        await prisma.user.delete({ where: { id: userId } })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting staff:', error)
    return NextResponse.json({ error: 'خطا در حذف پرسنل' }, { status: 500 })
  }
}
