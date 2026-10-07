import { NextResponse } from 'next/server'
import { getPrimarySalonSlug } from '@/lib/primary-salon'
import { GET as getSalonHero } from '@/app/api/salons/[slug]/gallery/hero/route'

export async function GET(request: Request) {
  const slug = await getPrimarySalonSlug()
  if (!slug) {
    return NextResponse.json({ images: [] })
  }
  return getSalonHero(request, { params: Promise.resolve({ slug }) })
}
