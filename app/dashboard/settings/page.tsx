'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Building2, 
  Clock, 
  Bell, 
  Palette,
  Save,
  Phone,
  MapPin,
  Globe
} from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

interface SalonSettings {
  id: string
  name: string
  slug: string
  description: string | null
  phone: string | null
  address: string | null
  city: string | null
  openingHours: Record<string, { open: string; close: string; isOpen: boolean }>
  settings: {
    allowOnlineBooking: boolean
    requireConfirmation: boolean
    sendReminders: boolean
    reminderHours: number
  }
}

const defaultOpeningHours = {
  saturday: { open: '09:00', close: '21:00', isOpen: true },
  sunday: { open: '09:00', close: '21:00', isOpen: true },
  monday: { open: '09:00', close: '21:00', isOpen: true },
  tuesday: { open: '09:00', close: '21:00', isOpen: true },
  wednesday: { open: '09:00', close: '21:00', isOpen: true },
  thursday: { open: '09:00', close: '18:00', isOpen: true },
  friday: { open: '00:00', close: '00:00', isOpen: false },
}

const dayNames: Record<string, string> = {
  saturday: 'شنبه',
  sunday: 'یکشنبه',
  monday: 'دوشنبه',
  tuesday: 'سه‌شنبه',
  wednesday: 'چهارشنبه',
  thursday: 'پنجشنبه',
  friday: 'جمعه',
}

export default function SettingsPage() {
  const { user } = useAuth()
  const { data, mutate } = useSWR<{ salon: SalonSettings }>('/api/dashboard/settings', fetcher)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<Partial<SalonSettings>>({})

  const salon = data?.salon
  const currentData = { ...salon, ...formData }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      mutate()
      setFormData({})
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const updateOpeningHours = (day: string, field: string, value: unknown) => {
    const currentHours = currentData.openingHours || defaultOpeningHours
    setFormData(prev => ({
      ...prev,
      openingHours: {
        ...currentHours,
        [day]: {
          ...currentHours[day],
          [field]: value,
        },
      },
    }))
  }

  const updateSettings = (field: string, value: unknown) => {
    const currentSettings = currentData.settings || {}
    setFormData(prev => ({
      ...prev,
      settings: {
        ...currentSettings,
        [field]: value,
      },
    }))
  }

  if (!salon) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const openingHours = currentData.openingHours || defaultOpeningHours
  const settings = currentData.settings || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">تنظیمات سالن</h1>
          <p className="text-muted-foreground">مدیریت اطلاعات و تنظیمات سالن</p>
        </div>
        {Object.keys(formData).length > 0 && (
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 ml-2" />
            {isSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
          </Button>
        )}
      </div>

      <Tabs defaultValue="general" dir="rtl">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="w-4 h-4" />
            عمومی
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-2">
            <Clock className="w-4 h-4" />
            ساعات کاری
          </TabsTrigger>
          <TabsTrigger value="booking" className="gap-2">
            <Bell className="w-4 h-4" />
            رزرو
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="w-4 h-4" />
            ظاهر
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>اطلاعات سالن</CardTitle>
                <CardDescription>اطلاعات پایه سالن شما</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">نام سالن</Label>
                    <Input
                      id="name"
                      value={currentData.name || ''}
                      onChange={(e) => updateField('name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">آدرس اینترنتی</Label>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <Input
                        id="slug"
                        value={currentData.slug || ''}
                        onChange={(e) => updateField('slug', e.target.value)}
                        dir="ltr"
                        className="text-left"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">توضیحات</Label>
                  <Textarea
                    id="description"
                    value={currentData.description || ''}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">شماره تماس</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={currentData.phone || ''}
                        onChange={(e) => updateField('phone', e.target.value)}
                        className="pr-10"
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">شهر</Label>
                    <Input
                      id="city"
                      value={currentData.city || ''}
                      onChange={(e) => updateField('city', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">آدرس کامل</Label>
                  <div className="relative">
                    <MapPin className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Textarea
                      id="address"
                      value={currentData.address || ''}
                      onChange={(e) => updateField('address', e.target.value)}
                      className="pr-10"
                      rows={2}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="hours" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>ساعات کاری</CardTitle>
                <CardDescription>ساعات کاری سالن در هر روز هفته</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(dayNames).map(([day, name]) => (
                  <div key={day} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                    <div className="w-24">
                      <span className="font-medium">{name}</span>
                    </div>
                    <Switch
                      checked={openingHours[day]?.isOpen ?? true}
                      onCheckedChange={(checked) => updateOpeningHours(day, 'isOpen', checked)}
                    />
                    {openingHours[day]?.isOpen && (
                      <>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground">از</Label>
                          <Input
                            type="time"
                            value={openingHours[day]?.open || '09:00'}
                            onChange={(e) => updateOpeningHours(day, 'open', e.target.value)}
                            className="w-28"
                            dir="ltr"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground">تا</Label>
                          <Input
                            type="time"
                            value={openingHours[day]?.close || '21:00'}
                            onChange={(e) => updateOpeningHours(day, 'close', e.target.value)}
                            className="w-28"
                            dir="ltr"
                          />
                        </div>
                      </>
                    )}
                    {!openingHours[day]?.isOpen && (
                      <span className="text-sm text-muted-foreground">تعطیل</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="booking" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>تنظیمات رزرو</CardTitle>
                <CardDescription>تنظیمات مربوط به سیستم رزرو آنلاین</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>رزرو آنلاین</Label>
                    <p className="text-sm text-muted-foreground">
                      امکان رزرو آنلاین برای مشتریان
                    </p>
                  </div>
                  <Switch
                    checked={settings.allowOnlineBooking ?? true}
                    onCheckedChange={(checked) => updateSettings('allowOnlineBooking', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>نیاز به تایید</Label>
                    <p className="text-sm text-muted-foreground">
                      نوبت‌ها باید توسط مدیر تایید شوند
                    </p>
                  </div>
                  <Switch
                    checked={settings.requireConfirmation ?? false}
                    onCheckedChange={(checked) => updateSettings('requireConfirmation', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>ارسال یادآوری</Label>
                    <p className="text-sm text-muted-foreground">
                      ارسال پیامک یادآوری قبل از نوبت
                    </p>
                  </div>
                  <Switch
                    checked={settings.sendReminders ?? true}
                    onCheckedChange={(checked) => updateSettings('sendReminders', checked)}
                  />
                </div>

                {settings.sendReminders && (
                  <div className="space-y-2">
                    <Label>زمان یادآوری (ساعت قبل از نوبت)</Label>
                    <Input
                      type="number"
                      value={settings.reminderHours || 24}
                      onChange={(e) => updateSettings('reminderHours', parseInt(e.target.value))}
                      min={1}
                      max={72}
                      className="w-32"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>ظاهر صفحه رزرو</CardTitle>
                <CardDescription>سفارشی‌سازی صفحه رزرو مشتریان</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-center py-8">
                  این قابلیت به زودی اضافه خواهد شد...
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
