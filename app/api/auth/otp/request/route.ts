import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateOTP, isMockOtpMode } from '@/lib/auth'
import { smsService } from '@/lib/sms'

export async function POST(request: Request) {
  try {
    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json(
        { error: 'شماره موبایل الزامی است' },
        { status: 400 }
      )
    }

    // Validate phone format (Iranian mobile)
    const phoneRegex = /^09\d{9}$/
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: 'فرمت شماره موبایل صحیح نیست' },
        { status: 400 }
      )
    }

    // Check for existing unused OTP in last minute (rate limiting)
    const recentOTP = await prisma.otpCode.findFirst({
      where: {
        phone,
        isUsed: false,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000), // 1 minute ago
        },
      },
    })

    if (recentOTP) {
      return NextResponse.json(
        { error: 'لطفا یک دقیقه صبر کنید و دوباره تلاش کنید' },
        { status: 429 }
      )
    }

    // Find existing user (optional - can create on verify)
    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    })

    // Generate OTP
    const code = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    // Save OTP
    await prisma.otpCode.create({
      data: {
        phone,
        code,
        userId: user?.id,
        expiresAt,
      },
    })

    // Send SMS
    const sent = await smsService.sendOTP(phone, code)
    
    if (!sent) {
      console.error('Failed to send OTP SMS to:', phone)
      // In development, still allow login (code is logged to console)
      if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json(
          { error: 'خطا در ارسال پیامک' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'کد تایید ارسال شد',
      ...(isMockOtpMode() && { code, mock: true }),
    })
  } catch (error) {
    console.error('OTP request error:', error)
    return NextResponse.json(
      { error: 'خطا در ارسال کد تایید' },
      { status: 500 }
    )
  }
}
