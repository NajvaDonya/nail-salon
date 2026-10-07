'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const CHARACTER_SRC = {
  standing: '/assets/nail-artist-character.png',
  sitting: '/assets/nail-artist-character-sitting.png',
  atDesk: '/assets/nail-artist-character-at-desk.png',
} as const

interface NailArtistCharacterProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  pose?: keyof typeof CHARACTER_SRC
  className?: string
  animate?: boolean
  priority?: boolean
  salonName?: string
}

const sizeMap = {
  sm: { box: 'w-24 h-24', img: 96 },
  md: { box: 'w-40 h-40', img: 160 },
  lg: { box: 'w-64 h-64', img: 256 },
  xl: { box: 'w-80 h-80 md:w-96 md:h-96', img: 384 },
}

const deskSizeMap = {
  sm: { box: 'w-16 aspect-[4/3]', img: 64 },
  md: { box: 'w-28 aspect-[4/3]', img: 112 },
  lg: { box: 'w-56 aspect-[4/3]', img: 320 },
  xl: { box: 'w-[17rem] md:w-[24rem] aspect-[4/3]', img: 768 },
}

export function NailArtistCharacter({
  size = 'md',
  pose = 'standing',
  className,
  animate = true,
  priority = false,
  salonName,
}: NailArtistCharacterProps) {
  const { box, img } = pose === 'atDesk' ? deskSizeMap[size] : sizeMap[size]

  const content = (
    <div
      className={cn(
        'relative shrink-0 drop-shadow-xl',
        box,
        className
      )}
    >
      <Image
        src={CHARACTER_SRC[pose]}
        alt={salonName?.trim() ? `نقاش ناخن ${salonName.trim()}` : 'نقاش ناخن'}
        width={img}
        height={pose === 'atDesk' ? Math.round((img * 3) / 4) : img}
        priority={priority}
        className="object-contain w-full h-full"
      />
    </div>
  )

  if (!animate) return content

  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      {content}
    </motion.div>
  )
}
