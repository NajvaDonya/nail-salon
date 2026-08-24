'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { PersianCalendar } from '@/components/dashboard/persian-calendar'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Scissors,
  CheckCircle2,
  CreditCard,
  ClipboardList,
} from 'lucide-react'
import {
  formatJalaliDate,
  formatJalaliTime,
  convertPersianToEnglishDigits,
  toDateKey,
} from '@/lib/jalali'
import { getHoldToken, releaseHoldToken } from '@/lib/hold-token'
import { useAuth } from '@/contexts/auth-context'
import { CharacterTip } from '@/components/salon/character-tip'
import useSWR from 'swr'

interface Service {
  id: string
  name: string
  price: number
  duration: number
  depositAmount: number
  category: string | null
  kind: 'BASE' | 'ADDON'
}

interface Staff {
  id: string
  user: { firstName: string; lastName: string; avatar: string | null }
  specialties: string[]
  averageRating: number
}

interface QuoteLineItem {
  serviceId: string
  name: string
  quantity: number
  duration: number
  finalPrice: number
  deposit: number
  kind: 'BASE' | 'ADDON'
}

interface BookingQuote {
  lineItems: QuoteLineItem[]
  occupiedMinutes: number
  totalPrice: number
  depositAmount: number
  balanceDue: number
  qualifiedStaffIds: string[]
}

interface TimeSlot {
  start: string
  end: string
  available: boolean
}

async function bookingFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'خطا در دریافت اطلاعات')
  }
  return data as T
}

const steps = [
  { id: 1, title: 'خدمات', icon: Scissors },
  { id: 2, title: 'خلاصه', icon: ClipboardList },
  { id: 3, title: 'زمان نوبت', icon: Calendar },
  { id: 4, title: 'پرداخت', icon: CreditCard },
]

