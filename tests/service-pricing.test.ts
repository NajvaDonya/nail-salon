import { describe, it, expect } from 'vitest'
import { getServiceFinalPrice, sumServicesPrice } from '@/lib/service-pricing'

describe('getServiceFinalPrice', () => {
  it('returns price when no discount', () => {
    expect(getServiceFinalPrice({ price: 100_000 })).toBe(100_000)
  })

  it('returns discountPrice when valid', () => {
    expect(getServiceFinalPrice({ price: 100_000, discountPrice: 80_000 })).toBe(80_000)
  })

  it('ignores invalid discount (>= price)', () => {
    expect(getServiceFinalPrice({ price: 100_000, discountPrice: 100_000 })).toBe(100_000)
    expect(getServiceFinalPrice({ price: 100_000, discountPrice: 150_000 })).toBe(100_000)
  })

  it('ignores zero or negative discount', () => {
    expect(getServiceFinalPrice({ price: 100_000, discountPrice: 0 })).toBe(100_000)
    expect(getServiceFinalPrice({ price: 100_000, discountPrice: -1 })).toBe(100_000)
  })
})

describe('sumServicesPrice', () => {
  it('sums final prices across services', () => {
    expect(
      sumServicesPrice([
        { price: 50_000, discountPrice: 40_000 },
        { price: 30_000 },
      ])
    ).toBe(70_000)
  })
})
