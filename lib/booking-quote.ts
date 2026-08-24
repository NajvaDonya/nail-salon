import type { PrismaClient } from '@prisma/client'
import { getServiceFinalPrice } from '@/lib/service-pricing'
import { computeOccupiedMinutes } from '@/lib/booking-duration'

export interface ServiceSelection {
  serviceId: string
  quantity: number
}

export interface QuoteLineItem {
  serviceId: string
  name: string
  quantity: number
  duration: number
  bufferTime: number
  price: number
  finalPrice: number
  deposit: number
  kind: 'BASE' | 'ADDON'
}

export interface BookingQuote {
  lineItems: QuoteLineItem[]
  serviceIds: string[]
  occupiedMinutes: number
  totalPrice: number
  depositAmount: number
  balanceDue: number
  qualifiedStaffIds: string[]
}

type DbClient = Pick<PrismaClient, 'service' | 'serviceAddon' | 'staff' | 'staffService'>

export class BookingQuoteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BookingQuoteError'
  }
}

function clampQuantity(quantity: number, allowQuantity: boolean, maxQuantity: number | null): number {
  const qty = allowQuantity ? Math.max(1, Math.floor(quantity)) : 1
  if (maxQuantity != null && qty > maxQuantity) {
    throw new BookingQuoteError(`حداکثر تعداد مجاز ${maxQuantity} است`)
  }
  return qty
}

function lineFromService(
  service: {
    id: string
    name: string
    price: number
    discountPrice: number | null
    depositAmount: number
    duration: number
    bufferTime: number
    allowQuantity: boolean
    maxQuantity: number | null
    kind: 'BASE' | 'ADDON'
  },
  quantity: number
): QuoteLineItem {
  const qty = clampQuantity(quantity, service.allowQuantity, service.maxQuantity)
  const unitFinalPrice = getServiceFinalPrice(service)
  return {
    serviceId: service.id,
    name: service.name,
    quantity: qty,
    duration: service.duration,
    bufferTime: service.bufferTime,
    price: service.price,
    finalPrice: unitFinalPrice * qty,
    deposit: service.depositAmount * qty,
    kind: service.kind,
  }
}

function occupiedFromLineItems(lineItems: QuoteLineItem[]): number {
  return computeOccupiedMinutes(
    lineItems.flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        duration: item.duration,
        bufferTime: item.bufferTime,
      }))
    )
  )
}

export async function computeQualifiedStaffIds(
  db: DbClient,
  salonId: string,
  serviceIds: string[]
): Promise<string[]> {
  if (serviceIds.length === 0) return []

  const staffLinks = await db.staffService.findMany({
    where: {
      serviceId: { in: serviceIds },
      staff: { salonId, isActive: true, user: { isActive: true } },
    },
    select: { staffId: true, serviceId: true },
  })

  const byStaff = new Map<string, Set<string>>()
  for (const link of staffLinks) {
    if (!byStaff.has(link.staffId)) byStaff.set(link.staffId, new Set())
    byStaff.get(link.staffId)!.add(link.serviceId)
  }

  return [...byStaff.entries()]
    .filter(([, services]) => serviceIds.every((id) => services.has(id)))
    .map(([staffId]) => staffId)
}

