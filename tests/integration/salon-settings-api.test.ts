import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { parseSalonSettings } from '@/lib/salon-settings'
import { PATCH as settingsPatch, GET as settingsGet } from '@/app/api/dashboard/settings/route'
import { prisma, resetDb, seedManager, seedSalon, seedCustomer, TEST_SALON_PAYMENT } from '../helpers/db'
import { asUser, jsonRequest } from '../helpers/auth'

describe('salon payment settings (API)', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('lets manager save and update payment fields with validation', async () => {
    const salon = await seedSalon({
      settings: {
        allowOnlineBooking: true,
        requireConfirmation: false,
        maxAdvanceBookingDays: 30,
        sendReminders: false,
        reminderHours: 24,
        payment: {
          bankCardNumber: '',
          bankAccountOwner: '',
          paymentPhone: '',
          telegramReceiptUrl: '',
          paymentExpirationMinutes: 30,
        },
      },
    })
    const manager = await seedManager(salon.id)

    await asUser(
      { id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id },
      async () => {
        const bad = await settingsPatch(
          jsonRequest('http://localhost/api/dashboard/settings', {
            settings: {
              payment: {
                bankCardNumber: '1234',
                telegramReceiptUrl: 'https://evil.example/t.me',
              },
            },
          })
        )
        expect(bad.status).toBe(400)

        const good = await settingsPatch(
          jsonRequest('http://localhost/api/dashboard/settings', {
            settings: {
              payment: {
                bankCardNumber: '6037000000000000',
                bankAccountOwner: 'صاحب حساب',
                paymentPhone: '09121234567',
                telegramReceiptUrl: '@MySalonBot',
                paymentExpirationMinutes: 45,
              },
            },
          })
        )
        expect(good.status).toBe(200)

        const loaded = await settingsGet()
        const body = await loaded.json()
        const parsed = parseSalonSettings(body.salon.settings)
        expect(parsed.payment.bankCardNumber).toBe('6037000000000000')
        expect(parsed.payment.telegramReceiptUrl).toBe('https://t.me/MySalonBot')
        expect(parsed.payment.paymentExpirationMinutes).toBe(45)
      }
    )
  })

  it('defaults expiration to 30 when omitted in stored settings', async () => {
    const salon = await seedSalon()
    const parsed = parseSalonSettings(salon.settings)
    expect(parsed.payment.paymentExpirationMinutes).toBe(30)
  })

  it('blocks customers from updating settings', async () => {
    await seedSalon()
    const customer = await seedCustomer()
    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      const res = await settingsPatch(
        jsonRequest('http://localhost/api/dashboard/settings', {
          settings: { payment: TEST_SALON_PAYMENT },
        })
      )
      expect(res.status).toBe(403)
    })
  })
})
