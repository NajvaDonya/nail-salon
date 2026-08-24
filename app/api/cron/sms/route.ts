import { NextResponse } from 'next/server'
import { runSmsReminderJobs } from '@/lib/sms-jobs'

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await runSmsReminderJobs()
    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('SMS cron error:', error)
    return NextResponse.json({ error: 'SMS job failed' }, { status: 500 })
  }
}
