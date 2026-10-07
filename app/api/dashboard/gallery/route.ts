import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { requireManagerUser } from '@/lib/cms-auth'
import { nextGallerySortOrder } from '@/lib/cms-data'
import { buildGalleryImageMetadata, titleFromImageUrl } from '@/lib/gallery-metadata'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().min(1).max(500),
  originalFileName: z.string().max(255).optional(),
  alt: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
  showInHero: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
})

export async function GET() {
  try {
    const user = await getCurrentUser()
    const auth = await requireManagerUser(user)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const images = await prisma.galleryImage.findMany({
      where: { salonId: auth.salonId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    return NextResponse.json({ images })
  } catch (error) {
    console.error('Gallery list error:', error)
    return NextResponse.json({ error: 'خطا در دریافت گالری' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const auth = await requireManagerUser(user)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const validation = createSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر', details: validation.error.errors }, { status: 400 })
    }

    const data = validation.data
    const isActive = data.isActive ?? true
    const showInHero = isActive ? (data.showInHero ?? false) : false
    const sortOrder = data.sortOrder ?? (await nextGallerySortOrder(auth.salonId))

    const salon = await prisma.salon.findUnique({
      where: { id: auth.salonId },
      select: { name: true },
    })
    const salonName = salon?.name?.trim() || 'سالن'

    let title = data.title?.trim()
    let alt = data.alt?.trim()
    let description = data.description?.trim() || null

    if (!title || !alt) {
      const auto =
        data.originalFileName != null
          ? buildGalleryImageMetadata({
              salonName,
              originalFileName: data.originalFileName,
              sequence: sortOrder + 1,
            })
          : titleFromImageUrl(data.imageUrl.trim(), salonName, sortOrder + 1)
      title = title || auto.title
      alt = alt || auto.alt
      if (description == null && auto.description) {
        description = auto.description
      }
    }

    const image = await prisma.galleryImage.create({
      data: {
        salonId: auth.salonId,
        title,
        description,
        imageUrl: data.imageUrl.trim(),
        alt: alt || title,
        isActive,
        showInHero,
        sortOrder,
      },
    })

    return NextResponse.json({ success: true, image })
  } catch (error) {
    console.error('Gallery create error:', error)
    return NextResponse.json({ error: 'خطا در ثبت تصویر' }, { status: 500 })
  }
}
