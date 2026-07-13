import { Suspense } from 'react'
import { BookingFlow } from '@/components/booking'

interface SalonBookingViewProps {
  salonSlug: string
  salonName?: string
}

export function SalonBookingView({ salonSlug, salonName }: SalonBookingViewProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold">
            {salonName ? `رزرو نوبت — ${salonName}` : 'رزرو نوبت آنلاین'}
          </h1>
          <p className="text-sm text-muted-foreground">
            ابتدا تاریخ را از تقویم انتخاب کنید، سپس ساعت و پرداخت
          </p>
        </div>
      </header>
      <main>
        <Suspense fallback={<div className="p-8 text-center">در حال بارگذاری...</div>}>
          <BookingFlow salonSlug={salonSlug} />
        </Suspense>
      </main>
    </div>
  )
}
