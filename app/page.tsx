import { prisma } from '@/lib/db'
import { SalonBookingView } from '@/components/booking/salon-booking-view'

export default async function HomePage() {
  const salon = await prisma.salon.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { slug: true, name: true },
  })

  if (!salon) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">سالن فعالی برای رزرو یافت نشد.</p>
      </div>
    )
  }

  return <SalonBookingView salonSlug={salon.slug} salonName={salon.name} />
}
