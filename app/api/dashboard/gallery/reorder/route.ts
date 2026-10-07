import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { requireManagerUser } from '@/lib/cms-auth'
import { z } from 'zod'

const schema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
})

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser()
    const auth = await requireManagerUser(user)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر', details: validation.error.errors }, { status: 400 })
    }

    const ids = validation.data.orderedIds
    const rows = await prisma.galleryImage.findMany({
      where: { salonId: auth.salonId, id: { in: ids } },
      select: { id: true },
    })
    if (rows.length !== ids.length) {
      return NextResponse.json({ error: 'برخی تصاویر یافت نشدند' }, { status: 400 })
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.galleryImage.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Gallery reorder error:', error)
    return NextResponse.json({ error: 'خطا در مرتب‌سازی' }, { status: 500 })
  }
}
