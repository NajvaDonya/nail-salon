'use client'

import { motion } from 'framer-motion'
import { NailArtistCharacter } from './nail-artist-character'

interface CharacterTipProps {
  message: string
}

export function CharacterTip({ message }: CharacterTipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-end gap-3 mb-6"
    >
      <NailArtistCharacter size="sm" animate={false} />
      <div className="salon-tip-bubble relative flex-1 px-4 py-3 text-sm text-violet-800 font-medium">
        {message}
        <span className="absolute -right-1 bottom-3 w-3 h-3 bg-white rotate-45 border-r border-b border-violet-100" />
      </div>
    </motion.div>
  )
}
