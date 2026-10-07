import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getPrimarySalon } from '@/lib/primary-salon'
import { getPublishedBlogPostBySlug } from '@/lib/cms-data'
import { formatPersianDate } from '@/lib/jalali'
import { MarkdownContent } from '@/components/blog/markdown-content'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

interface BlogPostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const salon = await getPrimarySalon()
  const { slug } = await params
  if (!salon) return { title: 'مقاله' }

  const post = await getPublishedBlogPostBySlug(salon.id, slug)
  if (!post) return { title: 'مقاله یافت نشد' }

  const description = post.excerpt?.trim() || post.title
  const canonical = `/blog/${post.slug}`

  return {
    title: post.title,
    description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
      url: canonical,
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const salon = await getPrimarySalon()
  const { slug } = await params
  if (!salon) notFound()

  const post = await getPublishedBlogPostBySlug(salon.id, slug)
  if (!post) notFound()

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <article className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <Link href="/" className="text-sm text-primary hover:underline inline-block">
          ← بازگشت به صفحه اصلی
        </Link>

        {post.coverImage && (
          <div className="relative w-full aspect-[16/9] rounded-2xl overflow-hidden bg-muted">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        )}

        <header className="space-y-3 text-right">
          {post.publishedAt && (
            <p className="text-sm text-muted-foreground">
              {formatPersianDate(new Date(post.publishedAt), 'EEEE d MMMM yyyy')}
            </p>
          )}
          <h1 className="text-3xl font-bold leading-tight">{post.title}</h1>
          {post.excerpt && <p className="text-lg text-muted-foreground">{post.excerpt}</p>}
        </header>

        <MarkdownContent content={post.content} />
      </article>
    </div>
  )
}
