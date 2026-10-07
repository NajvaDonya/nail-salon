'use client'

import Link from 'next/link'
import Image from 'next/image'
import { formatPersianDate } from '@/lib/jalali'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface BlogSlidePost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverImage: string | null
  publishedAt: string | Date | null
}

interface BlogSliderSectionProps {
  title: string
  posts: BlogSlidePost[]
}

export function BlogSliderSection({ title, posts }: BlogSliderSectionProps) {
  if (posts.length === 0) return null

  return (
    <section className="mt-10 space-y-4" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold salon-text-primary">{title}</h2>
        <Button variant="ghost" size="sm" asChild className="salon-text-muted">
          <Link href="/blog">همه مقالات</Link>
        </Button>
      </div>

      <Carousel opts={{ align: 'start', dragFree: true }} className="w-full">
        <CarouselContent className="-mr-3">
          {posts.map((post) => (
            <CarouselItem key={post.id} className="pr-3 basis-full sm:basis-1/2 lg:basis-1/3">
              <Link href={`/blog/${post.slug}`} className="block h-full group">
                <Card className="h-full overflow-hidden border-violet-100/80 transition-shadow group-hover:shadow-md">
                  <div className="relative aspect-[16/10] bg-muted">
                    {post.coverImage ? (
                      <Image
                        src={post.coverImage}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        sizes="(max-width: 640px) 100vw, 320px"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-100 to-pink-50" />
                    )}
                  </div>
                  <CardContent className="p-4 space-y-2 text-right">
                    {post.publishedAt && (
                      <p className="text-xs text-muted-foreground">
                        {formatPersianDate(new Date(post.publishedAt), 'd MMMM yyyy')}
                      </p>
                    )}
                    <h3 className="font-semibold line-clamp-2 salon-text-primary">{post.title}</h3>
                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                    )}
                    <span className="text-sm font-medium text-primary inline-block">ادامه مطلب</span>
                  </CardContent>
                </Card>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
        {posts.length > 1 && (
          <>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
          </>
        )}
      </Carousel>
    </section>
  )
}
