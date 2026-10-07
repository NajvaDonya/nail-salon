import { getPrimarySalonSlug } from '@/lib/primary-salon'
import { GET as getSalonBlogPost } from '@/app/api/salons/[slug]/blog/[postSlug]/route'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const salonSlug = await getPrimarySalonSlug()
  if (!salonSlug) {
    return Response.json({ error: 'مقاله یافت نشد' }, { status: 404 })
  }
  const { slug: postSlug } = await params
  return getSalonBlogPost(request, {
    params: Promise.resolve({ slug: salonSlug, postSlug }),
  })
}
