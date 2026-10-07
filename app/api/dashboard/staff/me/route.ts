import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId, validateStaffSpecialties } from '@/lib/salon'
import { ensureManagerStaffProfile } from '@/lib/manager-staff'

const patchSchema = z.object({
  providesServices: z.boolean(),
  specialties: z.array(z.string()).min(1).optional(),
  serviceIds: z.array(z.string()).optional(),
})

async function loadManagerBookableProfile(userId: string, salonId: string) {
  const staff = await prisma.staff.findUnique({
    where: { userId_salonId: { userId, salonId } },
    include: {
      services: {
        include: {
          service: { select: { id: true, name: true } },
        },
      },
    },
  })

  if (!staff) {
    return {
      providesServices: false,
      staff: null,
    }
  }

  const providesServices = staff.isActive

  return {
    providesServices,
    staff: {
      id: staff.id,
      specialties: staff.specialties,
      isActive: staff.isActive,
      services: staff.services.map((row) => row.service),
    },
  }
}

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

    const profile = await loadManagerBookableProfile(user.id, salonId)
    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error fetching manager bookable profile:', error)
    return NextResponse.json({ error: 'خطا در دریافت پروفایل رزرو' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
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
    const validation = patchSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات نامعتبر', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { providesServices, specialties, serviceIds } = validation.data

    if (!providesServices) {
      const existing = await prisma.staff.findUnique({
        where: { userId_salonId: { userId: user.id, salonId } },
        select: { id: true },
      })
      if (existing) {
        await prisma.staff.update({
          where: { id: existing.id },
          data: { isActive: false },
        })
      }
      const profile = await loadManagerBookableProfile(user.id, salonId)
      return NextResponse.json({ success: true, ...profile })
    }

    let validatedSpecialties: string[] | undefined
    if (specialties !== undefined) {
      const specialtyValidation = await validateStaffSpecialties(salonId, specialties)
      if ('error' in specialtyValidation) {
        return NextResponse.json({ error: specialtyValidation.error }, { status: 400 })
      }
      validatedSpecialties = specialtyValidation.valid
    }

    if (serviceIds !== undefined) {
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds }, salonId, isActive: true },
        select: { id: true },
      })
      if (services.length !== serviceIds.length) {
        return NextResponse.json({ error: 'برخی خدمات انتخاب‌شده معتبر نیست' }, { status: 400 })
      }
    }

    const staff = await ensureManagerStaffProfile(user.id, salonId, {
      specialties: validatedSpecialties,
      isActive: true,
      syncWorkingHoursFromSalon: true,
    })

    if (serviceIds !== undefined) {
      await prisma.staffService.deleteMany({ where: { staffId: staff.id } })
      if (serviceIds.length > 0) {
        await prisma.staffService.createMany({
          data: serviceIds.map((serviceId) => ({ staffId: staff.id, serviceId })),
        })
      }
    }

    const profile = await loadManagerBookableProfile(user.id, salonId)
    return NextResponse.json({ success: true, ...profile })
  } catch (error) {
    console.error('Error updating manager bookable profile:', error)
    return NextResponse.json({ error: 'خطا در ذخیره پروفایل رزرو' }, { status: 500 })
  }
}
