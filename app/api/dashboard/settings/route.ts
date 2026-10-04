import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getCurrentUser, isManager } from '@/lib/auth'
import { getManagerSalonId } from '@/lib/salon'
import { z } from 'zod'

import { mergeSalonSettings } from '@/lib/salon-appearance'
import {
  MAX_PAYMENT_EXPIRATION_MINUTES,
  MIN_PAYMENT_EXPIRATION_MINUTES,
  normalizeTelegramReceiptUrl,
} from '@/lib/salon-settings'
import type { UserRole } from '@/lib/types'

function canManageSettings(role: UserRole) {
  return isManager(role)
}

const appearanceSchema = z.object({
  hue: z.number().min(0).max(360).optional(),
  colorIntensity: z.number().min(0).max(100).optional(),
  // Accept legacy theme for old clients; mergeSalonSettings converts to hue
  theme: z.enum(['violet', 'rose', 'teal', 'amber']).optional(),
  welcomeBadge: z
    .string()
    .max(80)
    .optional()
    .transform((value) => value?.trim()),
  welcomeSubtitle: z
    .string()
    .max(300)
    .optional()
    .transform((value) => value?.trim()),
  showCharacter: z.boolean().optional(),
})

const optionalText = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined
    if (value === null) return null
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  })

const paymentSchema = z.object({
  bankCardNumber: z
    .string()
    .max(32)
    .optional()
    .transform((value) => value?.replace(/[\s-]/g, '').trim())
    .refine((value) => !value || /^\d{16}$/.test(value), 'شماره کارت باید ۱۶ رقم باشد'),
  bankAccountOwner: z
    .string()
    .max(120)
    .optional()
    .transform((value) => value?.trim()),
  paymentPhone: z
    .string()
    .max(20)
    .optional()
    .transform((value) => value?.trim()),
  telegramReceiptUrl: z
    .string()
    .max(200)
    .optional()
    .transform((value) => (value?.trim() ? normalizeTelegramReceiptUrl(value) : ''))
    .refine(
      (value) => value === '' || value.startsWith('https://'),
      'لینک تلگرام معتبر نیست — مثلاً @SalonUsername یا https://t.me/SalonUsername'
    ),
  paymentExpirationMinutes: z
    .number()
    .int()
    .min(MIN_PAYMENT_EXPIRATION_MINUTES, 'مهلت پرداخت نمی‌تواند کمتر از ۵ دقیقه باشد')
    .max(MAX_PAYMENT_EXPIRATION_MINUTES)
    .optional(),
})

const updateSettingsSchema = z.object({
  name: z.string().trim().min(2, 'نام سالن باید حداقل ۲ حرف باشد').optional(),
  slug: z.string().trim().min(2, 'آدرس اینترنتی باید حداقل ۲ حرف باشد').optional(),
  description: optionalText,
  phone: optionalText,
  address: optionalText,
  city: optionalText,
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
    maxAdvanceBookingDays: z.number().int().min(0).max(365).optional(),
    appearance: appearanceSchema.optional(),
    payment: paymentSchema.optional(),
  }).optional(),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user || !canManageSettings(user.role)) {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)
    if (!salonId) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    const salon = await prisma.salon.findUnique({
      where: { id: salonId },
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
    
    if (!user || !canManageSettings(user.role)) {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }

    const salonId = await getManagerSalonId(user.id, user.salonId)
    if (!salonId) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    const salon = await prisma.salon.findUnique({
      where: { id: salonId },
      select: { id: true, settings: true },
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
      const message = validation.error.issues[0]?.message
      return NextResponse.json(
        { error: message && message !== 'Required' ? message : 'اطلاعات نامعتبر' },
        { status: 400 }
      )
    }

    const { openingHours, settings, ...basicData } = validation.data

    const updated = await prisma.salon.update({
      where: { id: salon.id },
      data: {
        ...basicData,
        ...(openingHours && { openingHours }),
        ...(settings && {
          settings: mergeSalonSettings(salon.settings, settings) as Prisma.InputJsonValue,
        }),
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
