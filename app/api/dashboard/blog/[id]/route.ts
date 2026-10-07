import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { requireManagerUser } from '@/lib/cms-auth'
import { ensureUniqueBlogSlug } from '@/lib/cms-data'
import { buildBlogExcerpt } from '@/lib/blog-metadata'
import { slugifyTitle } from '@/lib/slugify'
import { z } from 'zod'

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  slug: z.string().min(1).max(150).optional(),
  excerpt: z.string().max(2000).optional().nullable(),
  content: z.string().min(1).optional(),
  coverImage: z.string().max(500).optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  publishedAt: z.string().datetime().optional().nullable(),
})

export async function GET(
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

    const post = await prisma.blogPost.findFirst({
      where: { id, salonId: auth.salonId },
    })
    if (!post) {
      return NextResponse.json({ error: 'مقاله یافت نشد' }, { status: 404 })
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error('Blog get error:', error)
    return NextResponse.json({ error: 'خطا در دریافت مقاله' }, { status: 500 })
  }
}

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

    const existing = await prisma.blogPost.findFirst({
      where: { id, salonId: auth.salonId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'مقاله یافت نشد' }, { status: 404 })
    }

    const body = await request.json()
    const validation = patchSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'اطلاعات نامعتبر', details: validation.error.errors }, { status: 400 })
    }

    const patch = validation.data
    let slug = existing.slug
    if (patch.slug !== undefined) {
      slug = await ensureUniqueBlogSlug(auth.salonId, slugifyTitle(patch.slug), id)
    } else if (patch.title !== undefined && patch.title !== existing.title) {
      slug = await ensureUniqueBlogSlug(auth.salonId, slugifyTitle(patch.title), id)
    }

    const salon = await prisma.salon.findUnique({
      where: { id: auth.salonId },
      select: { name: true },
    })

    const nextTitle = patch.title !== undefined ? patch.title.trim() : existing.title
    const nextContent = patch.content !== undefined ? patch.content : existing.content

    let excerpt = existing.excerpt
    if (patch.excerpt !== undefined) {
      excerpt =
        patch.excerpt?.trim() ||
        buildBlogExcerpt(nextContent, 200, nextTitle, salon?.name ?? undefined)
    } else if (patch.content !== undefined) {
      excerpt = buildBlogExcerpt(nextContent, 200, nextTitle, salon?.name ?? undefined)
    }

    let status = patch.status ?? existing.status
    let publishedAt = existing.publishedAt
    if (patch.status === 'PUBLISHED') {
      publishedAt = patch.publishedAt ? new Date(patch.publishedAt) : publishedAt ?? new Date()
    } else if (patch.status === 'DRAFT') {
      publishedAt = null
    } else if (patch.publishedAt !== undefined) {
      publishedAt = patch.publishedAt ? new Date(patch.publishedAt) : null
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        slug,
        excerpt,
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.coverImage !== undefined ? { coverImage: patch.coverImage?.trim() || null } : {}),
        status,
        publishedAt,
      },
    })

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error('Blog patch error:', error)
    return NextResponse.json({ error: 'خطا در ویرایش مقاله' }, { status: 500 })
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

    const existing = await prisma.blogPost.findFirst({
      where: { id, salonId: auth.salonId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'مقاله یافت نشد' }, { status: 404 })
    }

    await prisma.blogPost.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Blog delete error:', error)
    return NextResponse.json({ error: 'خطا در حذف مقاله' }, { status: 500 })
  }
}
