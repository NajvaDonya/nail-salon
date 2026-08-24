'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const CHARACTER_SRC = '/assets/nail-artist-character.png'

interface NailArtistCharacterProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  animate?: boolean
  priority?: boolean
}

const sizeMap = {
  sm: { box: 'w-12 h-12', img: 48 },
  md: { box: 'w-20 h-20', img: 80 },
  lg: { box: 'w-32 h-32', img: 128 },
  xl: { box: 'w-40 h-40 md:w-48 md:h-48', img: 192 },
}

export function NailArtistCharacter({
  size = 'md',
  className,
  animate = true,
  priority = false,
}: NailArtistCharacterProps) {
  const { box, img } = sizeMap[size]

  const content = (
    <div
      className={cn(
        'relative shrink-0 drop-shadow-xl',
        box,
        className
      )}
    >
      <Image
        src={CHARACTER_SRC}
        alt="نقاش ناخن فیر سالن — بلوند، قد ۱۵۰ سانتی‌متر"
        width={img}
        height={img}
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
