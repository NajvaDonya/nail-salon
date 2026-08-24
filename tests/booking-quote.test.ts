import { describe, it, expect } from 'vitest'
import { getServiceFinalPrice } from '@/lib/service-pricing'
import { computeOccupiedMinutes } from '@/lib/booking-duration'

describe('booking quote helpers', () => {
  it('sums multi-service price with discount', () => {
    const services = [
      { price: 500_000, discountPrice: 450_000 },
      { price: 100_000, discountPrice: null },
    ]
    const total = services.reduce((sum, s) => sum + getServiceFinalPrice(s), 0)
    expect(total).toBe(550_000)
  })

  it('computes occupied minutes with quantity expansion', () => {
    const lineItems = [
      { duration: 60, bufferTime: 10, quantity: 1 },
      { duration: 15, bufferTime: 0, quantity: 2 },
    ]
    const expanded = lineItems.flatMap((item) =>
      Array.from({ length: item.quantity }, () => ({
        duration: item.duration,
        bufferTime: item.bufferTime,
      }))
    )
    expect(computeOccupiedMinutes(expanded)).toBe(100)
  })

  it('calculates deposit total from line items', () => {
    const deposits = [
      { deposit: 100_000, quantity: 1 },
      { deposit: 50_000, quantity: 2 },
    ]
    const total = deposits.reduce((sum, item) => sum + item.deposit * item.quantity, 0)
    expect(total).toBe(200_000)
  })

  it('calculates balance due', () => {
    const totalPrice = 900_000
    const depositAmount = 300_000
    expect(Math.max(0, totalPrice - depositAmount)).toBe(600_000)
  })
})
