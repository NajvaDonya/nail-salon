const HOLD_TOKEN_KEY = 'slot-hold-token'

export function getHoldToken(): string {
  if (typeof window === 'undefined') return ''

  let token = sessionStorage.getItem(HOLD_TOKEN_KEY)
  if (!token) {
    token = crypto.randomUUID()
    sessionStorage.setItem(HOLD_TOKEN_KEY, token)
  }

  return token
}

export async function releaseHoldToken(holdToken: string, holdUrl: string) {
  if (!holdToken) return

  try {
    await fetch(holdUrl, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ holdToken }),
    })
  } catch {
    // Best-effort cleanup when closing the form
  }
}
