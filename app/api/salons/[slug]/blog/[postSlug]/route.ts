import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPublishedBlogPostBySlug } from '@/lib/cms-data'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; postSlug: string }> }
) {
  try {
    const { slug, postSlug } = await params
    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    })
    if (!salon || !salon.isActive) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const post = await getPublishedBlogPostBySlug(salon.id, postSlug)
    if (!post) {
      return NextResponse.json({ error: 'مقاله یافت نشد' }, { status: 404 })
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error('Public blog detail error:', error)
    return NextResponse.json({ error: 'خطا در دریافت مقاله' }, { status: 500 })
  }
}
