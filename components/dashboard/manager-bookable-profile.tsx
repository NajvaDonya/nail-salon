'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Loader2, CalendarClock } from 'lucide-react'

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'خطا در دریافت اطلاعات')
  return data
}

interface BookableService {
  id: string
  name: string
  isActive?: boolean
  kind?: string
}

interface ManagerBookableProfileResponse {
  providesServices: boolean
  staff: {
    id: string
    specialties: string[]
    isActive: boolean
    services: { id: string; name: string }[]
  } | null
}

export function ManagerBookableProfileCard() {
  const { data, error, isLoading, mutate } = useSWR<ManagerBookableProfileResponse>(
    '/api/dashboard/staff/me',
    fetcher
  )
  const { data: servicesData, isLoading: servicesLoading } = useSWR<{ services: BookableService[] }>(
    '/api/dashboard/services',
    fetcher
  )

  const [providesServices, setProvidesServices] = useState(false)
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const bookableServices = (servicesData?.services ?? []).filter(
    (service) => service.isActive !== false && (service.kind ?? 'BASE') === 'BASE'
  )

  useEffect(() => {
    if (!data) return
    setProvidesServices(data.providesServices)
    setServiceIds(data.staff?.services.map((s) => s.id) ?? [])
  }, [data])

  const toggleService = (id: string) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (providesServices && serviceIds.length === 0) {
      toast.error('حداقل یک خدمت برای نمایش در رزرو آنلاین انتخاب کنید')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/dashboard/staff/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          providesServices,
          serviceIds: providesServices ? serviceIds : undefined,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'خطا در ذخیره')
        return
      }
      toast.success('پروفایل رزرو شما ذخیره شد')
      await mutate()
    } catch {
      toast.error('خطا در برقراری ارتباط با سرور')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-destructive text-sm">
          {error.message}
        </CardContent>
      </Card>
    )
  }

  const dirty =
    providesServices !== (data?.providesServices ?? false) ||
    serviceIds.length !== (data?.staff?.services.length ?? 0) ||
    serviceIds.some((id) => !data?.staff?.services.some((s) => s.id === id))

  return (
    <Card>
      <CardHeader>
        <CardTitle>ارائه خدمات توسط مدیر</CardTitle>
        <CardDescription>
          اگر خودتان هم نوبت می‌گیرید، در صفحه رزرو به عنوان متخصص نمایش داده می‌شوید.
          ساعات کاری شخصی را در{' '}
          <Link href="/staff/schedule" className="text-primary underline-offset-4 hover:underline">
            برنامه کاری من
          </Link>{' '}
          تنظیم کنید.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="manager-provides-services">من هم به عنوان متخصص نوبت می‌گیرم</Label>
            <p className="text-xs text-muted-foreground mt-1">
              {providesServices
                ? 'مشتریان می‌توانند شما را در رزرو آنلاین انتخاب کنند'
                : 'در لیست متخصصان رزرو آنلاین نمایش داده نمی‌شوید'}
            </p>
          </div>
          <Switch
            id="manager-provides-services"
            checked={providesServices}
            onCheckedChange={setProvidesServices}
          />
        </div>

        {providesServices && (
          <div className="space-y-2">
            <Label>خدمات قابل ارائه</Label>
            {servicesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                در حال بارگذاری...
              </div>
            ) : bookableServices.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
                ابتدا از بخش خدمات، حداقل یک خدمت پایه تعریف کنید.
              </p>
            ) : (
              <div className="rounded-lg border p-3 space-y-2 max-h-48 overflow-y-auto">
                {bookableServices.map((service) => (
                  <label
                    key={service.id}
                    htmlFor={`manager-service-${service.id}`}
                    className="flex items-center gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`manager-service-${service.id}`}
                      checked={serviceIds.includes(service.id)}
                      onCheckedChange={() => toggleService(service.id)}
                    />
                    <span className="text-sm">{service.name}</span>
                  </label>
                ))}
              </div>
            )}
            {serviceIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {serviceIds.map((id) => {
                  const service = bookableServices.find((s) => s.id === id)
                  if (!service) return null
                  return (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {service.name}
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
          <Button variant="outline" size="sm" asChild>
            <Link href="/staff/schedule">
              <CalendarClock className="w-4 h-4 ml-2" />
              برنامه کاری من
            </Link>
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !dirty}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ذخیره پروفایل رزرو'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
