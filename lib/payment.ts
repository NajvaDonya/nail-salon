const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID
const ZARINPAL_SANDBOX = process.env.ZARINPAL_SANDBOX !== 'false'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

const ZARINPAL_REQUEST_URL = ZARINPAL_SANDBOX
  ? 'https://sandbox.zarinpal.com/pg/v4/payment/request.json'
  : 'https://payment.zarinpal.com/pg/v4/payment/request.json'

const ZARINPAL_VERIFY_URL = ZARINPAL_SANDBOX
  ? 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json'
  : 'https://payment.zarinpal.com/pg/v4/payment/verify.json'

const ZARINPAL_START_URL = ZARINPAL_SANDBOX
  ? 'https://sandbox.zarinpal.com/pg/StartPay'
  : 'https://www.zarinpal.com/pg/StartPay'

export function isPaymentMockMode() {
  return !ZARINPAL_MERCHANT_ID
}

export async function createPaymentRequest(params: {
  amount: number
  description: string
  callbackUrl: string
  mobile?: string
}) {
  if (isPaymentMockMode()) {
    const authority = `MOCK${Date.now().toString(36).toUpperCase()}`
    return {
      authority,
      paymentUrl: `${APP_URL}/api/payments/mock?authority=${authority}`,
    }
  }

  const response = await fetch(ZARINPAL_REQUEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: ZARINPAL_MERCHANT_ID,
      amount: params.amount,
      description: params.description,
      callback_url: params.callbackUrl,
      metadata: params.mobile ? { mobile: params.mobile } : undefined,
    }),
  })

  const data = await response.json()

  if (data.data?.code !== 100 || !data.data?.authority) {
    throw new Error(data.errors?.message || 'خطا در ایجاد درخواست پرداخت')
  }

  return {
    authority: data.data.authority as string,
    paymentUrl: `${ZARINPAL_START_URL}/${data.data.authority}`,
  }
}

export async function verifyPayment(params: { authority: string; amount: number }) {
  if (params.authority.startsWith('MOCK')) {
    return { refId: `MOCK-${Date.now()}`, ok: true }
  }

  const response = await fetch(ZARINPAL_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: ZARINPAL_MERCHANT_ID,
      amount: params.amount,
      authority: params.authority,
    }),
  })

  const data = await response.json()

  if (data.data?.code === 100 || data.data?.code === 101) {
    return { refId: String(data.data.ref_id), ok: true }
  }

  return { refId: null, ok: false }
}
