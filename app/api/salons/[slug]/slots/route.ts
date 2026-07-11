import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAvailableSlots } from '@/lib/booking'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const url = new URL(request.url)
    const staffId = url.searchParams.get('staffId')
    const dateStr = url.searchParams.get('date')
    const duration = parseInt(url.searchParams.get('duration') || '30')

    if (!staffId || !dateStr) {
      return NextResponse.json(
        { error: 'پارامترهای staffId و date الزامی هستند' },
        { status: 400 }
      )
    }

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    const date = new Date(dateStr)
    const slots = await getAvailableSlots(staffId, date, duration, salon.id)

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Error fetching slots:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت زمان‌های خالی' },
      { status: 500 }
    )
  }
}
