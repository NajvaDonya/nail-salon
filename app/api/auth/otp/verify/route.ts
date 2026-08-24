import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createToken, setAuthCookieOnResponse } from '@/lib/auth'
import { isOtpLocked } from '@/lib/otp-security'

export async function POST(request: Request) {
  try {
    const { phone, code, firstName, lastName } = await request.json()

    if (!phone || !code) {
      return NextResponse.json(
        { error: 'شماره موبایل و کد تایید الزامی است' },
        { status: 400 }
      )
    }

    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        phone,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'کد تایید نامعتبر یا منقضی شده است' },
        { status: 401 }
      )
    }

    if (isOtpLocked(otpRecord.attempts)) {
      return NextResponse.json(
        { error: 'تعداد تلاش‌ها بیش از حد مجاز است. لطفا کد جدید درخواست کنید' },
        { status: 429 }
      )
    }

    if (otpRecord.code !== code) {
      await prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      })
      return NextResponse.json({ error: 'کد تایید نامعتبر است' }, { status: 401 })
    }

    let user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
        salonId: true,
        isActive: true,
        salon: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    })

    if (!user) {
      if (!firstName) {
        return NextResponse.json(
          { error: 'برای ثبت‌نام نام و نام خانوادگی الزامی است', needsRegistration: true },
          { status: 400 }
        )
      }

      user = await prisma.user.create({
        data: {
          phone,
          firstName: firstName || 'کاربر',
          lastName: lastName || 'جدید',
          name: `${firstName || 'کاربر'} ${lastName || 'جدید'}`.trim(),
          role: 'CUSTOMER',
        },
        select: {
          id: true,
          phone: true,
          email: true,
          firstName: true,
          lastName: true,
          avatar: true,
          role: true,
          salonId: true,
          isActive: true,
          salon: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })
    } else if (user.role !== 'CUSTOMER') {
      return NextResponse.json(
        { error: 'این شماره برای ورود مشتری نیست' },
        { status: 403 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'حساب کاربری شما غیرفعال است' },
        { status: 401 }
      )
    }

    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    })

    const token = await createToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
      salonId: user.salonId || undefined,
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const response = NextResponse.json({ user })
    setAuthCookieOnResponse(response, token)

    return response
  } catch (error) {
    console.error('OTP verify error:', error)
    return NextResponse.json(
      { error: 'خطا در تایید کد' },
      { status: 500 }
    )
  }
}
