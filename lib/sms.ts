// SMS Service abstraction layer
// Configure your SMS provider via environment variables

import { sendSmsIrBulk, sendSmsIrVerify } from '@/lib/sms-ir'

interface SMSProvider {
  sendOTP(phone: string, code: string, salonName?: string | null): Promise<boolean>
  sendReminder(phone: string, message: string): Promise<boolean>
  sendNotification(phone: string, message: string): Promise<boolean>
}

function getSmsIrConfig() {
  const apiKey = process.env.SMS_IR_API_KEY?.trim()
  const templateOtp = process.env.SMS_IR_TEMPLATE_OTP?.trim()
  const lineNumberRaw = process.env.SMS_IR_LINE_NUMBER?.trim()
  const lineNumber = lineNumberRaw ? Number(lineNumberRaw) : NaN

  return {
    apiKey,
    templateOtpId: templateOtp ? Number(templateOtp) : NaN,
    lineNumber,
    otpParamCode: process.env.SMS_IR_OTP_PARAM_CODE?.trim() || 'CODE',
    otpParamSalon: process.env.SMS_IR_OTP_PARAM_SALON?.trim() || '',
  }
}

async function sendSmsIrOtp(
  phone: string,
  code: string,
  salonName?: string | null
): Promise<boolean> {
  const { apiKey, templateOtpId, otpParamCode, otpParamSalon } = getSmsIrConfig()

  if (!apiKey || !Number.isFinite(templateOtpId)) {
    console.error('[SMS] sms.ir OTP: set SMS_IR_API_KEY and SMS_IR_TEMPLATE_OTP')
    return false
  }

  const parameters: { name: string; value: string }[] = [
    { name: otpParamCode, value: code },
  ]

  const salon = salonName?.trim()
  if (otpParamSalon && salon) {
    parameters.push({ name: otpParamSalon, value: salon })
  }

  return sendSmsIrVerify({
    apiKey,
    mobile: phone,
    templateId: templateOtpId,
    parameters,
  })
}

async function sendSmsIrText(phone: string, message: string): Promise<boolean> {
  const { apiKey, lineNumber } = getSmsIrConfig()

  if (!apiKey || !Number.isFinite(lineNumber)) {
    console.error('[SMS] sms.ir bulk: set SMS_IR_API_KEY and SMS_IR_LINE_NUMBER')
    return false
  }

  return sendSmsIrBulk({
    apiKey,
    lineNumber,
    messageText: message,
    mobiles: [phone],
  })
}

// Generic SMS sending function - configure based on your provider
async function sendSMS(phone: string, message: string): Promise<boolean> {
  const provider = process.env.SMS_PROVIDER || 'console'
  const apiKey = process.env.SMS_API_KEY
  const apiUrl = process.env.SMS_API_URL

  if (provider === 'smsir') {
    return sendSmsIrText(phone, message)
  }

  // Development mode with explicit console provider only
  if (provider === 'console') {
    console.log(`[SMS] To: ${phone}`)
    console.log(`[SMS] Message: ${message}`)
    return true
  }

  // Generic HTTP API provider
  if (provider === 'http' && apiUrl && apiKey) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          receptor: phone,
          message: message,
        }),
      })
      return response.ok
    } catch (error) {
      console.error('[SMS] Error sending SMS:', error)
      return false
    }
  }

  // Kavenegar provider (popular in Iran)
  if (provider === 'kavenegar' && apiKey) {
    try {
      const url = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          receptor: phone,
          message: message,
        }),
      })
      const data = await response.json()
      return data.return?.status === 200
    } catch (error) {
      console.error('[SMS] Kavenegar error:', error)
      return false
    }
  }

  console.warn('[SMS] No valid SMS provider configured')
  return false
}

export const smsService: SMSProvider = {
  async sendOTP(phone: string, code: string, salonName?: string | null): Promise<boolean> {
    const provider = process.env.SMS_PROVIDER || 'console'

    if (provider === 'smsir') {
      return sendSmsIrOtp(phone, code, salonName)
    }

    const name = salonName?.trim()
    const message = name
      ? `کد تایید شما: ${code}\nاین کد تا ۵ دقیقه معتبر است.\n\n${name}`
      : `کد تایید شما: ${code}\nاین کد تا ۵ دقیقه معتبر است.`
    return sendSMS(phone, message)
  },

  async sendReminder(phone: string, message: string): Promise<boolean> {
    return sendSMS(phone, message)
  },

  async sendNotification(phone: string, message: string): Promise<boolean> {
    return sendSMS(phone, message)
  },
}

// Appointment reminder templates
export const smsTemplates = {
  appointmentConfirmed: (customerName: string, serviceName: string, date: string, time: string, salonName: string) =>
    `${customerName} عزیز، نوبت شما برای ${serviceName} در تاریخ ${date} ساعت ${time} در ${salonName} تایید شد.`,

  appointmentReminder: (customerName: string, serviceName: string, time: string, salonName: string) =>
    `${customerName} عزیز، یادآوری: نوبت شما برای ${serviceName} امروز ساعت ${time} در ${salonName} است.`,

  appointmentCancelled: (customerName: string, serviceName: string, date: string, salonName: string) =>
    `${customerName} عزیز، نوبت شما برای ${serviceName} در تاریخ ${date} در ${salonName} لغو شد.`,

  newAppointmentStaff: (staffName: string, customerName: string, serviceName: string, date: string, time: string) =>
    `${staffName} عزیز، نوبت جدید: ${customerName} - ${serviceName} - ${date} ساعت ${time}`,
}

export async function sendAppointmentConfirmation(
  phone: string,
  details: {
    salonName: string
    trackingCode: string
    date: string
    time: string
    staffName: string
    services: string
    customerName?: string
  }
): Promise<boolean> {
  const customerName = details.customerName || 'مشتری'
  const message = [
    smsTemplates.appointmentConfirmed(
      customerName,
      details.services,
      details.date,
      details.time,
      details.salonName
    ),
    `کد پیگیری: ${details.trackingCode}`,
    `پرسنل: ${details.staffName}`,
  ].join('\n')

  return smsService.sendNotification(phone, message)
}
