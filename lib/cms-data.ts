import { prisma } from './db'
import type { BlogPostStatus } from '@prisma/client'

export async function listHeroGalleryImages(salonId: string) {
  return prisma.galleryImage.findMany({
    where: { salonId, isActive: true, showInHero: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      title: true,
      description: true,
      imageUrl: true,
      alt: true,
      sortOrder: true,
    },
  })
}

export async function listPublishedBlogPosts(salonId: string, limit = 12) {
  return prisma.blogPost.findMany({
    where: { salonId, status: 'PUBLISHED' },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      publishedAt: true,
    },
  })
}

export async function getPublishedBlogPostBySlug(salonId: string, slug: string) {
  return prisma.blogPost.findFirst({
    where: { salonId, slug, status: 'PUBLISHED' },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      publishedAt: true,
      updatedAt: true,
    },
  })
}

export async function nextGallerySortOrder(salonId: string): Promise<number> {
  const last = await prisma.galleryImage.findFirst({
    where: { salonId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  return (last?.sortOrder ?? -1) + 1
}

export async function ensureUniqueBlogSlug(
  salonId: string,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug
  let n = 1
  for (;;) {
    const existing = await prisma.blogPost.findFirst({
      where: {
        salonId,
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    })
    if (!existing) return slug
    n += 1
    slug = `${baseSlug}-${n}`
  }
}

export function parseBlogStatus(value: unknown): BlogPostStatus | null {
  if (value === 'DRAFT' || value === 'PUBLISHED') return value
  return null
}

export function resolveBlogSectionTitle(settings: unknown, salonName?: string | null): string {
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    const cms = (settings as Record<string, unknown>).cms
    if (cms && typeof cms === 'object' && !Array.isArray(cms)) {
      const title = (cms as Record<string, unknown>).blogSectionTitle
      if (typeof title === 'string' && title.trim()) return title.trim()
    }
  }
  const name = salonName?.trim()
  return name ? `مجله ${name}` : 'مجله زیبایی'
}
