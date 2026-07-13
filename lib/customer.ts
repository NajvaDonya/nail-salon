import { prisma } from '@/lib/db'

export interface CustomerSummary {
  id: string
  phone: string
  firstName: string | null
  lastName: string | null
}

export function formatCustomerName(customer: {
  firstName?: string | null
  lastName?: string | null
  name?: string | null
}) {
  const fromParts = [customer.firstName, customer.lastName].filter(Boolean).join(' ')
  return fromParts || customer.name || 'مشتری'
}

export async function resolveAppointmentCustomer(data: {
  customerId?: string
  customerPhone?: string
  customerName?: string
}) {
  if (data.customerId) {
    const customer = await prisma.user.findFirst({
      where: { id: data.customerId, role: 'CUSTOMER' },
    })

    if (!customer) {
      throw new Error('مشتری انتخاب‌شده یافت نشد')
    }

    if (data.customerName?.trim()) {
      const nameParts = data.customerName.trim().split(' ')
      return prisma.user.update({
        where: { id: customer.id },
        data: {
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' ') || '',
          name: data.customerName.trim(),
        },
      })
    }

    return customer
  }

  const phone = data.customerPhone?.replace(/\D/g, '')
  const name = data.customerName?.trim()

  if (!phone || phone.length < 10 || !name) {
    throw new Error('نام و شماره موبایل مشتری الزامی است')
  }

  let customer = await prisma.user.findFirst({ where: { phone } })

  if (!customer) {
    const nameParts = name.split(' ')
    customer = await prisma.user.create({
      data: {
        phone,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' ') || '',
        name,
        role: 'CUSTOMER',
      },
    })
  } else {
    const nameParts = name.split(' ')
    customer = await prisma.user.update({
      where: { id: customer.id },
      data: {
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' ') || '',
        name,
        role: 'CUSTOMER',
      },
    })
  }

  return customer
}
