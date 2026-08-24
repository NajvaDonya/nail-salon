import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPayment } from '@/lib/payment'
import { sendAppointmentConfirmation } from '@/lib/sms'
import { parseSalonSettings, shouldRequireConfirmation } from '@/lib/salon-settings'

function resolveReturnBase(returnTo: string | null, salonSlug: string): string {
  if (returnTo === '/') return '/'
  if (
    returnTo &&
    returnTo.startsWith('/salon/') &&
    (returnTo.endsWith('/book') || returnTo.includes('/book?'))
  ) {
    return returnTo.split('?')[0]
  }
  return `/salon/${salonSlug}/book`
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const authority = url.searchParams.get('Authority') || url.searchParams.get('authority')
    const status = url.searchParams.get('Status') || url.searchParams.get('status')
    const slug = url.searchParams.get('slug') || ''
    const returnTo = url.searchParams.get('returnTo')

    if (!authority) {
      return NextResponse.redirect(new URL('/account?payment=failed', request.url))
    }

    const payment = await prisma.payment.findUnique({
      where: { authority },
      include: {
        appointment: {
          include: {
            salon: { select: { name: true, slug: true, settings: true } },
            customer: { select: { phone: true, firstName: true, lastName: true } },
            staff: { include: { user: { select: { firstName: true, lastName: true } } } },
            services: { include: { service: { select: { name: true } } } },
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.redirect(new URL('/account?payment=failed', request.url))
    }

    const salonSlug = slug || payment.appointment.salon.slug
    const baseRedirect = resolveReturnBase(returnTo, salonSlug)

    if (status === 'NOK' || status === 'failed') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      })
      await prisma.appointment.update({
        where: { id: payment.appointmentId },
        data: { status: 'CANCELLED' },
      })
      return NextResponse.redirect(new URL(`${baseRedirect}?payment=failed`, request.url))
    }

    if (payment.status === 'PAID') {
      return NextResponse.redirect(
        new URL(`${baseRedirect}?payment=success&code=${payment.appointment.trackingCode}`, request.url)
      )
    }

    const verification = await verifyPayment({
      authority,
      amount: payment.amount,
    })

    if (!verification.ok) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      })
      await prisma.appointment.update({
        where: { id: payment.appointmentId },
        data: { status: 'CANCELLED' },
      })
      return NextResponse.redirect(new URL(`${baseRedirect}?payment=failed`, request.url))
    }

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          refId: verification.refId,
          paidAt: new Date(),
        },
      }),
      prisma.appointment.update({
        where: { id: payment.appointmentId },
        data: {
          status: shouldRequireConfirmation(parseSalonSettings(payment.appointment.salon.settings))
            ? 'PENDING'
            : 'CONFIRMED',
        },
      }),
    ])

    const apt = payment.appointment
    const customerName = [apt.customer.firstName, apt.customer.lastName].filter(Boolean).join(' ')

    try {
      await sendAppointmentConfirmation(apt.customer.phone, {
        salonName: apt.salon.name,
        trackingCode: apt.trackingCode!,
        date: apt.startTime.toLocaleDateString('fa-IR'),
        time: apt.startTime.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        staffName: `${apt.staff.user.firstName} ${apt.staff.user.lastName}`,
        services: apt.services.map((s) => s.service.name).join('، '),
        customerName,
      })
    } catch (smsError) {
      console.error('Failed to send confirmation SMS:', smsError)
    }

    return NextResponse.redirect(
      new URL(`${baseRedirect}?payment=success&code=${apt.trackingCode}`, request.url)
    )
  } catch (error) {
    console.error('Payment callback error:', error)
    return NextResponse.redirect(new URL('/account?payment=failed', request.url))
  }
}
