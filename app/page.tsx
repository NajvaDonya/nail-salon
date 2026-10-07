import { SalonBookingView } from '@/components/booking/salon-booking-view'
import { resolveSalonAppearance } from '@/lib/salon-appearance'
import { listHeroGalleryImages, listPublishedBlogPosts, resolveBlogSectionTitle } from '@/lib/cms-data'
import { parseSalonSettings } from '@/lib/salon-settings'
import { getPrimarySalon } from '@/lib/primary-salon'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const salon = await getPrimarySalon()

  if (!salon) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">سالن فعالی برای رزرو یافت نشد.</p>
      </div>
    )
  }

  const appearance = resolveSalonAppearance(salon.settings, salon.name)
  const { maxAdvanceBookingDays } = parseSalonSettings(salon.settings)
  const heroSlides = await listHeroGalleryImages(salon.id)
  const blogPosts = await listPublishedBlogPosts(salon.id, 8)
  const blogSectionTitle = resolveBlogSectionTitle(salon.settings, salon.name)

  return (
    <SalonBookingView
      salonSlug={salon.slug}
      salonName={salon.name}
      returnTo="/"
      appearance={appearance}
      maxAdvanceBookingDays={maxAdvanceBookingDays}
      heroSlides={heroSlides}
      blogPosts={blogPosts}
      blogSectionTitle={blogSectionTitle}
    />
  )
}
