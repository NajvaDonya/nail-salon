import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest'
import { prisma, resetDb, seedManager, seedSalon, seedCustomer } from '../helpers/db'
import { asGuest, asUser, jsonRequest, routeParams } from '../helpers/auth'
import { GET as galleryListGet, POST as galleryPost } from '@/app/api/dashboard/gallery/route'
import { PATCH as galleryPatch, DELETE as galleryDelete } from '@/app/api/dashboard/gallery/[id]/route'
import { PATCH as galleryReorderPatch } from '@/app/api/dashboard/gallery/reorder/route'
import { GET as heroGet } from '@/app/api/salons/[slug]/gallery/hero/route'
import { GET as blogListGet, POST as blogPost } from '@/app/api/dashboard/blog/route'
import { PATCH as blogPatch, DELETE as blogDelete } from '@/app/api/dashboard/blog/[id]/route'
import { GET as publicBlogListGet } from '@/app/api/salons/[slug]/blog/route'
import { GET as publicBlogDetailGet } from '@/app/api/salons/[slug]/blog/[postSlug]/route'

describe('CMS gallery and blog', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  beforeEach(async () => {
    await resetDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('manager can CRUD gallery and hero API respects active/showInHero/order', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)

    let imageAId = ''
    let imageBId = ''

    await asUser({ id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id }, async () => {
      const createA = await galleryPost(
        jsonRequest('http://localhost/api/dashboard/gallery', {
          title: 'Hero A',
          imageUrl: '/uploads/test/a.jpg',
          isActive: true,
          showInHero: true,
          sortOrder: 0,
        })
      )
      expect(createA.status).toBe(200)
      imageAId = ((await createA.json()) as { image: { id: string } }).image.id

      const createB = await galleryPost(
        jsonRequest('http://localhost/api/dashboard/gallery', {
          title: 'Hero B',
          imageUrl: '/uploads/test/b.jpg',
          isActive: true,
          showInHero: true,
          sortOrder: 1,
        })
      )
      expect(createB.status).toBe(200)
      imageBId = ((await createB.json()) as { image: { id: string } }).image.id

      await galleryPost(
        jsonRequest('http://localhost/api/dashboard/gallery', {
          title: 'Inactive',
          imageUrl: '/uploads/test/c.jpg',
          isActive: false,
          showInHero: true,
        })
      )

      const reorder = await galleryReorderPatch(
        jsonRequest('http://localhost/api/dashboard/gallery/reorder', {
          orderedIds: [imageBId, imageAId],
        })
      )
      expect(reorder.status).toBe(200)

      const patch = await galleryPatch(
        jsonRequest(`http://localhost/api/dashboard/gallery/${imageAId}`, {
          title: 'Hero A updated',
        }),
        routeParams({ id: imageAId })
      )
      expect(patch.status).toBe(200)
    })

    const heroRes = await heroGet(new Request('http://localhost'), routeParams({ slug: salon.slug }))
    expect(heroRes.status).toBe(200)
    const heroBody = (await heroRes.json()) as { images: { id: string; title: string }[] }
    expect(heroBody.images).toHaveLength(2)
    expect(heroBody.images[0].id).toBe(imageBId)
    expect(heroBody.images[1].title).toBe('Hero A updated')

    await asUser({ id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id }, async () => {
      const del = await galleryDelete(new Request('http://localhost'), routeParams({ id: imageBId }))
      expect(del.status).toBe(200)
    })
  })

  it('auto-fills gallery SEO when title is omitted', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)

    await asUser({ id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id }, async () => {
      const res = await galleryPost(
        jsonRequest('http://localhost/api/dashboard/gallery', {
          imageUrl: '/uploads/test/salon-nails.jpg',
          originalFileName: 'salon-nails.jpg',
        })
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        image: { title: string; alt: string; description: string | null; showInHero: boolean }
      }
      expect(body.image.title).toBe('salon nails')
      expect(body.image.alt).toContain('تصویر گالری')
      expect(body.image.description).toContain('گالری')
      expect(body.image.showInHero).toBe(false)
    })

    void salon
  })

  it('hero API returns all active showInHero gallery images (e.g. six slides)', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)

    await asUser({ id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id }, async () => {
      for (let i = 0; i < 6; i++) {
        const res = await galleryPost(
          jsonRequest('http://localhost/api/dashboard/gallery', {
            title: `Hero ${i + 1}`,
            imageUrl: `/uploads/test/hero-${i + 1}.jpg`,
            isActive: true,
            showInHero: true,
            sortOrder: i,
          })
        )
        expect(res.status).toBe(200)
      }
    })

    const heroRes = await heroGet(new Request('http://localhost'), routeParams({ slug: salon.slug }))
    expect(heroRes.status).toBe(200)
    const heroBody = (await heroRes.json()) as { images: { id: string; title: string }[] }
    expect(heroBody.images).toHaveLength(6)
    expect(heroBody.images.map((img) => img.title)).toEqual([
      'Hero 1',
      'Hero 2',
      'Hero 3',
      'Hero 4',
      'Hero 5',
      'Hero 6',
    ])
  })

  it('auto-fills blog slug and excerpt when omitted', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)

    await asUser({ id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id }, async () => {
      const create = await blogPost(
        jsonRequest('http://localhost/api/dashboard/blog', {
          title: 'نکات ناخن',
          content: '# مقدمه\n\nاین یک **متن** تست است.',
          coverImage: '/uploads/test/cover.jpg',
          status: 'DRAFT',
        })
      )
      expect(create.status).toBe(200)
      const body = (await create.json()) as {
        post: { id: string; slug: string; excerpt: string | null }
      }
      expect(body.post.slug.length).toBeGreaterThan(0)
      expect(body.post.excerpt).toContain('متن')
      expect(body.post.excerpt).not.toContain('**')

      const patch = await blogPatch(
        jsonRequest(`http://localhost/api/dashboard/blog/${body.post.id}`, {
          content: 'پارagraph جدید بدون markdown.',
        }),
        routeParams({ id: body.post.id })
      )
      expect(patch.status).toBe(200)
      const patched = (await patch.json()) as { post: { excerpt: string | null } }
      expect(patched.post.excerpt).toBe('پارagraph جدید بدون markdown.')
    })

    void salon
  })

  it('blog draft hidden from public; published visible by slug', async () => {
    const salon = await seedSalon()
    const manager = await seedManager(salon.id)

    let postId = ''
    let draftSlug = ''
    await asUser({ id: manager.id, phone: manager.phone, role: 'MANAGER', salonId: salon.id }, async () => {
      const draft = await blogPost(
        jsonRequest('http://localhost/api/dashboard/blog', {
          title: 'Draft Post',
          content: 'secret draft body',
          status: 'DRAFT',
        })
      )
      expect(draft.status).toBe(200)
      const draftBody = (await draft.json()) as { post: { id: string; slug: string } }
      postId = draftBody.post.id
      draftSlug = draftBody.post.slug

      const pub = await blogPost(
        jsonRequest('http://localhost/api/dashboard/blog', {
          title: 'Published Post',
          content: 'Hello **world**',
          excerpt: 'Short excerpt',
          status: 'PUBLISHED',
        })
      )
      expect(pub.status).toBe(200)
      const pubSlug = ((await pub.json()) as { post: { slug: string } }).post.slug

      const listRes = await publicBlogListGet(new Request('http://localhost'), routeParams({ slug: salon.slug }))
      expect(listRes.status).toBe(200)
      const listBody = (await listRes.json()) as { posts: { slug: string }[] }
      expect(listBody.posts.some((p) => p.slug === pubSlug)).toBe(true)
      expect(listBody.posts.some((p) => p.slug.includes('draft'))).toBe(false)

      const draftDetail = await publicBlogDetailGet(
        new Request('http://localhost'),
        routeParams({ slug: salon.slug, postSlug: draftSlug })
      )
      expect(draftDetail.status).toBe(404)

      const detail = await publicBlogDetailGet(
        new Request('http://localhost'),
        routeParams({ slug: salon.slug, postSlug: pubSlug })
      )
      expect(detail.status).toBe(200)

      const unpublish = await blogPatch(
        jsonRequest(`http://localhost/api/dashboard/blog/${postId}`, { status: 'DRAFT' }),
        routeParams({ id: postId })
      )
      expect(unpublish.status).toBe(200)

      const del = await blogDelete(new Request('http://localhost'), routeParams({ id: postId }))
      expect(del.status).toBe(200)
    })
  })

  it('denies customers from CMS mutations', async () => {
    const salon = await seedSalon()
    const customer = await seedCustomer()

    await asUser({ id: customer.id, phone: customer.phone, role: 'CUSTOMER' }, async () => {
      expect((await galleryListGet()).status).toBe(403)
      expect(
        (
          await galleryPost(
            jsonRequest('http://localhost/api/dashboard/gallery', {
              title: 'x',
              imageUrl: '/x.jpg',
            })
          )
        ).status
      ).toBe(403)
      expect((await blogListGet(new Request('http://localhost/api/dashboard/blog'))).status).toBe(403)
      expect(
        (
          await blogPost(
            jsonRequest('http://localhost/api/dashboard/blog', {
              title: 'x',
              content: 'y',
            })
          )
        ).status
      ).toBe(403)
    })

    await asGuest(async () => {
      expect((await galleryListGet()).status).toBe(403)
    })

    void salon
  })
})
