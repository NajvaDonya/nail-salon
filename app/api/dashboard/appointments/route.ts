import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'لطفا وارد شوید' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const date = url.searchParams.get('date')
    const staffId = url.searchParams.get('staffId')

    // Get user's salon
    let salonId: string | null = null
    let specificStaffId: string | null = null

    if (user.role === 'MANAGER') {
      const salon = await prisma.salon.findFirst({
        where: { ownerId: user.id },
        select: { id: true },
      })
      salonId = salon?.id || null
    } else if (user.role === 'STAFF') {
      const staff = await prisma.staff.findFirst({
        where: { userId: user.id },
        select: { id: true, salonId: true },
      })
      salonId = staff?.salonId || null
      specificStaffId = staff?.id || null // Staff can only see their own appointments
    }

    if (!salonId) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    const whereClause: Record<string, unknown> = { salonId }

    // Staff can only see their own appointments
    if (specificStaffId) {
      whereClause.staffId = specificStaffId
    } else if (staffId) {
      whereClause.staffId = staffId
    }

    if (status) {
      whereClause.status = status
    }

    if (date) {
      const targetDate = new Date(date)
      const nextDate = new Date(targetDate)
      nextDate.setDate(nextDate.getDate() + 1)
      
      whereClause.startTime = {
        gte: targetDate,
        lt: nextDate,
      }
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
        staff: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        services: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                price: true,
                duration: true,
              },
            },
          },
        },
      },
      orderBy: { startTime: 'desc' },
    })

    return NextResponse.json({
      appointments: appointments.map(apt => ({
        id: apt.id,
        trackingCode: apt.trackingCode,
        startTime: apt.startTime,
        endTime: apt.endTime,
        status: apt.status,
        totalPrice: apt.totalPrice,
        notes: apt.notes,
        customer: apt.customer,
        staff: {
          id: apt.staff.id,
          name: `${apt.staff.user.firstName} ${apt.staff.user.lastName}`,
        },
        services: apt.services.map(s => s.service),
        createdAt: apt.createdAt,
      })),
    })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت نوبت‌ها' },
      { status: 500 }
    )
  }
}
