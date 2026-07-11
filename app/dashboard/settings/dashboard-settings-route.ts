import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { z } from 'zod'

const updateSettingsSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  openingHours: z.record(z.object({
    open: z.string(),
    close: z.string(),
    isOpen: z.boolean(),
  })).optional(),
  settings: z.object({
    allowOnlineBooking: z.boolean().optional(),
    requireConfirmation: z.boolean().optional(),
    sendReminders: z.boolean().optional(),
    reminderHours: z.number().optional(),
    bufferTime: z.number().optional(),
  }).optional(),
})

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }

    // Guard: manager must be linked to a salon
    if (!user.salonId) {
      return NextResponse.json(
        { error: 'این حساب به هیچ سالنی متصل نیست' },
        { status: 404 }
      )
    }

    const salon = await prisma.salon.findUnique({
      where: { id: user.salonId },
    })

    if (!salon) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    return NextResponse.json({ salon })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت تنظیمات' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'MANAGER') {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }

    // Guard: manager must be linked to a salon
    if (!user.salonId) {
      return NextResponse.json(
        { error: 'این حساب به هیچ سالنی متصل نیست' },
        { status: 404 }
      )
    }

    const salon = await prisma.salon.findUnique({
      where: { id: user.salonId },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = updateSettingsSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات نامعتبر', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { openingHours, settings, ...basicData } = validation.data

    const updated = await prisma.salon.update({
      where: { id: salon.id },
      data: {
        ...basicData,
        ...(openingHours && { openingHours }),
        ...(settings && { settings }),
      },
    })

    return NextResponse.json({
      success: true,
      salon: updated,
    })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'خطا در بروزرسانی تنظیمات' },
      { status: 500 }
    )
  }
}
