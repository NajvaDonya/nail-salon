import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { formatCustomerName } from '@/lib/customer'
import { persianToEnglish } from '@/lib/jalali'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const url = new URL(request.url)
    const rawPhone = url.searchParams.get('phone')

    if (!rawPhone) {
      return NextResponse.json({ error: 'شماره موبایل الزامی است' }, { status: 400 })
    }

    const phone = persianToEnglish(rawPhone).replace(/\D/g, '')
    if (!/^09\d{9}$/.test(phone)) {
      return NextResponse.json({ error: 'فرمت شماره موبایل صحیح نیست' }, { status: 400 })
    }

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const customer = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        role: true,
      },
    })

    if (!customer) {
      return NextResponse.json({ exists: false, needsName: true })
    }

    const hasSalonHistory = await prisma.appointment.findFirst({
      where: { salonId: salon.id, customerId: customer.id },
      select: { id: true },
    })

    const isKnownCustomer = customer.role === 'CUSTOMER' || Boolean(hasSalonHistory)

    if (!isKnownCustomer) {
      return NextResponse.json({ exists: false, needsName: true })
    }

    const displayName = formatCustomerName(customer)

    return NextResponse.json({
      exists: true,
      needsName: false,
      firstName: customer.firstName,
      lastName: customer.lastName,
      name: displayName,
    })
  } catch (error) {
    console.error('Customer lookup error:', error)
    return NextResponse.json({ error: 'خطا در بررسی مشتری' }, { status: 500 })
  }
}
