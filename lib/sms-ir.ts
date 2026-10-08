const SMS_IR_API_BASE = 'https://api.sms.ir/v1'

export type SmsIrVerifyParameter = { name: string; value: string }

export function normalizeMobileForSmsIr(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null

  let normalized = digits
  if (normalized.startsWith('98') && normalized.length === 12) {
    normalized = normalized.slice(2)
  } else if (normalized.startsWith('0098') && normalized.length === 14) {
    normalized = normalized.slice(4)
  } else if (normalized.startsWith('0') && normalized.length === 11) {
    normalized = normalized.slice(1)
  }

  if (!/^9\d{9}$/.test(normalized)) {
    return null
  }

  return normalized
}

/** Bulk examples in docs accept 09…; keep app storage format when possible. */
export function formatMobileForSmsIrBulk(phone: string): string | null {
  const verify = normalizeMobileForSmsIr(phone)
  if (!verify) return null
  return `0${verify}`
}

export function parseSmsIrResponse(body: unknown): { ok: boolean; message?: string } {
  if (body === null || typeof body !== 'object') {
    return { ok: false, message: 'invalid response' }
  }

  const record = body as Record<string, unknown>
  const status = record.status
  const message = typeof record.message === 'string' ? record.message : undefined

  if (status === 1 || status === '1') {
    return { ok: true, message }
  }

  return { ok: false, message: message ?? 'sms.ir request failed' }
}

async function postSmsIr(
  apiKey: string,
  path: string,
  payload: unknown
): Promise<{ ok: boolean; message?: string }> {
  try {
    const response = await fetch(`${SMS_IR_API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify(payload),
    })

    let body: unknown
    try {
      body = await response.json()
    } catch {
      return { ok: false, message: `HTTP ${response.status}` }
    }

    const parsed = parseSmsIrResponse(body)
    if (!parsed.ok && !response.ok) {
      return { ok: false, message: parsed.message ?? `HTTP ${response.status}` }
    }
    return parsed
  } catch (error) {
    console.error('[SMS] sms.ir request error:', error)
    return { ok: false, message: 'network error' }
  }
}

export async function sendSmsIrVerify(params: {
  apiKey: string
  mobile: string
  templateId: number
  parameters: SmsIrVerifyParameter[]
}): Promise<boolean> {
  const mobile = normalizeMobileForSmsIr(params.mobile)
  if (!mobile) {
    console.error('[SMS] sms.ir verify: invalid mobile', params.mobile)
    return false
  }

  const result = await postSmsIr(params.apiKey, '/send/verify', {
    mobile,
    templateId: params.templateId,
    parameters: params.parameters.map((p) => ({ name: p.name, value: p.value })),
  })

  if (!result.ok) {
    console.error('[SMS] sms.ir verify failed:', result.message)
  }
  return result.ok
}

export async function sendSmsIrBulk(params: {
  apiKey: string
  lineNumber: number
  messageText: string
  mobiles: string[]
}): Promise<boolean> {
  const mobiles = params.mobiles
    .map((m) => formatMobileForSmsIrBulk(m))
    .filter((m): m is string => m !== null)

  if (mobiles.length === 0) {
    console.error('[SMS] sms.ir bulk: no valid mobiles')
    return false
  }

  const result = await postSmsIr(params.apiKey, '/send/bulk', {
    lineNumber: params.lineNumber,
    messageText: params.messageText,
    mobiles,
    sendDateTime: null,
  })

  if (!result.ok) {
    console.error('[SMS] sms.ir bulk failed:', result.message)
  }
  return result.ok
}
