import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { cleanupExpiredAwaitingPayments } from '@/lib/appointment-cleanup'
import { verifySlotHold, releaseHoldsByToken, SlotHoldError } from '@/lib/slot-hold'
import { buildCardPaymentView } from '@/lib/card-payment'
import {
  parseSalonSettings,
  assertOnlineBookingAllowed,
  assertBookingDateWithinLimit,
  assertCardPaymentConfigured,
  OnlineBookingDisabledError,
  BookingDateOutOfRangeError,
  PaymentInfoMissingError,
} from '@/lib/salon-settings'
import {
  BookingQuoteError,
  buildAppointmentSnapshots,
  mergeSelections,
  resolveQuoteForSalon,
  type ServiceSelection,
} from '@/lib/booking-quote'
import {
  findConflictingAppointment,
  lockStaffForBooking,
} from '@/lib/appointment-conflict'
import { getStaffBreakSettings } from '@/lib/staff-breaks'
import { parseAppointmentDate } from '@/lib/slot-hold'
import { z } from 'zod'

const selectionSchema = z.object({
  serviceId: z.string(),
  quantity: z.number().int().min(1).default(1),
})

const checkoutSchema = z.object({
  visitTypeId: z.string().optional(),
  preferredStaffId: z.string().optional(),
  baseServiceIds: z.array(z.string()).min(1),
  selections: z.array(selectionSchema).default([]),
  staffId: z.string(),
  date: z.string(),
  startTime: z.string(),
  notes: z.string().optional(),
  holdToken: z.string().min(1),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'لطفا ابتدا با کد تایید وارد شوید' }, { status: 401 })
    }

    await cleanupExpiredAwaitingPayments()

    const { slug } = await params
    const body = await request.json()
    const validation = checkoutSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات وارد شده نامعتبر است', details: validation.error.errors },
        { status: 400 }
      )
    }

    const {
      visitTypeId,
      preferredStaffId,
      baseServiceIds,
      selections,
      staffId,
      date,
      startTime,
      notes,
      holdToken,
    } = validation.data
    const dateKey = date.split('T')[0]

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true, name: true, settings: true },
    })

    if (!salon) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const salonSettings = parseSalonSettings(salon.settings)

    try {
      assertOnlineBookingAllowed(salonSettings)
      assertCardPaymentConfigured(salonSettings)
      assertBookingDateWithinLimit(dateKey, salonSettings)
    } catch (error) {
      if (
        error instanceof OnlineBookingDisabledError ||
        error instanceof PaymentInfoMissingError ||
        error instanceof BookingDateOutOfRangeError
      ) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      throw error
    }

    if (visitTypeId) {
      const visitType = await prisma.visitType.findFirst({
        where: { id: visitTypeId, salonId: salon.id, isActive: true },
      })
      if (!visitType) {
        return NextResponse.json({ error: 'نوع مراجعه نامعتبر است' }, { status: 400 })
      }
    }

    let quote
    try {
      quote = await resolveQuoteForSalon(prisma, salon.id, {
        baseServiceIds,
        selections: mergeSelections(baseServiceIds, selections as ServiceSelection[]),
        preferredStaffId,
      })
    } catch (error) {
      if (error instanceof BookingQuoteError) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }

    if (!quote.qualifiedStaffIds.includes(staffId)) {
      return NextResponse.json({ error: 'پرسنل انتخاب‌شده واجد شرایط نیست' }, { status: 400 })
    }

    const { totalPrice, depositAmount, balanceDue, occupiedMinutes, serviceIds } = quote
    const appointmentDate = parseAppointmentDate(dateKey)
    const startDateTime = new Date(`${dateKey}T${startTime}`)
    const endDateTime = new Date(startDateTime.getTime() + occupiedMinutes * 60000)

    if (depositAmount <= 0) {
      return NextResponse.json(
        { error: 'مبلغ بیعانه برای این نوبت تنظیم نشده است' },
        { status: 400 }
      )
    }

    try {
      await verifySlotHold({
        staffId,
        date: dateKey,
        startTime,
        durationMinutes: occupiedMinutes,
        holdToken,
      })
    } catch (error) {
      if (error instanceof SlotHoldError) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      throw error
    }

    const breakSettings = await getStaffBreakSettings(staffId, salon.id)
    const trackingCode = `SL${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`
    const snapshots = buildAppointmentSnapshots(quote.lineItems)

    let appointmentId: string
    let paymentCreatedAt: Date

    try {
      const created = await prisma.$transaction(async (tx) => {
        await lockStaffForBooking(staffId, tx)

        const conflict = await findConflictingAppointment(
          {
            staffId,
            startDateTime,
            endDateTime,
            restMinutes: breakSettings.restMinutes,
          },
          tx
        )

        if (conflict) {
          throw new SlotHoldError('این زمان دیگر در دسترس نیست')
        }

        const appointment = await tx.appointment.create({
          data: {
            salonId: salon.id,
            customerId: user.id,
            staffId,
            visitTypeId: visitTypeId ?? null,
            preferredStaffId: preferredStaffId ?? null,
            date: appointmentDate,
            startTime: startDateTime,
            endTime: endDateTime,
            totalPrice,
            depositAmount,
            balanceDue,
            status: 'AWAITING_PAYMENT',
            trackingCode,
            notes,
            services: {
              create: snapshots.map((snap) => ({
                serviceId: snap.serviceId,
                serviceName: snap.serviceName,
                price: snap.price,
                finalPrice: snap.finalPrice,
                duration: snap.duration,
                bufferTime: snap.bufferTime,
                depositAmount: snap.depositAmount,
                quantity: snap.quantity,
              })),
            },
          },
        })

        const payment = await tx.payment.create({
          data: {
            appointmentId: appointment.id,
            amount: depositAmount,
            authority: null,
            // Snapshot the salon setting so later changes never move this booking's deadline.
            expirationMinutes: salonSettings.payment.paymentExpirationMinutes,
          },
        })

        return { appointment, payment }
      })

      appointmentId = created.appointment.id
      paymentCreatedAt = created.appointment.createdAt
    } catch (error) {
      if (error instanceof SlotHoldError) {
        return NextResponse.json({ error: error.message }, { status: 409 })
      }
      throw error
    }

    await releaseHoldsByToken(holdToken)

    return NextResponse.json({
      success: true,
      appointment: {
        id: appointmentId,
        trackingCode,
        totalPrice,
        depositAmount,
        balanceDue,
        serviceIds,
      },
      payment: buildCardPaymentView({
        amount: depositAmount,
        status: 'PENDING',
        createdAt: paymentCreatedAt,
        expirationMinutes: salonSettings.payment.paymentExpirationMinutes,
        paymentSubmittedAt: null,
        paymentExpiresAt: null,
        paymentRejectionReason: null,
        salonPayment: salonSettings.payment,
      }),
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'خطا در ثبت نوبت' }, { status: 500 })
  }
}
