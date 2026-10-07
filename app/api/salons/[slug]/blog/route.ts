import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { listPublishedBlogPosts } from '@/lib/cms-data'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const url = new URL(request.url)
    const limit = Math.min(Number(url.searchParams.get('limit') || 12), 50)

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    })
    if (!salon || !salon.isActive) {
      return NextResponse.json({ error: 'سالن یافت نشد' }, { status: 404 })
    }

    const posts = await listPublishedBlogPosts(salon.id, limit)
    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Public blog list error:', error)
    return NextResponse.json({ error: 'خطا در دریافت مقالات' }, { status: 500 })
  }
}
