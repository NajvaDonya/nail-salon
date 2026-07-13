import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const authority = url.searchParams.get('authority')

  if (!authority) {
    return NextResponse.json({ error: 'authority الزامی است' }, { status: 400 })
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

  const slug = payment.appointment.salon.slug
  const callbackUrl = new URL('/api/payments/callback', request.url)
  callbackUrl.searchParams.set('authority', authority)
  callbackUrl.searchParams.set('Status', 'OK')
  callbackUrl.searchParams.set('slug', slug)

  return NextResponse.redirect(callbackUrl)
}
