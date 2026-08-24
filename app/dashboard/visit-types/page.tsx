'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2, Plus, Trash2 } from 'lucide-react'

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'خطا')
  return data
}

interface VisitType {
  id: string
  name: string
  description: string | null
  sortOrder: number
  behavior: string
  isActive: boolean
}

const behaviorLabels: Record<string, string> = {
  GENERAL: 'عمومی',
  FIRST_TIME: 'اولین بار',
  RETURNING: 'مشتری قبلی',
  PREFERRED_STAFF: 'انتخاب پرسنل مشخص',
}

export default function VisitTypesPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [behavior, setBehavior] = useState('GENERAL')
  const [isSaving, setIsSaving] = useState(false)

  const { data, error, isLoading, mutate } = useSWR<{ visitTypes: VisitType[] }>(
    '/api/dashboard/visit-types',
    fetcher
  )

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('نام الزامی است')
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch('/api/dashboard/visit-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, description: description || undefined, behavior }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'خطا')
      toast.success('ثبت شد')
      setName('')
      setDescription('')
      setBehavior('GENERAL')
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleActive = async (vt: VisitType) => {
    const res = await fetch(`/api/dashboard/visit-types/${vt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isActive: !vt.isActive }),
    })
    if (!res.ok) {
      toast.error('خطا در بروزرسانی')
      return
    }
    await mutate()
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/dashboard/visit-types/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      toast.error('خطا در حذف')
      return
    }
    toast.success('حذف شد')
    await mutate()
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return <p className="text-destructive">{error.message}</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">انواع مراجعه</h1>
        <p className="text-muted-foreground">گزینه‌های اولین قدم رزرو آنلاین</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>افزودن نوع مراجعه</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>نام</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>رفتار</Label>
              <Select value={behavior} onValueChange={setBehavior}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(behaviorLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>توضیحات</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <Button onClick={() => void handleCreate()} disabled={isSaving}>
            <Plus className="w-4 h-4 ml-2" />
            ثبت
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>لیست</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(data?.visitTypes ?? []).map((vt) => (
            <div
              key={vt.id}
              className="flex items-center justify-between gap-4 rounded-lg border p-3"
            >
              <div>
                <p className="font-medium">{vt.name}</p>
                <p className="text-xs text-muted-foreground">
                  {behaviorLabels[vt.behavior] ?? vt.behavior}
                  {vt.description ? ` — ${vt.description}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={vt.isActive} onCheckedChange={() => void toggleActive(vt)} />
                <Button variant="ghost" size="icon" onClick={() => void handleDelete(vt.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
