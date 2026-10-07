import { NextResponse } from 'next/server'
import { getPrimarySalonSlug } from '@/lib/primary-salon'
import { GET as getSalonBlog } from '@/app/api/salons/[slug]/blog/route'

export async function GET(request: Request) {
  const slug = await getPrimarySalonSlug()
  if (!slug) {
    return NextResponse.json({ posts: [] })
  }
  return getSalonBlog(request, { params: Promise.resolve({ slug }) })
}
