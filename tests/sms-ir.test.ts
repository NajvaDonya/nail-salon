import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatMobileForSmsIrBulk,
  normalizeMobileForSmsIr,
  parseSmsIrResponse,
  sendSmsIrVerify,
} from '@/lib/sms-ir'

describe('sms.ir helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('normalizeMobileForSmsIr', () => {
    it('converts 09… to 9…', () => {
      expect(normalizeMobileForSmsIr('09123456789')).toBe('9123456789')
    })

    it('strips spaces and punctuation', () => {
      expect(normalizeMobileForSmsIr('0912 345 6789')).toBe('9123456789')
    })

    it('accepts +98 prefix', () => {
      expect(normalizeMobileForSmsIr('+989123456789')).toBe('9123456789')
    })

    it('rejects invalid numbers', () => {
      expect(normalizeMobileForSmsIr('08123456789')).toBeNull()
      expect(normalizeMobileForSmsIr('123')).toBeNull()
    })
  })

  describe('formatMobileForSmsIrBulk', () => {
    it('returns 0-prefixed mobile', () => {
      expect(formatMobileForSmsIrBulk('9123456789')).toBe('09123456789')
    })
  })

  describe('parseSmsIrResponse', () => {
    it('treats status 1 as success', () => {
      expect(parseSmsIrResponse({ status: 1, message: 'موفق' })).toEqual({
        ok: true,
        message: 'موفق',
      })
    })

    it('treats non-1 status as failure', () => {
      expect(parseSmsIrResponse({ status: 0, message: 'خطا' }).ok).toBe(false)
    })
  })

  describe('sendSmsIrVerify', () => {
    it('posts verify payload with normalized mobile', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 1, message: 'موفق', data: { messageId: 1, cost: 1 } }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const ok = await sendSmsIrVerify({
        apiKey: 'test-key',
        mobile: '09123456789',
        templateId: 100,
        parameters: [{ name: 'CODE', value: '654321' }],
      })

      expect(ok).toBe(true)
      expect(fetchMock).toHaveBeenCalledOnce()
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(init.method).toBe('POST')
      expect((init.headers as Record<string, string>)['X-API-KEY']).toBe('test-key')
      const body = JSON.parse(init.body as string)
      expect(body.mobile).toBe('9123456789')
      expect(body.templateId).toBe(100)
      expect(body.parameters).toEqual([{ name: 'CODE', value: '654321' }])
    })
  })
})
