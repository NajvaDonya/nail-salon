import Link from 'next/link'
import { prisma } from '@/lib/db'
import { SalonBookingView } from '@/components/booking/salon-booking-view'
import { NailArtistCharacter } from '@/components/salon'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Sparkles } from 'lucide-react'
import { extractSalonAppearance } from '@/lib/salon-appearance'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const salons = await prisma.salon.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: {
      slug: true,
      name: true,
      address: true,
      city: true,
      settings: true,
    },
  })

  if (salons.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center">
        <p className="text-muted-foreground">سالن فعالی برای رزرو یافت نشد.</p>
      </div>
    )
  }

  if (salons.length === 1) {
    const salon = salons[0]
    const appearance = extractSalonAppearance(salon.settings)
    return (
      <SalonBookingView
        salonSlug={salon.slug}
        salonName={salon.name}
        returnTo="/"
        appearance={appearance}
      />
    )
  }

  return (
    <div className="salon-page min-h-screen">
      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex flex-col items-center text-center mb-8 gap-3">
          <NailArtistCharacter size="lg" />
          <h1 className="text-2xl font-bold text-violet-900 flex items-center gap-2 justify-center">
            <Sparkles className="w-5 h-5 text-pink-500" />
            انتخاب سالن
          </h1>
          <p className="text-violet-700/80 text-sm">سالن مورد نظر خود را برای رزرو انتخاب کنید</p>
        </div>

        <div className="grid gap-4">
          {salons.map((salon) => (
            <Link key={salon.slug} href={`/salon/${salon.slug}/book`}>
              <Card className="rounded-3xl hover:shadow-lg transition-shadow border-violet-100">
                <CardContent className="p-5 text-right">
                  <h2 className="font-bold text-lg text-violet-900">{salon.name}</h2>
                  {(salon.address || salon.city) && (
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1 justify-end">
                      <MapPin className="w-3.5 h-3.5" />
                      {[salon.city, salon.address].filter(Boolean).join(' — ')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
