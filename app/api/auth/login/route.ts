import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyPassword, createToken, setAuthCookieOnResponse } from '@/lib/auth'

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json()

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'شماره موبایل و رمز عبور الزامی است' },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
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
        passwordHash: true, // fixed: was looking for a field that didn't exist
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
      return NextResponse.json(
        { error: 'کاربری با این شماره یافت نشد' },
        { status: 401 }
      )
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'حساب کاربری شما غیرفعال است' },
        { status: 401 }
      )
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'لطفا از روش ورود با کد تایید استفاده کنید' },
        { status: 401 }
      )
    }

    // fixed: verify against user.passwordHash (was always undefined before)
    const isValid = await verifyPassword(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { error: 'رمز عبور اشتباه است' },
        { status: 401 }
      )
    }

    // Create token
    const token = await createToken({
      userId: user.id,
      phone: user.phone,
      role: user.role,
      salonId: user.salonId || undefined,
    })

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const { passwordHash: _, ...userWithoutPassword } = user

    // Set cookie on response so it persists after redirect
    const response = NextResponse.json({ user: userWithoutPassword })
    setAuthCookieOnResponse(response, token)

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'خطا در ورود به سیستم' },
      { status: 500 }
    )
  }
}
