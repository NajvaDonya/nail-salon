import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'لطفا وارد شوید' },
        { status: 401 }
      )
    }

    let salonId: string | null = null

    if (user.role === 'MANAGER' || user.role === 'SUPER_ADMIN') {
      salonId = await getManagerSalonId(user.id, user.salonId)
    } else if (user.role === 'STAFF') {
      const staff = await prisma.staff.findFirst({
        where: { userId: user.id },
        select: { salonId: true },
      })
      salonId = staff?.salonId || null
    }

    if (!salonId) {
      return NextResponse.json(
        { error: 'سالنی یافت نشد' },
        { status: 404 }
      )
    }

    // Get date ranges
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Fetch stats in parallel
    const [
      todayAppointments,
      weekAppointments,
      monthRevenue,
      totalCustomers,
      pendingAppointments,
      staffCount,
      serviceCount,
      recentReviews,
      upcomingAppointments,
    ] = await Promise.all([
      // Today's appointments
      prisma.appointment.count({
        where: {
          salonId,
          startTime: { gte: startOfToday },
        },
      }),
      // This week's appointments
      prisma.appointment.count({
        where: {
          salonId,
          startTime: { gte: startOfWeek },
        },
      }),
      // This month's revenue
      prisma.appointment.aggregate({
        where: {
          salonId,
          startTime: { gte: startOfMonth },
          status: 'COMPLETED',
        },
        _sum: { totalPrice: true },
      }),
      // Total unique customers
      prisma.appointment.groupBy({
        by: ['customerId'],
        where: { salonId },
        _count: true,
      }),
      // Pending appointments
      prisma.appointment.count({
        where: {
          salonId,
          status: 'PENDING',
        },
      }),
      // Staff count
      prisma.staff.count({
        where: { salonId, isActive: true },
      }),
      // Service count
      prisma.service.count({
        where: { salonId, isActive: true },
      }),
      // Recent reviews
      prisma.review.findMany({
        where: {
          appointment: { salonId },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { firstName: true, lastName: true },
          },
          staff: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
      }),
      // Upcoming appointments
      prisma.appointment.findMany({
        where: {
          salonId,
          startTime: { gte: now },
          status: { in: ['PENDING', 'CONFIRMED'] },
        },
        take: 10,
        orderBy: { startTime: 'asc' },
        include: {
          customer: {
            select: { firstName: true, lastName: true, phone: true },
          },
          staff: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          services: {
            include: {
              service: {
                select: { name: true },
              },
            },
          },
        },
      }),
    ])

    // Calculate weekly revenue trend (last 7 days)
    const weeklyRevenue = await Promise.all(
      Array.from({ length: 7 }, async (_, i) => {
        const date = new Date(startOfToday)
        date.setDate(date.getDate() - (6 - i))
        const nextDate = new Date(date)
        nextDate.setDate(nextDate.getDate() + 1)

        const revenue = await prisma.appointment.aggregate({
          where: {
            salonId,
            startTime: { gte: date, lt: nextDate },
            status: 'COMPLETED',
          },
          _sum: { totalPrice: true },
        })

        return {
          date: date.toISOString().split('T')[0],
          revenue: revenue._sum.totalPrice || 0,
        }
      })
    )

    return NextResponse.json({
      stats: {
        todayAppointments,
        weekAppointments,
        monthRevenue: monthRevenue._sum.totalPrice || 0,
        totalCustomers: totalCustomers.length,
        pendingAppointments,
        staffCount,
        serviceCount,
      },
      weeklyRevenue,
      recentReviews: recentReviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        customer: review.customer,
        staff: review.staff,
      })),
      upcomingAppointments: upcomingAppointments.map(apt => ({
        id: apt.id,
        startTime: apt.startTime,
        endTime: apt.endTime,
        status: apt.status,
        totalPrice: apt.totalPrice,
        trackingCode: apt.trackingCode,
        customer: apt.customer,
        staff: apt.staff,
        services: apt.services.map(s => s.service.name),
      })),
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت آمار' },
      { status: 500 }
    )
  }
}
