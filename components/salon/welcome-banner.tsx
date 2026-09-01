'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { NailArtistCharacter } from './nail-artist-character'

interface WelcomeBannerProps {
  salonName?: string
  subtitle?: string
  welcomeBadge?: string
  showCharacter?: boolean
}

export function WelcomeBanner({
  salonName,
  subtitle,
  welcomeBadge = 'خوش آمدید به فیر سالن',
  showCharacter = true,
}: WelcomeBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="salon-banner relative overflow-hidden rounded-[2rem] p-6 md:p-8"
    >
      <div className="absolute top-4 left-6 text-2xl opacity-60 animate-pulse">✨</div>
      <div className="absolute bottom-6 left-1/3 text-xl opacity-50">💅</div>
      <div className="absolute top-8 right-1/4 text-lg opacity-40">⭐</div>

      <div className="relative flex flex-col md:flex-row items-center gap-6 md:gap-8">
        {showCharacter && <NailArtistCharacter size="xl" pose="atDesk" priority animate />}

        <div className="flex-1 text-center md:text-right space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/25 text-white text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" />
            {welcomeBadge}
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
            {salonName ? `رزرو نوبت — ${salonName}` : 'رزرو نوبت آنلاین'}
          </h2>
          <p className="text-white/85 text-sm md:text-base max-w-md mx-auto md:mx-0 md:mr-0">
            {subtitle || 'تاریخ، خدمات و زمان دلخواهت رو انتخاب کن — ما آماده‌ایم ناخن‌هات رو بدرخشونیم!'}
          </p>
        </div>
      </div>
    </motion.div>
  )
}