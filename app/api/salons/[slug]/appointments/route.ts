import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { resolveSalonAccess } from '@/lib/salon-access'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    if (user.role === 'CUSTOMER') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const { slug } = await params
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const staffId = url.searchParams.get('staffId')
    const date = url.searchParams.get('date')

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const access = await resolveSalonAccess(user)
    if (!access.salonId || access.salonId !== salon.id) {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const whereClause: Record<string, unknown> = { salonId: salon.id }

    if (access.staffId) {
      whereClause.staffId = access.staffId
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
        services: {
          include: {
            service: {
              select: {
                name: true,
                price: true,
                duration: true,
              },
            },
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
        customer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    })

    return NextResponse.json({ appointments })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json({ error: 'خطا در دریافت نوبت‌ها' }, { status: 500 })
  }
}

/** Public booking without payment is disabled — use checkout + OTP flow */
export async function POST() {
  return NextResponse.json(
    {
      error: 'ثبت مستقیم نوبت غیرفعال است. لطفاً از مسیر رزرو و پرداخت آنلاین استفاده کنید.',
      checkoutPath: '/api/salons/[slug]/checkout',
    },
    { status: 410 }
  )
}
