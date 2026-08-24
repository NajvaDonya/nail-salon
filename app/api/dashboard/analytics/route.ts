import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import { buildSalonHoursFromDb, buildStaffHoursFromDb } from '@/lib/schedule'
import {
  appointmentMinutes,
  availableMinutesInRange,
  buildHoursByDayFromSummary,
  eachDateInRange,
  getDayOfWeek,
  parseDateKey,
  salonHoursSummary,
  staffHoursSummary,
  toDateKey,
  utilizationPercent,
} from '@/lib/analytics'

const COUNTED_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] as const
const REVENUE_STATUSES = ['COMPLETED'] as const

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

function startOfWeekSaturday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay()
  const diff = day === 6 ? 0 : day + 1
  d.setDate(d.getDate() - diff)
  return d
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || !isManager(user.role)) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const url = new URL(request.url)
    const staffId = url.searchParams.get('staffId') || undefined
    const period = url.searchParams.get('period') || 'month'

    const now = new Date()
    let from: Date
    let to: Date

    if (url.searchParams.get('from') && url.searchParams.get('to')) {
      from = parseDateKey(url.searchParams.get('from')!)
      to = new Date(parseDateKey(url.searchParams.get('to')!))
      to.setHours(23, 59, 59, 999)
    } else if (period === 'week') {
      from = startOfWeekSaturday(now)
      to = new Date(from)
      to.setDate(to.getDate() + 6)
      to.setHours(23, 59, 59, 999)
    } else if (period === 'lastMonth') {
      const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      from = startOfMonth(last)
      to = endOfMonth(last)
    } else {
      from = startOfMonth(now)
      to = endOfMonth(now)
    }

    const dates = eachDateInRange(from, to)

    const salonHourRows = await prisma.workingHour.findMany({
      where: { salonId },
      select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
    })
    const salonHours = buildSalonHoursFromDb(salonHourRows)
    const salonHoursRows = salonHoursSummary(salonHours)

    const staffList = await prisma.staff.findMany({
      where: { salonId, isActive: true, user: { isActive: true } },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const targetStaffIds = staffId
      ? staffList.filter((s) => s.id === staffId).map((s) => s.id)
      : staffList.map((s) => s.id)

    if (staffId && targetStaffIds.length === 0) {
      return NextResponse.json({ error: 'پرسنل یافت نشد' }, { status: 404 })
    }

    const staffWorkingRows = await prisma.staffWorkingHour.findMany({
      where: { staffId: { in: targetStaffIds } },
      select: { staffId: true, dayOfWeek: true, startTime: true, endTime: true, isOff: true },
    })

    const staffHoursByStaff = new Map<string, ReturnType<typeof staffHoursSummary>>()
    for (const sid of targetStaffIds) {
      const rows = staffWorkingRows.filter((row) => row.staffId === sid)
      staffHoursByStaff.set(sid, staffHoursSummary(buildStaffHoursFromDb(salonHours, rows)))
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        salonId,
        ...(staffId ? { staffId } : {}),
        startTime: { gte: from, lte: to },
        kind: 'SERVICE',
      },
      select: {
        id: true,
        staffId: true,
        startTime: true,
        endTime: true,
        totalPrice: true,
        status: true,
      },
    })

    const reviews = await prisma.review.findMany({
      where: {
        appointment: {
          salonId,
          ...(staffId ? { staffId } : {}),
          startTime: { gte: from, lte: to },
        },
      },
      select: { rating: true, staffId: true },
    })

    const revenueByDayMap = new Map<string, { revenue: number; appointments: number }>()
    for (const date of dates) {
      revenueByDayMap.set(toDateKey(date), { revenue: 0, appointments: 0 })
    }

    let completedRevenue = 0
    let bookedMinutes = 0
    let completedCount = 0
    let cancelledCount = 0
    let pendingCount = 0
    let awaitingPaymentCount = 0
    let totalAppointments = 0

    const bookedMinutesByWeekday = new Map<string, number>()

    const staffStats = new Map<
      string,
      {
        staffId: string
        name: string
        appointmentCount: number
        completedCount: number
        cancelledCount: number
        revenue: number
        bookedMinutes: number
        ratings: number[]
      }
    >()

    for (const member of staffList) {
      if (!targetStaffIds.includes(member.id)) continue
      staffStats.set(member.id, {
        staffId: member.id,
        name: `${member.user.firstName ?? ''} ${member.user.lastName ?? ''}`.trim(),
        appointmentCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        revenue: 0,
        bookedMinutes: 0,
        ratings: [],
      })
    }

    for (const apt of appointments) {
      totalAppointments++
      const dayKey = toDateKey(apt.startTime)
      const dayEntry = revenueByDayMap.get(dayKey)
      const minutes = appointmentMinutes(apt.startTime, apt.endTime)
      const counted = COUNTED_STATUSES.includes(apt.status as (typeof COUNTED_STATUSES)[number])

      const stat = staffStats.get(apt.staffId)
      if (stat) {
        stat.appointmentCount++
        if (counted) stat.bookedMinutes += minutes
        if (apt.status === 'COMPLETED') {
          stat.completedCount++
          stat.revenue += apt.totalPrice
        }
        if (apt.status === 'CANCELLED' || apt.status === 'NO_SHOW') {
          stat.cancelledCount++
        }
      }

      if (apt.status === 'PENDING') pendingCount++
      if (apt.status === 'AWAITING_PAYMENT') awaitingPaymentCount++
      if (apt.status === 'CANCELLED' || apt.status === 'NO_SHOW') cancelledCount++
      if (counted) {
        bookedMinutes += minutes
        const dow = getDayOfWeek(apt.startTime)
        bookedMinutesByWeekday.set(dow, (bookedMinutesByWeekday.get(dow) ?? 0) + minutes)
      }
      if (REVENUE_STATUSES.includes(apt.status as (typeof REVENUE_STATUSES)[number])) {
        completedRevenue += apt.totalPrice
        completedCount++
        if (dayEntry) {
          dayEntry.revenue += apt.totalPrice
          dayEntry.appointments++
        }
      }
    }

    for (const review of reviews) {
      const stat = staffStats.get(review.staffId)
      if (stat) stat.ratings.push(review.rating)
    }

    let availableMinutes = 0
    if (staffId) {
      const hours = staffHoursByStaff.get(staffId)
      if (hours) {
        availableMinutes = availableMinutesInRange(dates, buildHoursByDayFromSummary(hours))
      }
    } else {
      for (const sid of targetStaffIds) {
        const hours = staffHoursByStaff.get(sid)
        if (hours) {
          availableMinutes += availableMinutesInRange(
            dates,
            buildHoursByDayFromSummary(hours)
          )
        }
      }
    }

    const salonAvailableMinutes = availableMinutesInRange(
      dates,
      buildHoursByDayFromSummary(salonHoursRows)
    )

    const staffPerformance = Array.from(staffStats.values())
      .map((stat) => {
        const hours = staffHoursByStaff.get(stat.staffId) ?? []
        const staffAvailable = availableMinutesInRange(
          dates,
          buildHoursByDayFromSummary(hours)
        )
        const avgRating =
          stat.ratings.length > 0
            ? Math.round(
                (stat.ratings.reduce((a, b) => a + b, 0) / stat.ratings.length) * 10
              ) / 10
            : null
        return {
          staffId: stat.staffId,
          name: stat.name,
          appointmentCount: stat.appointmentCount,
          completedCount: stat.completedCount,
          cancelledCount: stat.cancelledCount,
          revenue: stat.revenue,
          bookedMinutes: stat.bookedMinutes,
          bookedHours: Math.round((stat.bookedMinutes / 60) * 10) / 10,
          availableMinutes: staffAvailable,
          availableHours: Math.round((staffAvailable / 60) * 10) / 10,
          utilizationPercent: utilizationPercent(stat.bookedMinutes, staffAvailable),
          averageRating: avgRating,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)

    return NextResponse.json({
      period: { from: toDateKey(from), to: toDateKey(to), preset: period },
      filters: { staffId: staffId ?? null },
      summary: {
        totalAppointments,
        completedCount,
        pendingCount,
        awaitingPaymentCount,
        cancelledCount,
        completedRevenue,
        bookedMinutes,
        bookedHours: Math.round((bookedMinutes / 60) * 10) / 10,
        availableMinutes,
        availableHours: Math.round((availableMinutes / 60) * 10) / 10,
        salonAvailableMinutes,
        salonAvailableHours: Math.round((salonAvailableMinutes / 60) * 10) / 10,
        utilizationPercent: utilizationPercent(bookedMinutes, availableMinutes),
        averageTicket:
          completedCount > 0 ? Math.round(completedRevenue / completedCount) : 0,
        averageRating:
          reviews.length > 0
            ? Math.round(
                (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10
              ) / 10
            : null,
      },
      revenueByDay: Array.from(revenueByDayMap.entries()).map(([date, value]) => ({
        date,
        revenue: value.revenue,
        appointments: value.appointments,
      })),
      salonHours: salonHoursRows.map((row) => ({
        ...row,
        bookedMinutes: bookedMinutesByWeekday.get(row.dayOfWeek) ?? 0,
        bookedHours: Math.round(((bookedMinutesByWeekday.get(row.dayOfWeek) ?? 0) / 60) * 10) / 10,
      })),
      staffPerformance,
      staffList: staffList.map((member) => ({
        id: member.id,
        name: `${member.user.firstName ?? ''} ${member.user.lastName ?? ''}`.trim(),
      })),
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'خطا در دریافت گزارشات' }, { status: 500 })
  }
}
