import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { resolveSalonAccess } from '@/lib/salon-access'
import { formatCustomerName } from '@/lib/customer'
import { persianToEnglish } from '@/lib/jalali'

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    const { salonId } = await resolveSalonAccess(user)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const url = new URL(request.url)
    const rawPhone = url.searchParams.get('phone')

    if (!rawPhone) {
      return NextResponse.json({ error: 'شماره موبایل الزامی است' }, { status: 400 })
    }

    const phone = persianToEnglish(rawPhone).replace(/\D/g, '')
    if (!/^09\d{9}$/.test(phone)) {
      return NextResponse.json({ error: 'فرمت شماره موبایل صحیح نیست' }, { status: 400 })
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
      where: { salonId, customerId: customer.id },
      select: { id: true },
    })

    const isKnownCustomer = customer.role === 'CUSTOMER' || Boolean(hasSalonHistory)

    if (!isKnownCustomer) {
      return NextResponse.json({ exists: false, needsName: true })
    }

    return NextResponse.json({
      exists: true,
      needsName: false,
      firstName: customer.firstName,
      lastName: customer.lastName,
      name: formatCustomerName(customer),
    })
  } catch (error) {
    console.error('Customer lookup error:', error)
    return NextResponse.json({ error: 'خطا در بررسی مشتری' }, { status: 500 })
  }
}
