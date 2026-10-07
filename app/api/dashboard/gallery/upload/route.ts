import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { requireManagerUser } from '@/lib/cms-auth'
import { nextGallerySortOrder } from '@/lib/cms-data'
import { buildGalleryImageMetadata } from '@/lib/gallery-metadata'
import { saveUploadedImage } from '@/lib/media/upload'

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    const auth = await requireManagerUser(user)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const salon = await prisma.salon.findUnique({
      where: { id: auth.salonId },
      select: { name: true },
    })
    const salonName = salon?.name?.trim() || 'سالن'

    const form = await request.formData()
    const entries = form.getAll('files')
    const files = entries.filter((entry): entry is File => entry instanceof File)

    if (files.length === 0) {
      const single = form.get('file')
      if (single instanceof File) {
        files.push(single)
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'حداقل یک تصویر انتخاب کنید' }, { status: 400 })
    }

    let sortOrder = await nextGallerySortOrder(auth.salonId)
    const images = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const saved = await saveUploadedImage(auth.salonId, file)
      const meta = buildGalleryImageMetadata({
        salonName,
        originalFileName: file.name,
        sequence: i + 1,
      })

      const image = await prisma.galleryImage.create({
        data: {
          salonId: auth.salonId,
          title: meta.title,
          description: meta.description,
          imageUrl: saved.imageUrl,
          alt: meta.alt,
          isActive: true,
          showInHero: false,
          sortOrder,
        },
      })
      images.push(image)
      sortOrder += 1
    }

    return NextResponse.json({ success: true, images, count: images.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در آپلود گالری'
    console.error('Gallery batch upload error:', error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
