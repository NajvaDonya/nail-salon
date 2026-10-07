'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, Loader2, Plus, Trash2 } from 'lucide-react'
import { formatPersianDate } from '@/lib/jalali'

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'خطا')
  return data
}

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  coverImage: string | null
  status: 'DRAFT' | 'PUBLISHED'
  publishedAt: string | null
  updatedAt: string
}

export default function CmsBlogPage() {
  const { data, isLoading, mutate } = useSWR<{ posts: BlogPost[] }>('/api/dashboard/blog', fetcher)
  const posts = data?.posts ?? []

  const [tab, setTab] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BlogPost | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [content, setContent] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [coverUrlOverride, setCoverUrlOverride] = useState('')
  const [seoOpen, setSeoOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    if (tab === 'draft') return posts.filter((p) => p.status === 'DRAFT')
    if (tab === 'published') return posts.filter((p) => p.status === 'PUBLISHED')
    return posts
  }, [posts, tab])

  const resolvedCover = coverUrlOverride.trim() || coverImage

  const openCreate = () => {
    setEditing(null)
    setTitle('')
    setSlug('')
    setExcerpt('')
    setContent('')
    setCoverImage('')
    setCoverUrlOverride('')
    setSeoOpen(false)
    setDialogOpen(true)
  }

  const openEdit = async (post: BlogPost) => {
    try {
      const res = await fetch(`/api/dashboard/blog/${post.id}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا')
      const full = data.post as BlogPost
      setEditing(full)
      setTitle(full.title)
      setSlug(full.slug)
      setExcerpt(full.excerpt || '')
      setContent(full.content)
      setCoverImage(full.coverImage || '')
      setCoverUrlOverride('')
      setSeoOpen(false)
      setDialogOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا')
    }
  }

  const handleCoverUpload = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/dashboard/media/upload', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'خطا')
      setCoverImage(result.imageUrl)
      setCoverUrlOverride('')
      toast.success('کاور آپلود شد')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا')
    } finally {
      setUploading(false)
    }
  }

  const savePost = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (!title.trim() || !content.trim()) {
      toast.error('عنوان و محتوا الزامی است')
      return
    }
    if (status === 'PUBLISHED' && !resolvedCover) {
      toast.error('برای انتشار، تصویر کاver را آپلود کنید')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        content,
        coverImage: resolvedCover || null,
        status,
      }
      if (slug.trim()) payload.slug = slug.trim()
      if (excerpt.trim()) payload.excerpt = excerpt.trim()

      const res = await fetch(editing ? `/api/dashboard/blog/${editing.id}` : '/api/dashboard/blog', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'خطا')
      toast.success(status === 'PUBLISHED' ? 'منتشر شد' : 'پیش‌نویس ذخیره شد')
      setDialogOpen(false)
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا')
    } finally {
      setSaving(false)
    }
  }

  const unpublish = async (post: BlogPost) => {
    try {
      const res = await fetch(`/api/dashboard/blog/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'DRAFT' }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'خطا')
      toast.success('از انتشار خارج شد')
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا')
    }
  }

  const handleDelete = async (post: BlogPost) => {
    if (!confirm('این مقاله حذف شود؟')) return
    try {
      const res = await fetch(`/api/dashboard/blog/${post.id}`, { method: 'DELETE', credentials: 'include' })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'خطا')
      toast.success('حذف شد')
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا')
    }
  }

  return (
    <div className="space-y-6 p-4 lg:p-6" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">مدیریت بلاگ</h1>
          <p className="text-sm text-muted-foreground">
            عنوان، محتوا و کاver را وارد کنید؛ slug و خلاصه خودکار پر می‌شوند.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 ml-2" />
          مقاله جدید
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">همه</TabsTrigger>
          <TabsTrigger value="draft">پیش‌نویس</TabsTrigger>
          <TabsTrigger value="published">منتشرشده</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">مقالات</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">موردی یافت نشد.</p>
              ) : (
                <div className="space-y-3">
                  {filtered.map((post) => (
                    <div key={post.id} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0 text-right">
                        <p className="font-medium truncate">{post.title}</p>
                        <p className="text-xs text-muted-foreground truncate" dir="ltr">
                          /blog/{post.slug}
                        </p>
                        {post.publishedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatPersianDate(new Date(post.publishedAt), 'd MMMM yyyy')}
                          </p>
                        )}
                      </div>
                      <Badge variant={post.status === 'PUBLISHED' ? 'default' : 'secondary'}>
                        {post.status === 'PUBLISHED' ? 'منتشرشده' : 'پیش‌نویس'}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => void openEdit(post)}>
                        ویرایش
                      </Button>
                      {post.status === 'PUBLISHED' && (
                        <Button variant="ghost" size="sm" onClick={() => void unpublish(post)}>
                          لغو انتشار
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => void handleDelete(post)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? 'ویرایش مقاله' : 'مقاله جدید'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>عنوان</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>محتوا (Markdown)</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label>تصویر کاver</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleCoverUpload(file)
                }}
              />
              {resolvedCover ? (
                <div className="relative aspect-video max-w-sm rounded-lg overflow-hidden bg-muted">
                  <Image src={resolvedCover} alt="" fill className="object-cover" sizes="400px" />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">برای انتشار، یک تصویر انتخاب کنید.</p>
              )}
            </div>

            <Collapsible open={seoOpen} onOpenChange={setSeoOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-0">
                  SEO (پیشرفته)
                  <ChevronDown className={`w-4 h-4 transition-transform ${seoOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Slug (اختیاری)</Label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    dir="ltr"
                    placeholder="خالی = خودکار از عنوان"
                  />
                </div>
                <div className="space-y-2">
                  <Label>خلاصه (اختیاری)</Label>
                  <Textarea
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    rows={2}
                    placeholder="خالی = خودکار از محتوا"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL کاver (جایگزین آپلود)</Label>
                  <Input
                    value={coverUrlOverride}
                    onChange={(e) => setCoverUrlOverride(e.target.value)}
                    dir="ltr"
                    placeholder="https://..."
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              انصراف
            </Button>
            <Button variant="secondary" onClick={() => void savePost('DRAFT')} disabled={saving}>
              ذخیره پیش‌نویس
            </Button>
            <Button onClick={() => void savePost('PUBLISHED')} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'انتشار'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
