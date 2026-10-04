import { randomUUID } from 'node:crypto'
import { POST as holdPost } from '@/app/api/salons/[slug]/slots/hold/route'
import { POST as checkoutPost } from '@/app/api/salons/[slug]/checkout/route'
import { jsonRequest, routeParams } from './auth'
import type { Salon, Service, Staff, User } from '@prisma/client'

/** Next open weekday (skip Friday if salon closed — here we pick +2 days for stability). */
export function bookingDateKey(daysAhead = 3): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  d.setHours(12, 0, 0, 0)
  return d.toISOString().split('T')[0]
}

export async function holdSlot(input: {
  slug: string
  staffId: string
  serviceId: string
  date?: string
  startTime?: string
  holdToken?: string
}): Promise<{ holdToken: string; date: string; startTime: string; response: Response }> {
  const holdToken = input.holdToken ?? randomUUID()
  const date = input.date ?? bookingDateKey()
  const startTime = input.startTime ?? '10:00'

  const response = await holdPost(
    jsonRequest(`http://localhost/api/salons/${input.slug}/slots/hold`, {
      holdToken,
      date,
      startTime,
      baseServiceIds: [input.serviceId],
      selections: [],
      staffId: input.staffId,
    }),
    routeParams({ slug: input.slug })
  )

  return { holdToken, date, startTime, response }
}

export async function checkoutBooking(input: {
  slug: string
  customer: User
  staffId: string
  serviceId: string
  holdToken: string
  date: string
  startTime: string
  notes?: string
}): Promise<Response> {
  const { asUser } = await import('./auth')
  return asUser(
    { id: input.customer.id, phone: input.customer.phone, role: 'CUSTOMER' },
    () =>
      checkoutPost(
        jsonRequest(`http://localhost/api/salons/${input.slug}/checkout`, {
          baseServiceIds: [input.serviceId],
          selections: [],
          staffId: input.staffId,
          date: input.date,
          startTime: input.startTime,
          holdToken: input.holdToken,
          notes: input.notes,
        }),
        routeParams({ slug: input.slug })
      )
  )
}

export interface BookedSlot {
  appointmentId: string
  trackingCode: string
  paymentId?: string
  holdToken: string
  date: string
  startTime: string
}

export async function bookSlotAsCustomer(ctx: {
  salon: Salon
  customer: User
  staff: Staff
  service: Service
  date?: string
  startTime?: string
}): Promise<BookedSlot> {
  const hold = await holdSlot({
    slug: ctx.salon.slug,
    staffId: ctx.staff.id,
    serviceId: ctx.service.id,
    date: ctx.date,
    startTime: ctx.startTime,
  })
  if (!hold.response.ok) {
    const err = await hold.response.json()
    throw new Error(err.error || `hold failed ${hold.response.status}`)
  }

  const checkoutRes = await checkoutBooking({
    slug: ctx.salon.slug,
    customer: ctx.customer,
    staffId: ctx.staff.id,
    serviceId: ctx.service.id,
    holdToken: hold.holdToken,
    date: hold.date,
    startTime: hold.startTime,
  })
  const body = await checkoutRes.json()
  if (!checkoutRes.ok) {
    throw new Error(body.error || `checkout failed ${checkoutRes.status}`)
  }

  return {
    appointmentId: body.appointment.id,
    trackingCode: body.appointment.trackingCode,
    holdToken: hold.holdToken,
    date: hold.date,
    startTime: hold.startTime,
  }
}
