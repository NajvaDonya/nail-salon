import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import {
  RECEIPT_ALREADY_SUBMITTED_MESSAGE,
  submitReceiptDeclaration,
} from '@/lib/card-payment'

/**
 * The customer declares that the receipt was sent in Telegram.
 * This only moves the payment to SUBMITTED — it never confirms the booking.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'لطفا وارد شوید' }, { status: 401 })
    }

    const { id } = await params
    const owned = await prisma.appointment.findFirst({
      where: { id, customerId: user.id },
      select: { id: true },
    })

    if (!owned) {
      return NextResponse.json({ error: 'نوبت یافت نشد' }, { status: 404 })
    }

    const result = await submitReceiptDeclaration(owned.id)

    if (!result.ok) {
      if (result.reason === 'EXPIRED') {
        return NextResponse.json(
          {
            error: 'زمان پرداخت این رزرو به پایان رسیده — لطفاً دوباره رزرو کنید',
            expired: true,
          },
          { status: 410 }
        )
      }
      if (result.reason === 'NOT_FOUND') {
        return NextResponse.json({ error: 'نوبت یافت نشد' }, { status: 404 })
      }
      return NextResponse.json(
        { error: 'این نوبت در انتظار پرداخت نیست' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      alreadySubmitted: result.alreadySubmitted,
      message: result.alreadySubmitted
        ? RECEIPT_ALREADY_SUBMITTED_MESSAGE
        : 'رسید شما برای سالن ارسال شده است و در انتظار تأیید مدیر است.',
      expiresAt: result.expiresAt.toISOString(),
      serverNow: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Receipt declaration error:', error)
    return NextResponse.json({ error: 'خطا در ثبت ارسال رسید' }, { status: 500 })
  }
}
