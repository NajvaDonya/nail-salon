import { describe, it, expect } from 'vitest'
import { buildGalleryImageMetadata, titleFromImageUrl } from '@/lib/gallery-metadata'

describe('buildGalleryImageMetadata', () => {
  it('humanizes a readable file name', () => {
    const meta = buildGalleryImageMetadata({
      salonName: 'استودیو ناخن',
      originalFileName: 'classic-manicure-01.jpg',
      sequence: 1,
    })
    expect(meta.title).toBe('classic manicure 01')
    expect(meta.alt).toContain('استودیو ناخن')
    expect(meta.description).toBe('گالری استودیو ناخن')
  })

  it('falls back for uuid-like file names', () => {
    const meta = buildGalleryImageMetadata({
      salonName: 'Test Salon',
      originalFileName: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890.webp',
      sequence: 3,
    })
    expect(meta.title).toBe('نمونه کار Test Salon — 3')
    expect(meta.alt).toContain('Test Salon')
  })

  it('derives metadata from image URL basename', () => {
    const meta = titleFromImageUrl('/uploads/s1/nail-art.png', 'سالن', 2)
    expect(meta.title).toBe('nail art')
  })
})
