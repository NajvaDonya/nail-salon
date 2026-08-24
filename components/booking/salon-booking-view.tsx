'use client'

import { Suspense, type CSSProperties } from 'react'
import Link from 'next/link'
import { History, Sparkles } from 'lucide-react'
import { BookingFlow } from '@/components/booking'
import { WelcomeBanner, NailArtistCharacter } from '@/components/salon'
import { Button } from '@/components/ui/button'
import {
  type SalonAppearance,
  DEFAULT_SALON_APPEARANCE,
  appearanceStyleVars,
} from '@/lib/salon-appearance'

interface SalonBookingViewProps {
  salonSlug: string
  salonName?: string
  returnTo?: string
  appearance?: SalonAppearance
  maxAdvanceBookingDays?: number
}

export function SalonBookingView({
  salonSlug,
  salonName,
  returnTo,
  appearance = DEFAULT_SALON_APPEARANCE,
  maxAdvanceBookingDays = 30,
}: SalonBookingViewProps) {
  const themeStyle = appearanceStyleVars(appearance) as CSSProperties

  return (
    <div className="salon-page min-h-screen" style={themeStyle}>
      <header className="salon-header sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {appearance.showCharacter && <NailArtistCharacter size="sm" animate={false} />}
            <div className="min-w-0">
              <p className="font-bold salon-text-primary truncate flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 salon-accent shrink-0" />
                {salonName || 'فیر سالن'}
              </p>
              <p className="text-xs salon-text-muted hidden sm:block">نوبت‌دهی آنلاین</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="rounded-full salon-text-muted hover:bg-white/60 hover:salon-text-primary"
          >
            <Link href="/account">
              <History className="w-4 h-4 ml-2" />
              نوبت‌های من
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-12">
        <div className="pt-6 pb-8">
          <WelcomeBanner
            salonName={salonName}
            welcomeBadge={appearance.welcomeBadge}
            subtitle={appearance.welcomeSubtitle}
            showCharacter={appearance.showCharacter}
          />
        </div>

        <div className="salon-card p-4 md:p-8">
          <Suspense fallback={<div className="p-8 text-center salon-text-muted">در حال بارگذاری...</div>}>
            <BookingFlow
              salonSlug={salonSlug}
              returnTo={returnTo}
              maxAdvanceBookingDays={maxAdvanceBookingDays}
            />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
