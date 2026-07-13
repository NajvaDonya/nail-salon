import { SalonBookingView } from '@/components/booking/salon-booking-view'

interface SalonBookingPageProps {
  params: Promise<{ slug: string }>
}

export default async function SalonBookingPage({ params }: SalonBookingPageProps) {
  const { slug } = await params

  return <SalonBookingView salonSlug={slug} />
}
