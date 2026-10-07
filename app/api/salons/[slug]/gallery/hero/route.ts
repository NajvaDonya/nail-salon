import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { listHeroGalleryImages } from '@/lib/cms-data'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    })
    if (!salon || !salon.isActive) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const images = await listHeroGalleryImages(salon.id)
    return NextResponse.json({ images })
  } catch (error) {
    console.error('Hero gallery error:', error)
    return NextResponse.json({ error: 'خطا در دریافت اسلاید Hero' }, { status: 500 })
  }
}
