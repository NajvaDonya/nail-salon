import { prisma } from '@/lib/db'
import { SalonBookingView } from '@/components/booking/salon-booking-view'
import { extractSalonAppearance } from '@/lib/salon-appearance'
import { parseSalonSettings } from '@/lib/salon-settings'

export const dynamic = 'force-dynamic'

interface SalonBookingPageProps {
  params: Promise<{ slug: string }>
}

export default async function SalonBookingPage({ params }: SalonBookingPageProps) {
  const { slug } = await params
  const salon = await prisma.salon.findUnique({
    where: { slug },
    select: { name: true, slug: true, settings: true },
  })

  const appearance = extractSalonAppearance(salon?.settings)
  const { maxAdvanceBookingDays } = parseSalonSettings(salon?.settings)

  return (
    <SalonBookingView
      salonSlug={slug}
      salonName={salon?.name}
      returnTo={`/salon/${slug}/book`}
      appearance={appearance}
      maxAdvanceBookingDays={maxAdvanceBookingDays}
    />
  )
}
