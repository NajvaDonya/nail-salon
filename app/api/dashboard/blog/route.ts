import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { requireManagerUser } from '@/lib/cms-auth'
import { ensureUniqueBlogSlug } from '@/lib/cms-data'
import { buildBlogExcerpt } from '@/lib/blog-metadata'
import { slugifyTitle } from '@/lib/slugify'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(150).optional(),
  excerpt: z.string().max(2000).optional().nullable(),
  content: z.string().min(1),
  coverImage: z.string().max(500).optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  publishedAt: z.string().datetime().optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    const auth = await requireManagerUser(user)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')

    const posts = await prisma.blogPost.findMany({
      where: {
        salonId: auth.salonId,
        ...(status === 'DRAFT' || status === 'PUBLISHED' ? { status } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
    })

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Blog list error:', error)
    return NextResponse.json({ error: 'خطا در دریافت مقالات' }, { status: 500 })
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
    const salon = await prisma.salon.findUnique({
      where: { id: auth.salonId },
      select: { name: true },
    })
    const baseSlug = slugifyTitle(data.slug?.trim() || data.title)
    const slug = await ensureUniqueBlogSlug(auth.salonId, baseSlug)
    const excerpt =
      data.excerpt?.trim() ||
      buildBlogExcerpt(data.content, 200, data.title, salon?.name ?? undefined)
    const status = data.status ?? 'DRAFT'
    const publishedAt =
      status === 'PUBLISHED'
        ? data.publishedAt
          ? new Date(data.publishedAt)
          : new Date()
        : null

    const post = await prisma.blogPost.create({
      data: {
        salonId: auth.salonId,
        title: data.title.trim(),
        slug,
        excerpt,
        content: data.content,
        coverImage: data.coverImage?.trim() || null,
        status,
        publishedAt,
      },
    })

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error('Blog create error:', error)
    return NextResponse.json({ error: 'خطا در ثبت مقاله' }, { status: 500 })
  }
}