function SummaryCard({
  quote,
  selectedStaff,
  selectedDate,
  selectedSlot,
  showDeposit = true,
}: {
  quote: BookingQuote | null
  selectedStaff: Staff | null
  selectedDate: Date | null
  selectedSlot: TimeSlot | null
  showDeposit?: boolean
}) {
  if (!quote) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">خلاصه نوبت</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <span className="text-muted-foreground block mb-1">خدمات:</span>
          <ul className="space-y-1">
            {quote.lineItems.map((item) => (
              <li key={item.serviceId} className="flex justify-between gap-2">
                <span>
                  {item.name}
                  {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                </span>
                <span>{item.finalPrice.toLocaleString('fa-IR')} تومان</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">مدت زمان:</span>
          <span>{quote.occupiedMinutes} دقیقه</span>
        </div>
        {selectedStaff && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">پرسنل:</span>
            <span>
              {selectedStaff.user.firstName} {selectedStaff.user.lastName}
            </span>
          </div>
        )}
        {selectedDate && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">تاریخ:</span>
            <span>{formatJalaliDate(selectedDate, 'EEEE d MMMM yyyy')}</span>
          </div>
        )}
        {selectedSlot && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">ساعت:</span>
            <span>{formatJalaliTime(selectedSlot.start)}</span>
          </div>
        )}
        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between">
            <span>مبلغ کل:</span>
            <span>{quote.totalPrice.toLocaleString('fa-IR')} تومان</span>
          </div>
          {showDeposit && (
            <>
              <div className="flex justify-between font-bold text-primary">
                <span>بیعانه (پرداخت آنلاین):</span>
                <span>{quote.depositAmount.toLocaleString('fa-IR')} تومان</span>
              </div>
              {quote.balanceDue > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>مانده در سالن:</span>
                  <span>{quote.balanceDue.toLocaleString('fa-IR')} تومان</span>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function BookingFlow({
  salonSlug,
  returnTo,
  maxAdvanceBookingDays = 30,
}: {
  salonSlug: string
  returnTo?: string
  maxAdvanceBookingDays?: number
}) {
  const searchParams = useSearchParams()
  const { user, refreshUser } = useAuth()
  const isCustomerLoggedIn = user?.role === 'CUSTOMER'
  const paymentReturnTo = returnTo || `/salon/${salonSlug}/book`

  const [currentStep, setCurrentStep] = useState(1)
  const [baseServiceIds, setBaseServiceIds] = useState<string[]>([])
  const [quote, setQuote] = useState<BookingQuote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [quoteLoading, setQuoteLoading] = useState(false)

  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [calendarViewDate, setCalendarViewDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

  const [customerPhone, setCustomerPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [trackingCode, setTrackingCode] = useState('')
  const [slotHoldError, setSlotHoldError] = useState('')
  const [checkoutError, setCheckoutError] = useState('')

  const holdToken = useMemo(() => getHoldToken(), [])
  const holdApiUrl = `/api/salons/${salonSlug}/slots/hold`

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const maxBookingDate = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() + maxAdvanceBookingDays)
    d.setHours(23, 59, 59, 999)
    return d
  }, [today, maxAdvanceBookingDays])

  const normalizedPhone = convertPersianToEnglishDigits(customerPhone).replace(/\D/g, '')
  const isPhoneValid = /^09\d{9}$/.test(normalizedPhone)

  const {
    data: servicesData,
    error: servicesError,
    isLoading: servicesLoading,
  } = useSWR<{ services: Service[] }>(
    `/api/salons/${salonSlug}/services`,
    bookingFetcher
  )

  const baseServices = useMemo(
    () => (servicesData?.services ?? []).filter((s) => s.kind === 'BASE'),
    [servicesData]
  )

  const servicesByCategory = useMemo(() => {
    const map = new Map<string, Service[]>()
    for (const service of baseServices) {
      const cat = service.category || 'سایر'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(service)
    }
    return map
  }, [baseServices])

  const slotsQuery = useMemo(() => {
    if (!selectedStaff || !selectedDate || !quote) return null
    const params = new URLSearchParams({
      staffId: selectedStaff.id,
      date: toDateKey(selectedDate),
      baseServiceIds: baseServiceIds.join(','),
      selections: JSON.stringify([]),
      holdToken,
    })
    return `/api/salons/${salonSlug}/slots?${params}`
  }, [selectedStaff, selectedDate, quote, baseServiceIds, holdToken, salonSlug])

  const { data: slotsData } = useSWR<{ slots: TimeSlot[] }>(slotsQuery, bookingFetcher, {
    refreshInterval: currentStep === 3 ? 5000 : 0,
  })

  const { data: qualifiedStaffData } = useSWR<{ staff: Staff[] }>(
    quote && currentStep >= 3
      ? `/api/salons/${salonSlug}/staff?services=${quote.lineItems.map((l) => l.serviceId).join(',')}&qualifiedOnly=true`
      : null,
    bookingFetcher
  )

  const staffList = useMemo(() => {
    if (!quote) return []
    const ids = new Set(quote.qualifiedStaffIds)
    return (qualifiedStaffData?.staff ?? []).filter((s) => ids.has(s.id))
  }, [quote, qualifiedStaffData])

  const resetScheduling = useCallback(() => {
    setSelectedStaff(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setSlotHoldError('')
  }, [])

  const fetchQuote = useCallback(async () => {
    if (baseServiceIds.length === 0) return null
    setQuoteLoading(true)
    setQuoteError('')
    try {
      const res = await fetch(`/api/salons/${salonSlug}/booking/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseServiceIds,
          selections: [],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در محاسبه')
      setQuote(data.quote)
      return data.quote as BookingQuote
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : 'خطا در محاسبه')
      setQuote(null)
      return null
    } finally {
      setQuoteLoading(false)
    }
  }, [salonSlug, baseServiceIds])

  useEffect(() => {
    const payment = searchParams.get('payment')
    const code = searchParams.get('code')
    if (payment === 'success') {
      setBookingSuccess(true)
      if (code) setTrackingCode(code)
    }
  }, [searchParams])

  useEffect(() => {
    return () => {
      releaseHoldToken(holdToken, holdApiUrl).catch(() => {})
    }
  }, [holdToken, holdApiUrl])

  useEffect(() => {
    if (currentStep === 2) {
      void fetchQuote()
    }
  }, [currentStep, fetchQuote])

  const toggleBaseService = (serviceId: string) => {
    resetScheduling()
    setQuote(null)
    setBaseServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    )
  }

  const handleStaffChange = (staffId: string) => {
    const member = staffList.find((s) => s.id === staffId) ?? null
    setSelectedStaff(member)
    setSelectedDate(null)
    setSelectedSlot(null)
    setSlotHoldError('')
  }

  const refreshHold = async (silent = false) => {
    if (!selectedStaff || !selectedDate || !selectedSlot || !quote) return false
    try {
      const res = await fetch(holdApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdToken,
          date: toDateKey(selectedDate),
          startTime: selectedSlot.start,
          baseServiceIds,
          selections: [],
          staffId: selectedStaff.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در رزرو موقت')
      if (!silent) setSlotHoldError('')
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در رزرو موقت'
      if (!silent) setSlotHoldError(msg)
      return false
    }
  }

  useEffect(() => {
    if (currentStep === 4 && selectedSlot) {
      void refreshHold(true)
      const timer = setInterval(() => void refreshHold(true), 120000)
      return () => clearInterval(timer)
    }
  }, [currentStep, selectedSlot])

  const selectSlot = async (slot: TimeSlot) => {
    setSelectedSlot(slot)
    setSlotHoldError('')
    if (!selectedStaff || !selectedDate || !quote) return
    try {
      const res = await fetch(holdApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holdToken,
          date: toDateKey(selectedDate),
          startTime: slot.start,
          baseServiceIds,
          selections: [],
          staffId: selectedStaff.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در رزرو موقت')
    } catch (err) {
      setSlotHoldError(err instanceof Error ? err.message : 'خطا در رزرو موقت')
      setSelectedSlot(null)
    }
  }

  const sendOtp = async () => {
    setOtpError('')
    setIsSendingOtp(true)
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در ارسال کد')
      setOtpSent(true)
      if (data.code) setDevOtpCode(data.code)
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'خطا در ارسال کد')
    } finally {
      setIsSendingOtp(false)
    }
  }

  const verifyOtp = async () => {
    if (otpCode.length !== 6) return
    setOtpError('')
    setIsVerifyingOtp(true)
    try {
      const nameParts = customerName.trim().split(' ')
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: normalizedPhone,
          code: otpCode,
          firstName: nameParts[0] || 'مشتری',
          lastName: nameParts.slice(1).join(' ') || '',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'کد تایید نامعتبر است')
      await refreshUser()
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'خطا در تایید کد')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const handlePayment = async () => {
    setCheckoutError('')
    setIsSubmitting(true)
    try {
      const holdOk = await refreshHold(true)
      if (!holdOk) throw new Error('رزرو موقت زمان منقضی شده — لطفاً دوباره زمان را انتخاب کنید')

      const res = await fetch(`/api/salons/${salonSlug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          baseServiceIds,
          selections: [],
          staffId: selectedStaff?.id,
          date: selectedDate ? toDateKey(selectedDate) : undefined,
          startTime: selectedSlot?.start,
          notes: customerNotes,
          holdToken,
          returnTo: paymentReturnTo,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) setSlotHoldError(data.error || 'رزرو موقت منقضی شده')
        throw new Error(data.error || 'خطا در ثبت نوبت')
      }
      window.location.href = data.paymentUrl
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'خطا در پرداخت')
      setIsSubmitting(false)
    }
  }

  const nextStep = () => setCurrentStep((s) => Math.min(s + 1, 4))
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 1))

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return baseServiceIds.length > 0
      case 2:
        return quote !== null && !quoteLoading && quote.depositAmount > 0
      case 3:
        return selectedStaff !== null && selectedDate !== null && selectedSlot !== null && !slotHoldError
      default:
        return false
    }
  }

  const availableSlots = (slotsData?.slots ?? []).filter((slot) => slot.available)

  if (bookingSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
      >
        <CheckCircle2 className="w-16 h-16 text-success mb-4" />
        <h2 className="text-2xl font-bold mb-2">بیعانه پرداخت شد — نوبت ثبت شد!</h2>
        {trackingCode && (
          <p className="text-muted-foreground mb-2">
            کد پیگیری: <span className="font-mono font-bold">{trackingCode}</span>
          </p>
        )}
        <Button asChild className="mt-4">
          <Link href="/account">مشاهده نوبت‌های من</Link>
        </Button>
      </motion.div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div
              className={`flex flex-col items-center ${
                currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center mb-1 ${
                  currentStep > step.id
                    ? 'bg-primary text-primary-foreground'
                    : currentStep === step.id
                      ? 'bg-primary/20 border-2 border-primary'
                      : 'bg-muted'
                }`}
              >
                <step.icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-medium whitespace-nowrap">{step.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 md:w-16 h-0.5 mx-1 ${currentStep > step.id ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={currentStep} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
          {currentStep === 1 && (
            <div className="space-y-6">
              <CharacterTip message="سلام! 👋 خدمات مورد نظرت را انتخاب کن — می‌توانی چندتا با هم انتخاب کنی" />
              <h2 className="text-xl font-bold">انتخاب خدمات</h2>
              {servicesLoading && (
                <p className="text-center text-muted-foreground">در حال بارگذاری خدمات...</p>
              )}
              {servicesError && (
                <p className="text-destructive text-center text-sm">
                  {servicesError instanceof Error ? servicesError.message : 'خطا در دریافت خدمات'}
                </p>
              )}
              {!servicesLoading && !servicesError && baseServices.length === 0 && (
                <p className="text-muted-foreground text-center rounded-lg border border-dashed p-6">
                  هنوز خدمت پایه‌ای تعریف نشده. مدیر سالن باید از بخش خدمات، خدمات فعال با نوع «خدمت
                  پایه» اضافه کند.
                </p>
              )}
              {baseServiceIds.length > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  {baseServiceIds.length} خدمت انتخاب شده
                </p>
              )}
              {[...servicesByCategory.entries()].map(([category, items]) => (
                <div key={category}>
                  <h3 className="font-medium mb-3 text-muted-foreground">{category}</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {items.map((service) => (
                      <Card
                        key={service.id}
                        className={`cursor-pointer ${
                          baseServiceIds.includes(service.id) ? 'ring-2 ring-primary bg-primary/5' : ''
                        }`}
                        onClick={() => toggleBaseService(service.id)}
                      >
                        <CardContent className="p-4 flex justify-between">
                          <div>
                            <p className="font-semibold">{service.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {service.duration} دقیقه · بیعانه{' '}
                              {service.depositAmount.toLocaleString('fa-IR')} تومان
                            </p>
                          </div>
                          <span className="font-bold text-primary">
                            {service.price.toLocaleString('fa-IR')}
                          </span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">خلاصه و محاسبه</h2>
              {quoteLoading && <p className="text-center text-muted-foreground">در حال محاسبه...</p>}
              {quoteError && <p className="text-destructive text-center">{quoteError}</p>}
              <SummaryCard quote={quote} selectedStaff={null} selectedDate={null} selectedSlot={null} />
              {quote && quote.depositAmount <= 0 && (
                <p className="text-destructive text-sm text-center">
                  برای این ترکیب خدمات بیعانه تنظیم نشده — با سالن تماس بگیرید
                </p>
              )}
            </div>
          )}

          {currentStep === 3 && quote && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">انتخاب پرسنل و زمان</h2>
              <p className="text-sm text-muted-foreground">
                مدت نوبت: {quote.occupiedMinutes} دقیقه — ابتدا پرسنل را انتخاب کنید، سپس تاریخ و ساعت
              </p>

              <div className="space-y-2">
                <Label htmlFor="staff-select">پرسنل</Label>
                {staffList.length === 0 ? (
                  <p className="text-muted-foreground text-sm">پرسنل واجد شرایطی یافت نشد</p>
                ) : (
                  <Select
                    value={selectedStaff?.id ?? ''}
                    onValueChange={handleStaffChange}
                  >
                    <SelectTrigger id="staff-select">
                      <SelectValue placeholder="انتخاب پرسنل" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.user.firstName} {member.user.lastName}
                          {member.averageRating > 0 ? ` — ★ ${member.averageRating.toFixed(1)}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {selectedStaff && (
                <Card>
                  <CardContent className="p-6">
                    <PersianCalendar
                      viewDate={calendarViewDate}
                      selectedDate={selectedDate ?? today}
                      onViewDateChange={setCalendarViewDate}
                      onSelectDate={(date) => {
                        setSelectedDate(date)
                        setSelectedSlot(null)
                      }}
                      minDate={today}
                      maxDate={maxBookingDate}
                    />
                  </CardContent>
                </Card>
              )}

              {selectedStaff && selectedDate && (
                <div className="space-y-2">
                  <Label>ساعت‌های خالی</Label>
                  {availableSlots.length === 0 ? (
                    <p className="text-muted-foreground text-sm">زمان خالی برای این روز وجود ندارد</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableSlots.map((slot) => (
                        <Button
                          key={slot.start}
                          type="button"
                          variant={selectedSlot?.start === slot.start ? 'default' : 'outline'}
                          onClick={() => void selectSlot(slot)}
                        >
                          {formatJalaliTime(slot.start)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {slotHoldError && <p className="text-destructive text-sm">{slotHoldError}</p>}
            </div>
          )}

          {currentStep === 4 && quote && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h2 className="text-xl font-bold">پرداخت بیعانه</h2>
                {!isCustomerLoggedIn && (
                  <>
                    <div className="space-y-2">
                      <Label>شماره موبایل</Label>
                      <Input
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        dir="ltr"
                        placeholder="09123456789"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>نام و نام خانوادگی</Label>
                      <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                    </div>
                    {!otpSent ? (
                      <Button
                        onClick={() => void sendOtp()}
                        disabled={!isPhoneValid || isSendingOtp}
                        className="w-full"
                      >
                        {isSendingOtp ? 'در حال ارسال...' : 'ارسال کد تایید'}
                      </Button>
                    ) : (
                      <>
                        <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                          <InputOTPGroup>
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                              <InputOTPSlot key={i} index={i} />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                        {devOtpCode && (
                          <p className="text-xs text-muted-foreground">کد تست: {devOtpCode}</p>
                        )}
                        <Button
                          onClick={() => void verifyOtp()}
                          disabled={otpCode.length !== 6 || isVerifyingOtp}
                          className="w-full"
                        >
                          {isVerifyingOtp ? 'در حال تایید...' : 'تایید کد'}
                        </Button>
                      </>
                    )}
                    {otpError && <p className="text-destructive text-sm">{otpError}</p>}
                  </>
                )}
                <div className="space-y-2">
                  <Label>یادداشت (اختیاری)</Label>
                  <Textarea value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} rows={2} />
                </div>
                {checkoutError && <p className="text-destructive text-sm">{checkoutError}</p>}
                {isCustomerLoggedIn && (
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={isSubmitting}
                    onClick={() => void handlePayment()}
                  >
                    {isSubmitting
                      ? 'در حال انتقال...'
                      : `پرداخت بیعانه ${quote.depositAmount.toLocaleString('fa-IR')} تومان`}
                  </Button>
                )}
              </div>
              <SummaryCard
                quote={quote}
                selectedStaff={selectedStaff}
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={prevStep} disabled={currentStep === 1}>
          <ArrowRight className="w-4 h-4 ml-2" />
          قبلی
        </Button>
        {currentStep < 4 && (
          <Button onClick={nextStep} disabled={!canProceed()}>
            بعدی
            <ArrowLeft className="w-4 h-4 mr-2" />
          </Button>
        )}
      </div>
    </div>
  )
}
