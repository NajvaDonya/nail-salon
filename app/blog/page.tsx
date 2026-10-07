import Link from 'next/link'
import Image from 'next/image'
import { getPrimarySalon } from '@/lib/primary-salon'
import { listPublishedBlogPosts } from '@/lib/cms-data'
import { formatPersianDate } from '@/lib/jalali'
import { Card, CardContent } from '@/components/ui/card'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const salon = await getPrimarySalon()
  const title = salon?.name ? `مجله ${salon.name}` : 'مجله زیبایی'
  return {
    title,
    description: salon?.description || 'مقالات و نکات زیبایی',
  }
}

export default async function BlogIndexPage() {
  const salon = await getPrimarySalon()
  if (!salon) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p className="text-muted-foreground">مقاله‌ای یافت نشد.</p>
      </div>
    )
  }

  const posts = await listPublishedBlogPosts(salon.id, 50)

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <main className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <Link href="/" className="text-sm text-primary hover:underline inline-block">
          ← بازگشت به صفحه اصلی
        </Link>
        <header className="text-right space-y-2">
          <h1 className="text-3xl font-bold">{salon.name ? `مجله ${salon.name}` : 'مجله زیبایی'}</h1>
          <p className="text-muted-foreground text-sm">جدیدترین مقالات منتشرشده</p>
        </header>

        {posts.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">هنوز مقاله‌ای منتشر نشده است.</p>
        ) : (
          <div className="grid gap-4">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row">
                    {post.coverImage && (
                      <div className="relative w-full sm:w-48 aspect-[16/10] sm:aspect-auto sm:min-h-[120px] shrink-0">
                        <Image src={post.coverImage} alt={post.title} fill className="object-cover" sizes="192px" />
                      </div>
                    )}
                    <CardContent className="p-5 space-y-2 flex-1 text-right">
                      {post.publishedAt && (
                        <p className="text-xs text-muted-foreground">
                          {formatPersianDate(new Date(post.publishedAt), 'd MMMM yyyy')}
                        </p>
                      )}
                      <h2 className="text-lg font-semibold">{post.title}</h2>
                      {post.excerpt && <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>}
                    </CardContent>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
