import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { formatCustomerName } from '@/lib/customer'
import { resolveSalonAccess } from '@/lib/salon-access'
import { persianToEnglish } from '@/lib/jalali'

const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 20

async function resolveSalonId(user: { id: string; role: string; salonId?: string | null }) {
  const access = await resolveSalonAccess(user)
  return access.salonId
}

function scoreCustomer(
  customer: { phone: string; firstName: string | null; lastName: string | null; name?: string | null },
  query: string,
  rawQuery: string
) {
  const phone = persianToEnglish(customer.phone).replace(/\D/g, '')
  const name = formatCustomerName(customer).toLowerCase()
  const normalizedRaw = rawQuery.trim().toLowerCase()

  if (phone === query) return 100
  if (phone.startsWith(query)) return 90
  if (name === normalizedRaw) return 85
  if (name.startsWith(normalizedRaw)) return 75
  if (phone.includes(query)) return 60
  if (name.includes(normalizedRaw)) return 50
  return 0
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    if (user.role !== 'MANAGER' && user.role !== 'STAFF' && user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 })
    }

    const salonId = await resolveSalonId(user)
    if (!salonId) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const url = new URL(request.url)
    const rawQuery = url.searchParams.get('q')?.trim() ?? ''
    const query = persianToEnglish(rawQuery).replace(/\D/g, '') || rawQuery.trim()

    if (query.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ customers: [] })
    }

    const appointments = await prisma.appointment.findMany({
      where: { salonId },
      select: { customerId: true },
      distinct: ['customerId'],
    })

    const customerIds = appointments.map((row) => row.customerId)
    if (customerIds.length === 0) {
      return NextResponse.json({ customers: [] })
    }

    const digitQuery = persianToEnglish(rawQuery).replace(/\D/g, '')

    const customers = await prisma.user.findMany({
      where: {
        id: { in: customerIds },
        OR: [
          ...(digitQuery.length >= MIN_QUERY_LENGTH
            ? [{ phone: { contains: digitQuery } }]
            : []),
          { firstName: { contains: rawQuery } },
          { lastName: { contains: rawQuery } },
          { name: { contains: rawQuery } },
        ],
      },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        name: true,
      },
    })

    const ranked = customers
      .map((customer) => ({
        customer,
        score: scoreCustomer(customer, digitQuery || query, rawQuery),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((item) => item.customer)

    return NextResponse.json({
      customers: ranked.map((customer) => ({
        id: customer.id,
        phone: customer.phone,
        firstName: customer.firstName,
        lastName: customer.lastName,
        displayName: formatCustomerName(customer),
      })),
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json({ error: 'خطا در دریافت مشتریان' }, { status: 500 })
  }
}
