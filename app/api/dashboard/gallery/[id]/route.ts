import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { requireManagerUser } from '@/lib/cms-auth'
import { deleteLocalUploadIfOwned } from '@/lib/media/upload'
import { z } from 'zod'

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().min(1).max(500).optional(),
  alt: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
  showInHero: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    const auth = await requireManagerUser(user)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const existing = await prisma.galleryImage.findFirst({
      where: { id, salonId: auth.salonId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'تصویر یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = patchSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر', details: validation.error.errors }, { status: 400 })
    }

    const patch = validation.data
    let isActive = patch.isActive ?? existing.isActive
    let showInHero = patch.showInHero ?? existing.showInHero
    if (patch.isActive === false) {
      showInHero = false
    }
    if (showInHero && !isActive) {
      showInHero = false
    }

    const image = await prisma.galleryImage.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.description !== undefined ? { description: patch.description?.trim() || null } : {}),
        ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl.trim() } : {}),
        ...(patch.alt !== undefined ? { alt: patch.alt.trim() } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        isActive,
        showInHero,
      },
    })

    if (patch.imageUrl && existing.imageUrl !== patch.imageUrl) {
      await deleteLocalUploadIfOwned(existing.imageUrl)
    }

    return NextResponse.json({ success: true, image })
  } catch (error) {
    console.error('Gallery patch error:', error)
    return NextResponse.json({ error: 'خطا در ویرایش تصویر' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    const auth = await requireManagerUser(user)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const existing = await prisma.galleryImage.findFirst({
      where: { id, salonId: auth.salonId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'تصویر یافت نشد' }, { status: 404 })
    }

    await prisma.galleryImage.delete({ where: { id } })
    await deleteLocalUploadIfOwned(existing.imageUrl)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Gallery delete error:', error)
    return NextResponse.json({ error: 'خطا در حذف تصویر' }, { status: 500 })
  }
}
