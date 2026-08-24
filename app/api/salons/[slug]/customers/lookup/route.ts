import { NextResponse } from 'next/server'

/** Public customer lookup disabled — use /api/dashboard/customers/lookup */
export async function GET() {
  return NextResponse.json(
    {
      error: 'دسترسی غیرمجاز — از پنل مدیریت استفاده کنید',
      useEndpoint: '/api/dashboard/customers/lookup',
    },
    { status: 401 }
  )
}
