import { describe, it, expect } from 'vitest'
import { computeOccupiedMinutes } from '@/lib/booking-duration'

describe('computeOccupiedMinutes', () => {
  it('sums duration and bufferTime', () => {
    expect(
      computeOccupiedMinutes([
        { duration: 30, bufferTime: 10 },
        { duration: 45, bufferTime: 5 },
      ])
    ).toBe(90)
  })

  it('treats missing bufferTime as zero', () => {
    expect(computeOccupiedMinutes([{ duration: 60 }])).toBe(60)
  })
})
