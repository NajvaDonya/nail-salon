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
  Globe,
  CreditCard
} from 'lucide-react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  type SalonAppearance,
  DEFAULT_SALON_APPEARANCE,
  extractSalonAppearance,
  appearanceStyleVars,
  defaultWelcomeBadge,
  readWelcomeBadge,
  readWelcomeSubtitle,
  resolveWelcomeBadge,
  resolveWelcomeSubtitle,
} from '@/lib/salon-appearance'
import { HueColorSlider, ColorIntensitySlider } from '@/components/salon'
import { ManagerBookableProfileCard } from '@/components/dashboard/manager-bookable-profile'

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'خطا در دریافت تنظیمات')
  }
  return data
}

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
    maxAdvanceBookingDays: number
    appearance?: SalonAppearance
    payment?: SalonPaymentFields
  }
}

interface SalonPaymentFields {
  bankCardNumber?: string
  bankAccountOwner?: string
  paymentPhone?: string
  telegramReceiptUrl?: string
  paymentExpirationMinutes?: number
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

type SettingsDraft = {
  name?: string
  slug?: string
  description?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  openingHours?: SalonSettings['openingHours']
  settings?: {
    allowOnlineBooking?: boolean
    requireConfirmation?: boolean
    sendReminders?: boolean
    reminderHours?: number
    maxAdvanceBookingDays?: number
    appearance?: Partial<SalonAppearance>
    payment?: SalonPaymentFields
  }
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

function mergeSettings(
  base: SalonSettings['settings'] | undefined,
  patch: SettingsDraft['settings'] | undefined
): SalonSettings['settings'] {
  const baseAppearance =
    base?.appearance && typeof base.appearance === 'object' ? base.appearance : {}
  const patchAppearance =
    patch?.appearance && typeof patch.appearance === 'object' ? patch.appearance : {}
  const basePayment = base?.payment && typeof base.payment === 'object' ? base.payment : {}
  const patchPayment = patch?.payment && typeof patch.payment === 'object' ? patch.payment : {}

  return {
    allowOnlineBooking: true,
    requireConfirmation: false,
    sendReminders: true,
    reminderHours: 24,
    maxAdvanceBookingDays: 30,
    ...base,
    ...patch,
    appearance: {
      ...baseAppearance,
      ...patchAppearance,
    } as SalonAppearance,
    payment: {
      ...basePayment,
      ...patchPayment,
    },
  }
}

export default function SettingsPage() {
  const { refreshUser } = useAuth()
  const { data, mutate } = useSWR<{ salon: SalonSettings }>('/api/dashboard/settings', fetcher)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<SettingsDraft>({})
  const [numberDrafts, setNumberDrafts] = useState<{
    reminderHours?: string
    maxAdvanceBookingDays?: string
    paymentExpirationMinutes?: string
  }>({})

  const salon = data?.salon
  const mergedSettings = mergeSettings(salon?.settings, formData.settings)
  const currentData = { ...salon, ...formData, settings: mergedSettings }

  const handleSave = async () => {
    if (Object.keys(formData).length === 0) return

    if (typeof formData.name === 'string' && formData.name.trim().length < 2) {
      toast.error('نام سالن باید حداقل ۲ حرف باشد')
      return
    }
    if (typeof formData.slug === 'string' && formData.slug.trim().length < 2) {
      toast.error('آدرس اینترنتی باید حداقل ۲ حرف باشد')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'خطا در ذخیره تنظیمات')
        return
      }
      toast.success('تنظیمات با موفقیت ذخیره شد')
      await mutate()
      setFormData({})
      setNumberDrafts({})
      await refreshUser()
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('خطا در برقراری ارتباط با سرور')
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const updateOpeningHours = (day: string, field: string, value: unknown) => {
    const currentHours = (currentData.openingHours || defaultOpeningHours) as Record<
      string,
      { open: string; close: string; isOpen: boolean }
    >
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

  const defaultSettings: SalonSettings['settings'] = {
    allowOnlineBooking: true,
    requireConfirmation: false,
    sendReminders: true,
    reminderHours: 24,
    maxAdvanceBookingDays: 30,
  }

  const updateSettings = (field: keyof NonNullable<SettingsDraft['settings']>, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: value,
      },
    }))
  }

  const updateAppearance = (field: keyof SalonAppearance, value: unknown) => {
    setFormData(prev => {
      const prevAppearance =
        prev.settings?.appearance && typeof prev.settings.appearance === 'object'
          ? prev.settings.appearance
          : {}
      return {
        ...prev,
        settings: {
          ...prev.settings,
          appearance: {
            ...prevAppearance,
            [field]: value,
          },
        },
      }
    })
  }

  const updatePayment = (field: keyof SalonPaymentFields, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        payment: {
          ...prev.settings?.payment,
          [field]: value,
        },
      },
    }))
  }

  const draftAppearance = formData.settings?.appearance
  const welcomeBadgeDraft =
    draftAppearance && Object.prototype.hasOwnProperty.call(draftAppearance, 'welcomeBadge')
      ? String(draftAppearance.welcomeBadge ?? '')
      : undefined
  const welcomeSubtitleDraft =
    draftAppearance && Object.prototype.hasOwnProperty.call(draftAppearance, 'welcomeSubtitle')
      ? String(draftAppearance.welcomeSubtitle ?? '')
      : undefined
  const storedWelcomeBadge = readWelcomeBadge(salon?.settings)
  const storedWelcomeSubtitle = readWelcomeSubtitle(salon?.settings)
  const welcomeBadgeInput =
    welcomeBadgeDraft ??
    storedWelcomeBadge ??
    defaultWelcomeBadge(currentData.name)
  const welcomeSubtitleInput =
    welcomeSubtitleDraft ?? storedWelcomeSubtitle ?? DEFAULT_SALON_APPEARANCE.welcomeSubtitle
  const previewBadge = resolveWelcomeBadge(
    welcomeBadgeDraft ?? storedWelcomeBadge,
    currentData.name
  )
  const previewSubtitle = resolveWelcomeSubtitle(welcomeSubtitleDraft ?? storedWelcomeSubtitle)

  if (!salon) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const openingHours = (currentData.openingHours || defaultOpeningHours) as Record<
    string,
    { open: string; close: string; isOpen: boolean }
  >
  const settings = currentData.settings ?? defaultSettings
  const appearance = extractSalonAppearance(settings)
  const payment = settings.payment ?? {}

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

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  اطلاعات پرداخت
                </CardTitle>
                <CardDescription>
                  مشتری بیعانه را کارت‌به‌کارت واریز و رسید را در تلگرام برای شما ارسال می‌کند
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankCardNumber">شماره کارت</Label>
                    <Input
                      id="bankCardNumber"
                      value={payment.bankCardNumber ?? ''}
                      onChange={(e) => updatePayment('bankCardNumber', e.target.value)}
                      dir="ltr"
                      className="text-left font-mono"
                      placeholder="6037xxxxxxxxxxxx"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAccountOwner">نام صاحب حساب</Label>
                    <Input
                      id="bankAccountOwner"
                      value={payment.bankAccountOwner ?? ''}
                      onChange={(e) => updatePayment('bankAccountOwner', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paymentPhone">شماره موبایل سالن</Label>
                    <Input
                      id="paymentPhone"
                      value={payment.paymentPhone ?? ''}
                      onChange={(e) => updatePayment('paymentPhone', e.target.value)}
                      dir="ltr"
                      className="text-left"
                      placeholder="09123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telegramReceiptUrl">آیدی یا لینک تلگرام برای ارسال رسید</Label>
                    <Input
                      id="telegramReceiptUrl"
                      value={payment.telegramReceiptUrl ?? ''}
                      onChange={(e) => updatePayment('telegramReceiptUrl', e.target.value)}
                      dir="ltr"
                      className="text-left"
                      placeholder="@SalonUsername یا https://t.me/SalonUsername"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentExpirationMinutes">
                    مهلت پرداخت و بررسی رسید (دقیقه)
                  </Label>
                  <Input
                    id="paymentExpirationMinutes"
                    type="number"
                    value={
                      numberDrafts.paymentExpirationMinutes ??
                      String(payment.paymentExpirationMinutes ?? 30)
                    }
                    onChange={(e) => {
                      const raw = e.target.value
                      setNumberDrafts((prev) => ({ ...prev, paymentExpirationMinutes: raw }))
                      if (raw.trim() === '') {
                        setFormData((prev) => {
                          if (!prev.settings?.payment) return prev
                          const nextPayment = { ...prev.settings.payment }
                          delete nextPayment.paymentExpirationMinutes
                          return {
                            ...prev,
                            settings: { ...prev.settings, payment: nextPayment },
                          }
                        })
                        return
                      }
                      const parsed = Number.parseInt(raw, 10)
                      if (!Number.isNaN(parsed)) updatePayment('paymentExpirationMinutes', parsed)
                    }}
                    min={5}
                    max={1440}
                    className="w-32"
                  />
                  <p className="text-sm text-muted-foreground">
                    پس از اعلام ارسال رسید توسط مشتری، همین مدت برای بررسی و تأیید شما فرصت است.
                    تغییر این مقدار روی رزروهای قبلی اثر ندارد.
                  </p>
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

        <TabsContent value="booking" className="mt-6 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ManagerBookableProfileCard />
          </motion.div>
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
                      value={numberDrafts.reminderHours ?? String(settings.reminderHours ?? 24)}
                      onChange={(e) => {
                        const raw = e.target.value
                        setNumberDrafts((prev) => ({ ...prev, reminderHours: raw }))
                        if (raw.trim() === '') {
                          setFormData((prev) => {
                            if (!prev.settings || !('reminderHours' in prev.settings)) return prev
                            const nextSettings = { ...prev.settings }
                            delete nextSettings.reminderHours
                            return { ...prev, settings: nextSettings }
                          })
                          return
                        }
                        const parsed = Number.parseInt(raw, 10)
                        if (!Number.isNaN(parsed)) updateSettings('reminderHours', parsed)
                      }}
                      min={1}
                      max={72}
                      className="w-32"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>حداکثر روزهای رزرو جلوتر</Label>
                  <p className="text-sm text-muted-foreground">
                    مشتریان حداکثر چند روز جلوتر می‌توانند نوبت بگیرند
                  </p>
                  <Input
                    type="number"
                    value={
                      numberDrafts.maxAdvanceBookingDays ??
                      String(settings.maxAdvanceBookingDays ?? 30)
                    }
                    onChange={(e) => {
                      const raw = e.target.value
                      setNumberDrafts((prev) => ({ ...prev, maxAdvanceBookingDays: raw }))
                      if (raw.trim() === '') {
                        setFormData((prev) => {
                          if (!prev.settings || !('maxAdvanceBookingDays' in prev.settings)) return prev
                          const nextSettings = { ...prev.settings }
                          delete nextSettings.maxAdvanceBookingDays
                          return { ...prev, settings: nextSettings }
                        })
                        return
                      }
                      const parsed = Number.parseInt(raw, 10)
                      if (!Number.isNaN(parsed)) updateSettings('maxAdvanceBookingDays', parsed)
                    }}
                    min={0}
                    max={365}
                    className="w-32"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>رنگ‌بندی صفحه رزرو</CardTitle>
                <CardDescription>
                  رنگ دلخواه خود را از طیف رنگی انتخاب کنید — پس‌زمینه، بنر و جزئیات صفحه رزرو به‌صورت خودکار هماهنگ می‌شوند
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <HueColorSlider
                  value={appearance.hue}
                  colorIntensity={appearance.colorIntensity}
                  onChange={(hue) => updateAppearance('hue', hue)}
                />
                <ColorIntensitySlider
                  value={appearance.colorIntensity}
                  onChange={(colorIntensity) => updateAppearance('colorIntensity', colorIntensity)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>متن بنر خوش‌آمدگویی</CardTitle>
                <CardDescription>پیام‌های نمایش داده شده در بالای صفحه رزرو</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="welcomeBadge">برچسب کوچک</Label>
                  <Input
                    id="welcomeBadge"
                    value={welcomeBadgeInput}
                    onChange={(e) => updateAppearance('welcomeBadge', e.target.value)}
                    placeholder={defaultWelcomeBadge(currentData.name) || 'برچسب خوش‌آمد'}
                  />
                  <p className="text-sm text-muted-foreground">
                    می‌توانید هر متنی بنویسید یا فیلد را خالی کنید. تا وقتی خودتان آن را عوض
                    نکنید، با نام سالن نمایش داده می‌شود.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="welcomeSubtitle">توضیح زیر عنوان</Label>
                  <Textarea
                    id="welcomeSubtitle"
                    value={welcomeSubtitleInput}
                    onChange={(e) => updateAppearance('welcomeSubtitle', e.target.value)}
                    placeholder="توضیح صفحه رزرو"
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground">
                    این متن را می‌توانید تغییر دهید یا کاملاً خالی بگذارید.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>نمایش شخصیت ناخن‌کار</Label>
                    <p className="text-sm text-muted-foreground">
                      تصویر شخصیت در بنر و هدر صفحه رزرو
                    </p>
                  </div>
                  <Switch
                    checked={appearance.showCharacter}
                    onCheckedChange={(checked) => updateAppearance('showCharacter', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>پیش‌نمایش</CardTitle>
                <CardDescription>نمای تقریبی صفحه رزرو با تنظیمات فعلی</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="salon-page rounded-3xl overflow-hidden border"
                  style={appearanceStyleVars(appearance)}
                >
                  <div
                    className="salon-banner p-5 text-white text-right space-y-2"
                  >
                    {previewBadge ? (
                      <p className="text-xs font-semibold bg-white/25 inline-block px-2 py-1 rounded-full">
                        {previewBadge}
                      </p>
                    ) : null}
                    <p className="font-bold text-lg">
                      رزرو نوبت — {currentData.name?.trim() || 'سالن شما'}
                    </p>
                    {previewSubtitle ? (
                      <p className="text-sm text-white/85">{previewSubtitle}</p>
                    ) : null}
                  </div>
                  <div className="salon-card m-4 p-4 text-sm salon-text-muted text-center">
                    فرم رزرو نوبت
                  </div>
                </div>
                {Object.keys(formData).length > 0 && (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm text-muted-foreground">
                      برای اعمال تغییرات روی صفحه رزرو، ذخیره کنید.
                    </p>
                    <Button onClick={handleSave} disabled={isSaving}>
                      <Save className="w-4 h-4 ml-2" />
                      {isSaving ? 'در حال ذخیره...' : 'ذخیره ظاهر'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