export async function computeBookingQuote(
  db: DbClient,
  params: {
    salonId: string
    baseServiceIds: string[]
    selections: ServiceSelection[]
    preferredStaffId?: string | null
  }
): Promise<BookingQuote> {
  const { salonId, baseServiceIds, selections, preferredStaffId } = params

  if (baseServiceIds.length === 0) {
    throw new BookingQuoteError('حداقل یک خدمت انتخاب کنید')
  }

  const uniqueBaseIds = [...new Set(baseServiceIds)]
  const baseServices = await db.service.findMany({
    where: { id: { in: uniqueBaseIds }, salonId, isActive: true, kind: 'BASE' },
  })

  if (baseServices.length !== uniqueBaseIds.length) {
    throw new BookingQuoteError('خدمات پایه انتخاب‌شده معتبر نیست')
  }

  const selectionMap = new Map<string, number>()
  for (const baseId of uniqueBaseIds) {
    selectionMap.set(baseId, 1)
  }

  for (const sel of selections) {
    if (uniqueBaseIds.includes(sel.serviceId)) {
      const base = baseServices.find((s) => s.id === sel.serviceId)!
      selectionMap.set(sel.serviceId, clampQuantity(sel.quantity, base.allowQuantity, base.maxQuantity))
      continue
    }
    const current = selectionMap.get(sel.serviceId) ?? 0
    selectionMap.set(sel.serviceId, current + Math.max(1, Math.floor(sel.quantity)))
  }

  const addonIds = [...selectionMap.keys()].filter((id) => !uniqueBaseIds.includes(id))
  if (addonIds.length > 0) {
    const links = await db.serviceAddon.findMany({
      where: {
        baseServiceId: { in: uniqueBaseIds },
        addonServiceId: { in: addonIds },
      },
    })
    const allowedAddonIds = new Set(links.map((l) => l.addonServiceId))
    for (const addonId of addonIds) {
      if (!allowedAddonIds.has(addonId)) {
        throw new BookingQuoteError('افزونه انتخاب‌شده برای خدمات پایه مجاز نیست')
      }
    }
  }

  const allServiceIds = [...selectionMap.keys()]
  const allServices = await db.service.findMany({
    where: { id: { in: allServiceIds }, salonId, isActive: true },
  })

  if (allServices.length !== allServiceIds.length) {
    throw new BookingQuoteError('برخی خدمات انتخاب‌شده معتبر نیست')
  }

  const lineItems: QuoteLineItem[] = []
  for (const service of allServices) {
    const qty = selectionMap.get(service.id) ?? 1
    if (service.kind === 'ADDON' && qty <= 0) continue
    lineItems.push(lineFromService(service, qty))
  }

  lineItems.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name, 'fa')
    return a.kind === 'BASE' ? -1 : 1
  })

  const totalPrice = lineItems.reduce((sum, item) => sum + item.finalPrice, 0)
  const depositAmount = lineItems.reduce((sum, item) => sum + item.deposit, 0)
  const balanceDue = Math.max(0, totalPrice - depositAmount)
  const occupiedMinutes = occupiedFromLineItems(lineItems)
  const serviceIds = lineItems.map((item) => item.serviceId)

  let qualifiedStaffIds = await computeQualifiedStaffIds(db, salonId, serviceIds)

  if (preferredStaffId) {
    if (!qualifiedStaffIds.includes(preferredStaffId)) {
      throw new BookingQuoteError('پرسنل انتخاب‌شده برای این خدمات واجد شرایط نیست')
    }
    qualifiedStaffIds = [preferredStaffId]
  }

  return {
    lineItems,
    serviceIds,
    occupiedMinutes,
    totalPrice,
    depositAmount,
    balanceDue,
    qualifiedStaffIds,
  }
}

export function buildAppointmentSnapshots(lineItems: QuoteLineItem[]) {
  return lineItems.map((item) => ({
    serviceId: item.serviceId,
    serviceName: item.name,
    price: item.price,
    finalPrice: item.finalPrice,
    duration: item.duration,
    bufferTime: item.bufferTime,
    depositAmount: item.deposit,
    quantity: item.quantity,
  }))
}

export function parseSelectionsParam(raw: string | null): ServiceSelection[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as ServiceSelection[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => item?.serviceId && typeof item.serviceId === 'string')
      .map((item) => ({
        serviceId: item.serviceId,
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      }))
  } catch {
    return []
  }
}

export async function resolveQuoteForSalon(
  db: DbClient,
  salonId: string,
  params: {
    baseServiceIds?: string[]
    serviceIds?: string[]
    selections?: ServiceSelection[]
    preferredStaffId?: string | null
  }
): Promise<BookingQuote> {
  const baseServiceIds =
    params.baseServiceIds?.length
      ? params.baseServiceIds
      : params.serviceIds?.length
        ? params.serviceIds
        : []

  return computeBookingQuote(db, {
    salonId,
    baseServiceIds,
    selections: mergeSelections(baseServiceIds, params.selections ?? []),
    preferredStaffId: params.preferredStaffId,
  })
}

export function mergeSelections(
  baseServiceIds: string[],
  addonSelections: ServiceSelection[]
): ServiceSelection[] {
  const merged: ServiceSelection[] = baseServiceIds.map((serviceId) => ({
    serviceId,
    quantity: 1,
  }))
  for (const sel of addonSelections) {
    if (baseServiceIds.includes(sel.serviceId)) {
      const existing = merged.find((m) => m.serviceId === sel.serviceId)
      if (existing) existing.quantity = sel.quantity
    } else {
      merged.push(sel)
    }
  }
  return merged
}
