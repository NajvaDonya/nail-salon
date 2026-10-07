import { prisma } from '@/lib/db'
import { SalonBookingView } from '@/components/booking/salon-booking-view'
import { resolveSalonAppearance } from '@/lib/salon-appearance'
import { parseSalonSettings } from '@/lib/salon-settings'
import { listHeroGalleryImages, listPublishedBlogPosts, resolveBlogSectionTitle } from '@/lib/cms-data'

export const dynamic = 'force-dynamic'

interface SalonBookingPageProps {
  params: Promise<{ slug: string }>
}

export default async function SalonBookingPage({ params }: SalonBookingPageProps) {
  const { slug } = await params
  const salon = await prisma.salon.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, settings: true },
  })

  const appearance = resolveSalonAppearance(salon?.settings, salon?.name)
  const { maxAdvanceBookingDays } = parseSalonSettings(salon?.settings)

  const heroSlides = salon ? await listHeroGalleryImages(salon.id) : []
  const blogPosts = salon ? await listPublishedBlogPosts(salon.id, 8) : []
  const blogSectionTitle = resolveBlogSectionTitle(salon?.settings, salon?.name)

  return (
    <SalonBookingView
      salonSlug={slug}
      salonName={salon?.name}
      returnTo={`/salon/${slug}/book`}
      appearance={appearance}
      maxAdvanceBookingDays={maxAdvanceBookingDays}
      heroSlides={heroSlides}
      blogPosts={blogPosts}
      blogSectionTitle={blogSectionTitle}
    />
  )
}
