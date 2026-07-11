import { BookingFlow } from '@/components/booking'

interface SalonBookingPageProps {
  params: Promise<{ slug: string }>
}

export default async function SalonBookingPage({ params }: SalonBookingPageProps) {
  const { slug } = await params
  
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">رزرو نوبت آنلاین</h1>
        </div>
      </header>
      <main>
        <BookingFlow salonSlug={slug} />
      </main>
    </div>
  )
}
