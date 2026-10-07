import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { requireManagerUser } from '@/lib/cms-auth'
import { saveUploadedImage } from '@/lib/media/upload'

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const auth = await requireManagerUser(user)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'فایل تصویر الزامی است' }, { status: 400 })
    }

    const saved = await saveUploadedImage(auth.salonId, file)
    return NextResponse.json({ success: true, ...saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در آپلود'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
