// SMS Service abstraction layer
// Configure your SMS provider via environment variables

interface SMSProvider {
  sendOTP(phone: string, code: string): Promise<boolean>
  sendReminder(phone: string, message: string): Promise<boolean>
  sendNotification(phone: string, message: string): Promise<boolean>
}

// Generic SMS sending function - configure based on your provider
async function sendSMS(phone: string, message: string): Promise<boolean> {
  const provider = process.env.SMS_PROVIDER || 'console'
  const apiKey = process.env.SMS_API_KEY
  const apiUrl = process.env.SMS_API_URL

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
          'Authorization': `Bearer ${apiKey}`,
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
  async sendOTP(phone: string, code: string): Promise<boolean> {
    const message = `کد تایید شما: ${code}\nاین کد تا ۵ دقیقه معتبر است.\n\nفیر سالن`
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
