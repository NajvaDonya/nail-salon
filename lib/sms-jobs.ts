import { prisma } from '@/lib/db'
import { smsService, smsTemplates } from '@/lib/sms'
import { parseSalonSettings } from '@/lib/salon-settings'
import type { SmsType } from '@prisma/client'

const MAX_SMS_ATTEMPTS = 3

async function sendAndLog(params: {
  appointmentId: string
  phone: string
  type: SmsType
  message: string
}) {
  const existing = await prisma.smsLog.findUnique({
    where: {
      appointmentId_type: {
        appointmentId: params.appointmentId,
        type: params.type,
      },
    },
  })

  if (existing?.status === 'SENT') {
    return { skipped: true }
  }

  const log =
    existing ??
    (await prisma.smsLog.create({
      data: {
        appointmentId: params.appointmentId,
        phone: params.phone,
        type: params.type,
        message: params.message,
        status: 'PENDING',
      },
    }))

  if (log.attempts >= MAX_SMS_ATTEMPTS) {
    return { skipped: true, failed: true }
  }

  const ok = await smsService.sendNotification(params.phone, params.message)

  await prisma.smsLog.update({
    where: { id: log.id },
    data: {
      attempts: { increment: 1 },
      status: ok ? 'SENT' : 'FAILED',
      sentAt: ok ? new Date() : null,
      lastError: ok ? null : 'send failed',
    },
  })

  return { ok }
}

export async function runSmsReminderJobs() {
  const now = new Date()
  const results = { reminders: 0, postService: 0, reviewRequests: 0, errors: 0 }

  const salons = await prisma.salon.findMany({
    where: { isActive: true },
    select: { id: true, settings: true },
  })

  for (const salon of salons) {
    const settings = parseSalonSettings(salon.settings)
    if (!settings.sendReminders) continue

    const reminderCutoff = new Date(now.getTime() + settings.reminderHours * 60 * 60 * 1000)

    const upcoming = await prisma.appointment.findMany({
      where: {
        salonId: salon.id,
        status: 'CONFIRMED',
        startTime: { gte: now, lte: reminderCutoff },
      },
      include: {
        customer: { select: { phone: true, firstName: true, lastName: true } },
        services: { select: { serviceName: true } },
        salon: { select: { name: true } },
      },
    })

    for (const apt of upcoming) {
      const customerName =
        [apt.customer.firstName, apt.customer.lastName].filter(Boolean).join(' ') || 'مشتری'
      const serviceName = apt.services.map((s) => s.serviceName).join('، ') || 'خدمات'
      const time = apt.startTime.toLocaleTimeString('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const message = smsTemplates.appointmentReminder(
        customerName,
        serviceName,
        time,
        apt.salon.name
      )

      try {
        const result = await sendAndLog({
          appointmentId: apt.id,
          phone: apt.customer.phone,
          type: 'REMINDER',
          message,
        })
        if (!result.skipped && result.ok) results.reminders++
      } catch {
        results.errors++
      }
    }
  }

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const completedRecent = await prisma.appointment.findMany({
    where: {
      status: 'COMPLETED',
      endTime: { gte: dayAgo, lte: now },
    },
    include: {
      customer: { select: { phone: true, firstName: true, lastName: true } },
      services: { select: { serviceName: true } },
      salon: { select: { name: true } },
      reviews: { select: { id: true } },
    },
  })

  for (const apt of completedRecent) {
    const customerName =
      [apt.customer.firstName, apt.customer.lastName].filter(Boolean).join(' ') || 'مشتری'
    const serviceName = apt.services.map((s) => s.serviceName).join('، ') || 'خدمات'

    try {
      const postMsg = `${customerName} عزیز، از اینکه به ${apt.salon.name} مراجعه کردید سپاسگزاریم.`
      const postResult = await sendAndLog({
        appointmentId: apt.id,
        phone: apt.customer.phone,
        type: 'POST_SERVICE',
        message: postMsg,
      })
      if (!postResult.skipped && postResult.ok) results.postService++

      if (apt.reviews.length === 0) {
        const reviewMsg = `${customerName} عزیز، نظر شما درباره ${serviceName} برای ما ارزشمند است.`
        const reviewResult = await sendAndLog({
          appointmentId: apt.id,
          phone: apt.customer.phone,
          type: 'REVIEW_REQUEST',
          message: reviewMsg,
        })
        if (!reviewResult.skipped && reviewResult.ok) results.reviewRequests++
      }
    } catch {
      results.errors++
    }
  }

  return results
}
