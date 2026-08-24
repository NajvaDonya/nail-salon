import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isPaymentMockMode } from '@/lib/payment'

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' || !isPaymentMockMode()) {
    return NextResponse.json({ error: 'Mock payment is disabled' }, { status: 403 })
  }

  const url = new URL(request.url)
  const authority = url.searchParams.get('authority')

  if (!authority || !authority.startsWith('MOCK')) {
    return NextResponse.json({ error: 'authority نامعتبر است' }, { status: 400 })
  }

  const payment = await prisma.payment.findUnique({
    where: { authority },
    include: {
      appointment: { include: { salon: { select: { slug: true } } } },
    },
  })

  if (!payment) {
    return NextResponse.json({ error: 'پرداخت یافت نشد' }, { status: 404 })
  }

  const slug = url.searchParams.get('slug') || payment.appointment.salon.slug
  const returnTo = url.searchParams.get('returnTo')
  const callbackUrl = new URL('/api/payments/callback', request.url)
  callbackUrl.searchParams.set('authority', authority)
  callbackUrl.searchParams.set('Status', 'OK')
  callbackUrl.searchParams.set('slug', slug)
  if (returnTo) {
    callbackUrl.searchParams.set('returnTo', returnTo)
  }

  return NextResponse.redirect(callbackUrl)
}
