'use client'

import { useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChevronDown, GripVertical, Loader2, Pencil, Trash2, Upload } from 'lucide-react'

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'خطا')
  return data
}

interface GalleryImage {
  id: string
  title: string
  description: string | null
  imageUrl: string
  alt: string
  isActive: boolean
  showInHero: boolean
  sortOrder: number
}

function SortableHeroRow({ image, onEdit }: { image: GalleryImage; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: image.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
      <button type="button" className="cursor-grab text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="relative w-14 h-10 rounded overflow-hidden bg-muted shrink-0">
        <Image src={image.imageUrl} alt={image.alt} fill className="object-cover" sizes="56px" />
      </div>
      <div className="flex-1 min-w-0 text-right">
        <p className="font-medium truncate text-sm">{image.title}</p>
        <p className="text-xs text-muted-foreground truncate">{image.alt}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Pencil className="w-4 h-4" />
      </Button>
    </div>
  )
}

export default function CmsGalleryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data, isLoading, mutate } = useSWR<{ images: GalleryImage[] }>(
    '/api/dashboard/gallery',
    fetcher
  )
  const images = data?.images ?? []

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GalleryImage | null>(null)
  const [seoOpen, setSeoOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [alt, setAlt] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [showInHero, setShowInHero] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const heroImages = useMemo(
    () => images.filter((i) => i.showInHero && i.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [images]
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const openEdit = (image: GalleryImage) => {
    setEditing(image)
    setTitle(image.title)
    setDescription(image.description || '')
    setAlt(image.alt)
    setIsActive(image.isActive)
    setShowInHero(image.showInHero)
    setSeoOpen(false)
    setDialogOpen(true)
  }

  const handleBatchUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return
    setUploading(true)
    try {
      const form = new FormData()
      for (const file of Array.from(fileList)) {
        form.append('files', file)
      }
      const res = await fetch('/api/dashboard/gallery/upload', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'خطا در آپلود')
      const count = result.count ?? result.images?.length ?? fileList.length
      toast.success(`${count} تصویر به گالری اضافه شد`)
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSaveEdit = async () => {
    if (!editing) return
    if (!title.trim()) {
      toast.error('عنوان الزامی است')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/dashboard/gallery/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title,
          description: description || null,
          alt: alt || title,
          isActive,
          showInHero: isActive ? showInHero : false,
        }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'خطا')
      toast.success('ذخیره شد')
      setDialogOpen(false)
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا')
    } finally {
      setSaving(false)
    }
  }

  const toggleField = async (image: GalleryImage, field: 'isActive' | 'showInHero', value: boolean) => {
    try {
      const res = await fetch(`/api/dashboard/gallery/${image.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [field]: value }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'خطا')
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا')
    }
  }

  const handleDelete = async (image: GalleryImage) => {
    if (!confirm('این تصویر حذف شود؟')) return
    try {
      const res = await fetch(`/api/dashboard/gallery/${image.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'خطا')
      toast.success('حذف شد')
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا')
    }
  }

  const onHeroDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = heroImages.findIndex((i) => i.id === active.id)
    const newIndex = heroImages.findIndex((i) => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(heroImages, oldIndex, newIndex)
    const otherIds = images.filter((i) => !reordered.some((h) => h.id === i.id)).map((i) => i.id)
    const orderedIds = [...reordered.map((i) => i.id), ...otherIds]
    try {
      const res = await fetch('/api/dashboard/gallery/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ orderedIds }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'خطا')
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا')
    }
  }

  return (
    <div className="space-y-6 p-4 lg:p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">مدیریت گالری</h1>
          <p className="text-sm text-muted-foreground">
            تصاویر را انتخاب کنید — عنوان، alt و توضیحات SEO خودکار پر می‌شود
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => void handleBatchUpload(e.target.files)}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 ml-2" />
            )}
            انتخاب و آپلود تصاویر
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ترتیب Hero (کشیدن و رها کردن)</CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            {heroImages.length === 0
              ? 'برای نمایش در اسلایدر صفحه اصلی، سوئیچ Hero و فعال را برای هر تصویر در بخش «همه تصاویر» روشن کنید.'
              : `${heroImages.length} تصویر در اسلایدر صفحه اصلی (/) نمایش داده می‌شود — یکی‌یکی با فلش یا اتوپلی.`}
          </p>
        </CardHeader>
        <CardContent>
          {heroImages.length === 0 ? (
            <p className="text-sm text-muted-foreground">هنوز تصویر Hero فعالی انتخاب نشده است.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onHeroDragEnd}>
              <SortableContext items={heroImages.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {heroImages.map((image) => (
                    <SortableHeroRow key={image.id} image={image} onEdit={() => openEdit(image)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">همه تصاویر</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : images.length === 0 ? (
            <p className="text-sm text-muted-foreground">گالری خالی است — چند تصویر آپلود کنید.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {images.map((image) => (
                <div key={image.id} className="border rounded-xl overflow-hidden bg-card">
                  <div className="relative aspect-video bg-muted">
                    <Image src={image.imageUrl} alt={image.alt} fill className="object-cover" sizes="320px" />
                  </div>
                  <div className="p-3 space-y-3">
                    <p className="font-medium text-sm truncate" title={image.title}>
                      {image.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate" title={image.alt}>
                      {image.alt}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span>فعال</span>
                      <Switch checked={image.isActive} onCheckedChange={(v) => toggleField(image, 'isActive', v)} />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>Hero</span>
                      <Switch
                        checked={image.showInHero}
                        disabled={!image.isActive}
                        onCheckedChange={(v) => toggleField(image, 'showInHero', v)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(image)}>
                        ویرایش
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(image)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش تصویر</DialogTitle>
          </DialogHeader>
          {editing && (
            <>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <Image src={editing.imageUrl} alt={editing.alt} fill className="object-cover" sizes="400px" />
              </div>
              <div className="flex items-center justify-between">
                <Label>فعال</Label>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="flex items-center justify-between">
                <Label>نمایش در Hero</Label>
                <Switch checked={showInHero} disabled={!isActive} onCheckedChange={setShowInHero} />
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
                    <Label>عنوان</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Alt</Label>
                    <Input value={alt} onChange={(e) => setAlt(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>توضیح</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ذخیره'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
