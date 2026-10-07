'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'
import type { SalonAppearance } from '@/lib/salon-appearance'
import { NailArtistCharacter } from './nail-artist-character'
import { WelcomeBanner } from './welcome-banner'

export interface HeroGallerySlide {
  id: string
  title: string
  description?: string | null
  imageUrl: string
  alt: string
}

interface HeroSliderProps {
  slides: HeroGallerySlide[]
  salonName?: string
  appearance: SalonAppearance
}

const MIN_SLIDER_VIEWPORT_PX = 160
const HERO_DOTS_RESERVE_PX = 24
const REINIT_DEBOUNCE_MS = 100

function HeroContentColumn({
  ref,
  salonName,
  welcomeBadge,
  subtitle,
  showCharacter,
}: {
  ref?: React.Ref<HTMLDivElement>
  salonName?: string
  welcomeBadge?: string
  subtitle?: string
  showCharacter?: boolean
}) {
  return (
    <div ref={ref} className="flex-1 min-w-0 flex flex-col items-center gap-3 md:gap-4">
      {showCharacter && (
        <div className="w-full flex justify-center items-center">
          <NailArtistCharacter size="xl" pose="atDesk" priority animate salonName={salonName} />
        </div>
      )}

      <div className="text-center md:text-right space-y-3 w-full max-w-md md:max-w-none">
        {welcomeBadge?.trim() ? (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/25 text-white text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" />
            {welcomeBadge.trim()}
          </div>
        ) : null}
        <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
          {salonName?.trim() ? `رزرو نوبت — ${salonName.trim()}` : 'رزرو نوبت آنلاین'}
        </h2>
        {subtitle?.trim() ? (
          <p className="text-white/85 text-sm md:text-base max-w-md mx-auto md:mx-0 md:mr-0 md:ml-auto">
            {subtitle.trim()}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function HeroSlider({ slides, salonName, appearance }: HeroSliderProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [selected, setSelected] = useState(0)
  const [paused, setPaused] = useState(false)
  const [contentHeight, setContentHeight] = useState(0)
  const contentColRef = useRef<HTMLDivElement>(null)
  const reInitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const carouselKey = slides.map((s) => s.id).join('-')
  const dotsReserve = slides.length > 1 ? HERO_DOTS_RESERVE_PX : 0
  const sliderViewportHeight = Math.max(contentHeight - dotsReserve, MIN_SLIDER_VIEWPORT_PX)

  const scheduleReInit = useCallback(() => {
    if (!api) return
    if (reInitTimerRef.current) clearTimeout(reInitTimerRef.current)
    reInitTimerRef.current = setTimeout(() => {
      api.reInit()
      reInitTimerRef.current = null
    }, REINIT_DEBOUNCE_MS)
  }, [api])

  const onSelect = useCallback((carouselApi: CarouselApi) => {
    if (!carouselApi) return
    setSelected(carouselApi.selectedScrollSnap())
  }, [])

  useLayoutEffect(() => {
    const el = contentColRef.current
    if (!el) return

    const update = () => {
      setContentHeight(el.getBoundingClientRect().height)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [slides.length, appearance.showCharacter, salonName, appearance.welcomeSubtitle])

  useEffect(() => {
    return () => {
      if (reInitTimerRef.current) clearTimeout(reInitTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!api) return
    onSelect(api)
    api.on('select', onSelect)
    api.on('reInit', onSelect)
    return () => {
      api.off('select', onSelect)
      api.off('reInit', onSelect)
    }
  }, [api, onSelect])

  useEffect(() => {
    scheduleReInit()
  }, [api, carouselKey, sliderViewportHeight, scheduleReInit])

  useEffect(() => {
    if (!api || slides.length <= 1 || paused) return
    const timer = window.setInterval(() => {
      if (api.canScrollNext()) api.scrollNext()
      else api.scrollTo(0)
    }, 6000)
    return () => window.clearInterval(timer)
  }, [api, slides.length, paused])

  if (slides.length === 0) {
    return (
      <WelcomeBanner
        salonName={salonName}
        welcomeBadge={appearance.welcomeBadge}
        subtitle={appearance.welcomeSubtitle}
        showCharacter={appearance.showCharacter}
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="salon-banner relative overflow-hidden rounded-[2rem] p-6 md:p-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute top-4 left-6 text-2xl opacity-60 animate-pulse pointer-events-none">
        ✨
      </div>
      <div className="absolute top-8 right-1/4 text-lg opacity-40 pointer-events-none">⭐</div>

      <div className="relative flex flex-col md:flex-row items-stretch gap-4 md:gap-6">
        <HeroContentColumn
          ref={contentColRef}
          salonName={salonName}
          welcomeBadge={appearance.welcomeBadge}
          subtitle={appearance.welcomeSubtitle}
          showCharacter={appearance.showCharacter}
        />

        <div
          dir="ltr"
          className="w-full md:w-[35%] shrink-0 min-w-0 flex flex-col self-stretch min-h-0 order-last md:order-none"
        >
          <Carousel
            key={carouselKey}
            setApi={setApi}
            opts={{ loop: slides.length > 1, align: 'start' }}
            className="relative w-full shrink-0"
            style={{ height: sliderViewportHeight }}
          >
            <CarouselContent
              className="ml-0 h-full"
              viewportClassName="h-full w-full rounded-xl overflow-hidden bg-black/10"
              viewportStyle={{ height: sliderViewportHeight }}
            >
              {slides.map((slide, index) => (
                <CarouselItem
                  key={slide.id}
                  className="basis-full shrink-0 grow-0 pl-0 h-full min-w-0"
                >
                  <div className="relative h-full w-full">
                    <Image
                      src={slide.imageUrl}
                      alt={slide.alt || slide.title}
                      fill
                      className="object-cover"
                      priority={index === 0}
                        sizes="(max-width: 768px) 100vw, 336px"
                      onLoad={scheduleReInit}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {slides.length > 1 && (
              <>
                <CarouselPrevious className="left-1 top-1/2 -translate-y-1/2 size-7 scale-90 border-white/30 bg-black/25 text-white hover:bg-black/45 disabled:opacity-40" />
                <CarouselNext className="right-1 top-1/2 -translate-y-1/2 size-7 scale-90 border-white/30 bg-black/25 text-white hover:bg-black/45 disabled:opacity-40" />
              </>
            )}
          </Carousel>

          {slides.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-2 shrink-0">
              {slides.map((slide, i) => (
                <button
                  key={slide.id}
                  type="button"
                  aria-label={`اسلاید ${i + 1}`}
                  aria-current={i === selected ? 'true' : undefined}
                  onClick={() => api?.scrollTo(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === selected ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80',
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
