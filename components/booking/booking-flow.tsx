'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { PersianCalendar } from '@/components/dashboard/persian-calendar'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  User,
  Scissors,
  CheckCircle2,
  Star,
  Phone,
  CreditCard,
  History,
} from 'lucide-react'
import {
  formatJalaliDate,
  formatJalaliTime,
  convertPersianToEnglishDigits,
  toDateKey,
} from '@/lib/jalali'
import { getHoldToken, releaseHoldToken } from '@/lib/hold-token'
import { useAuth } from '@/contexts/auth-context'
import useSWR from 'swr'

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  duration: number
  category: string | null
}

interface Staff {
  id: string
  user: {
    firstName: string
    lastName: string
    avatar: string | null
  }
  specialties: string[]
  averageRating: number
}

interface TimeSlot {
  start: string
  end: string
  available: boolean
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const steps = [
  { id: 1, title: 'تقویم', icon: Calendar },
  { id: 2, title: 'خدمات', icon: Scissors },
  { id: 3, title: 'متخصص و زمان', icon: User },
  { id: 4, title: 'ساعت', icon: Clock },
  { id: 5, title: 'ورود و پرداخت', icon: CreditCard },
]

function BookingSummary({
  selectedServices,
  selectedStaff,
  selectedDate,
  selectedSlot,
  totalPrice,
}: {
  selectedServices: Service[]
  selectedStaff: Staff | null
  selectedDate: Date
  selectedSlot: TimeSlot | null
  totalPrice: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">خلاصه نوبت</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">خدمات:</span>
          <span>{selectedServices.map((s) => s.name).join('، ')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">متخصص:</span>
          <span>
            {selectedStaff?.user.firstName} {selectedStaff?.user.lastName}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">تاریخ:</span>
          <span>{formatJalaliDate(selectedDate, 'EEEE d MMMM yyyy')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">ساعت:</span>
          <span>{selectedSlot && formatJalaliTime(selectedSlot.start)}</span>
        </div>
        <div className="border-t pt-3 flex justify-between font-bold text-lg">
          <span>مبلغ قابل پرداخت:</span>
          <span className="text-primary">{totalPrice.toLocaleString('fa-IR')} تومان</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function BookingFlow({ salonSlug }: { salonSlug: string }) {
  const searchParams = useSearchParams()
  const { user, refreshUser } = useAuth()
  const isCustomerLoggedIn = user?.role === 'CUSTOMER'
  const [currentStep, setCurrentStep] = useState(1)
  const [calendarViewDate, setCalendarViewDate] = useState(new Date())
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [isExistingCustomer, setIsExistingCustomer] = useState<boolean | null>(null)
  const [needsCustomerName, setNeedsCustomerName] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
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

  const { data: servicesData } = useSWR<{ services: Service[] }>(
    `/api/salons/${salonSlug}/services`,
    fetcher
  )

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0)
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0)

  const { data: staffData } = useSWR<{ staff: Staff[] }>(
    selectedServices.length > 0
      ? `/api/salons/${salonSlug}/staff?services=${selectedServices.map((s) => s.id).join(',')}`
      : null,
    fetcher
  )

  const availabilityUrl =
    selectedServices.length > 0 && selectedDate
      ? `/api/salons/${salonSlug}/staff/availability?date=${toDateKey(selectedDate)}&serviceIds=${selectedServices.map((s) => s.id).join(',')}&holdToken=${holdToken}`
      : null

  const { data: availabilityData, isLoading: availabilityLoading } = useSWR<{
    availability: Array<{ staffId: string; slots: string[] }>
  }>(availabilityUrl, fetcher, { refreshInterval: currentStep >= 3 ? 10000 : 0 })

  const slotsByStaff = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const item of availabilityData?.availability ?? []) {
      map.set(item.staffId, item.slots)
    }
    return map
  }, [availabilityData])

  const slotsUrl =
    selectedStaff && selectedDate && selectedServices.length > 0
      ? `/api/salons/${salonSlug}/slots?staffId=${selectedStaff.id}&date=${toDateKey(selectedDate)}&serviceIds=${selectedServices.map((s) => s.id).join(',')}&holdToken=${holdToken}`
      : null

  const { data: slotsData, isLoading: slotsLoading, mutate: refreshSlots } = useSWR<{
    slots: TimeSlot[]
  }>(slotsUrl, fetcher, { refreshInterval: currentStep === 4 ? 5000 : 0 })

  const services = servicesData?.services || []
  const staff = staffData?.staff || []
  const slots = slotsData?.slots || []

  useEffect(() => {
    const payment = searchParams.get('payment')
    const code = searchParams.get('code')
    if (payment === 'success') {
      setBookingSuccess(true)
      setTrackingCode(code || '')
    }
  }, [searchParams])

  useEffect(() => {
    setSelectedStaff(null)
    setSelectedSlot(null)
    setSlotHoldError('')
  }, [selectedDate?.toDateString(), selectedServices.map((s) => s.id).join(',')])

  useEffect(() => {
    if (!selectedSlot || !selectedStaff || !selectedDate || selectedServices.length === 0) return

    let cancelled = false

    const reserveSlot = async () => {
      setSlotHoldError('')
      try {
        const res = await fetch(holdApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            holdToken,
            staffId: selectedStaff.id,
            date: toDateKey(selectedDate),
            startTime: selectedSlot.start,
            serviceIds: selectedServices.map((s) => s.id),
          }),
        })

        if (cancelled) return

        if (!res.ok) {
          const data = await res.json()
          setSlotHoldError(data.error || 'این زمان دیگر در دسترس نیست')
          setSelectedSlot(null)
          await refreshSlots()
        }
      } catch {
        if (!cancelled) setSlotHoldError('خطا در رزرو موقت زمان')
      }
    }

    reserveSlot()
    return () => {
      cancelled = true
    }
  }, [selectedSlot?.start, selectedStaff?.id, selectedDate, holdToken, holdApiUrl, selectedServices, refreshSlots])

  useEffect(() => {
    if (selectedSlot || !holdToken) return
    void releaseHoldToken(holdToken, holdApiUrl)
  }, [selectedSlot, holdToken, holdApiUrl])

  useEffect(() => {
    return () => {
      void releaseHoldToken(holdToken, holdApiUrl)
    }
  }, [holdToken, holdApiUrl])

  const normalizedPhone = convertPersianToEnglishDigits(customerPhone).replace(/\D/g, '')

  const toggleService = (service: Service) => {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s.id === service.id)
      if (exists) return prev.filter((s) => s.id !== service.id)
      return [...prev, service]
    })
  }

  function slotEndFromStart(start: string, durationMinutes: number): string {
    const [h, m] = start.split(':').map(Number)
    const total = h * 60 + m + durationMinutes
    const eh = Math.floor(total / 60)
    const em = total % 60
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`
  }

  function selectStaffAndTime(member: Staff, start: string) {
    setSelectedStaff(member)
    setSelectedSlot({
      start,
      end: slotEndFromStart(start, totalDuration),
      available: true,
    })
    setCurrentStep(4)
  }

  const isPhoneValid = Boolean(normalizedPhone.match(/^09\d{9}$/))

  const lookupCustomer = async (): Promise<boolean | null> => {
    if (!isPhoneValid) return null
    setLookupLoading(true)
    setOtpError('')
    try {
      const res = await fetch(
        `/api/salons/${salonSlug}/customers/lookup?phone=${encodeURIComponent(normalizedPhone)}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در بررسی مشتری')
      const exists = Boolean(data.exists)
      setIsExistingCustomer(exists)
      setNeedsCustomerName(!exists && Boolean(data.needsName ?? true))
      if (exists && data.name) {
        setCustomerName(data.name)
      } else if (!exists) {
        setCustomerName('')
      }
      return exists
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'خطا در بررسی مشتری')
      return null
    } finally {
      setLookupLoading(false)
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
      const payload: Record<string, string> = {
        phone: normalizedPhone,
        code: otpCode,
      }
      if (!isExistingCustomer && needsCustomerName) {
        payload.firstName = nameParts[0] || 'مشتری'
        payload.lastName = nameParts.slice(1).join(' ') || ''
      }

      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'کد تایید نامعتبر است')
      await refreshUser()
      setCustomerPhone(normalizedPhone)
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : 'خطا در تایید کد')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const handleLoginContinue = async () => {
    if (!isPhoneValid) {
      setOtpError('شماره موبایل معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹)')
      return
    }

    if (otpSent) {
      if (otpCode.length !== 6) {
        setOtpError('کد تایید ۶ رقمی را وارد کنید')
        return
      }
      if (needsCustomerName && customerName.trim().length < 2) {
        setOtpError('نام و نام خانوادگی را وارد کنید')
        return
      }
      await verifyOtp()
      return
    }

    if (isExistingCustomer === null) {
      const exists = await lookupCustomer()
      if (exists === true) {
        await sendOtp()
      }
      return
    }

    if (needsCustomerName && customerName.trim().length < 2) {
      setOtpError('نام و نام خانوادگی را وارد کنید')
      return
    }

    await sendOtp()
  }

  const canLoginContinue = () => {
    if (!isPhoneValid) return false
    if (lookupLoading || isSendingOtp || isVerifyingOtp) return false
    if (otpSent) {
      return (
        otpCode.length === 6 &&
        (!needsCustomerName || customerName.trim().length >= 2)
      )
    }
    if (needsCustomerName) {
      return customerName.trim().length >= 2
    }
    return true
  }

  const loginContinueLabel = () => {
    if (lookupLoading || isSendingOtp || isVerifyingOtp) return 'لطفاً صبر کنید...'
    if (otpSent) return 'تایید و ادامه به پرداخت'
    if (isExistingCustomer === false) return 'ارسال کد تایید'
    return 'ادامه'
  }

  const handlePayment = async () => {
    setCheckoutError('')
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/salons/${salonSlug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          serviceIds: selectedServices.map((s) => s.id),
          staffId: selectedStaff?.id,
          date: toDateKey(selectedDate),
          startTime: selectedSlot?.start,
          notes: customerNotes,
          holdToken,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'خطا در ثبت نوبت')
      window.location.href = data.paymentUrl
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'خطا در پرداخت')
      setIsSubmitting(false)
    }
  }

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedDate !== null
      case 2:
        return selectedServices.length > 0
      case 3:
        return selectedStaff !== null && selectedSlot !== null
      case 4:
        return selectedSlot !== null && !slotHoldError
      default:
        return false
    }
  }

  if (bookingSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mb-6"
        >
          <CheckCircle2 className="w-12 h-12 text-success" />
        </motion.div>
        <h2 className="text-2xl font-bold text-foreground mb-2">پرداخت موفق — نوبت شما ثبت شد!</h2>
        {trackingCode && (
          <p className="text-muted-foreground mb-2">
            کد پیگیری: <span className="font-mono font-bold">{trackingCode}</span>
          </p>
        )}
          <p className="text-muted-foreground mb-6">
          جزئیات نوبت به شماره {user?.phone || customerPhone || normalizedPhone} پیامک شد.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/account">مشاهده نوبت‌های من</Link>
          </Button>
          <Button variant="outline" onClick={() => window.location.href = `/salon/${salonSlug}/book`}>
            رزرو نوبت جدید
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-end mb-4">
        {currentStep > 1 && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/account">
              <History className="w-4 h-4 ml-2" />
              نوبت‌های من
            </Link>
          </Button>
        )}
      </div>

      {currentStep > 1 && (
        <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <motion.div
                className={`flex flex-col items-center ${
                  currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${
                    currentStep > step.id
                      ? 'bg-primary text-primary-foreground'
                      : currentStep === step.id
                        ? 'bg-primary/20 border-2 border-primary'
                        : 'bg-muted'
                  }`}
                >
                  {currentStep > step.id ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className="text-xs font-medium whitespace-nowrap">{step.title}</span>
              </motion.div>
              {index < steps.length - 1 && (
                <div
                  className={`w-8 md:w-16 h-0.5 mx-1 transition-colors ${
                    currentStep > step.id ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {currentStep > 1 && selectedServices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-muted/50 rounded-xl p-4 mb-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {selectedDate && (
                <Badge variant="outline">{formatJalaliDate(selectedDate, 'EEEE d MMMM')}</Badge>
              )}
              {selectedServices.map((service) => (
                <Badge key={service.id} variant="secondary">
                  {service.name}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                <Clock className="w-4 h-4 inline ml-1" />
                {totalDuration} دقیقه
              </span>
              <span className="font-bold text-primary">
                {totalPrice.toLocaleString('fa-IR')} تومان
              </span>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {currentStep === 1 && (
            <div className="flex flex-col items-center">
              <h2 className="text-2xl font-bold mb-2 text-center">تاریخ نوبت خود را انتخاب کنید</h2>
              <p className="text-muted-foreground mb-8 text-center">
                ابتدا روز مورد نظر را از تقویم انتخاب کنید
              </p>
              <Card className="w-full max-w-lg">
                <CardContent className="p-6">
                  <PersianCalendar
                    viewDate={calendarViewDate}
                    selectedDate={selectedDate}
                    onViewDateChange={setCalendarViewDate}
                    onSelectDate={(date) => {
                      setSelectedDate(date)
                      setSelectedSlot(null)
                    }}
                    minDate={today}
                  />
                </CardContent>
              </Card>
              {selectedDate && (
                <p className="mt-4 text-sm text-primary font-medium">
                  {formatJalaliDate(selectedDate, 'EEEE d MMMM yyyy')}
                </p>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-6">خدمات مورد نظر خود را انتخاب کنید</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service) => (
                  <Card
                    key={service.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedServices.find((s) => s.id === service.id)
                        ? 'ring-2 ring-primary bg-primary/5'
                        : ''
                    }`}
                    onClick={() => toggleService(service)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{service.name}</h3>
                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span>
                              <Clock className="w-3 h-3 inline ml-1" />
                              {service.duration} دقیقه
                            </span>
                          </div>
                        </div>
                        <span className="font-bold text-primary">
                          {service.price.toLocaleString('fa-IR')} تومان
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-bold mb-2">متخصص و زمان خالی</h2>
              <p className="text-muted-foreground text-sm mb-6">
                برای {formatJalaliDate(selectedDate, 'EEEE d MMMM')} — زمان‌های خالی هر پرسنل
              </p>
              {availabilityLoading && (
                <p className="text-center text-muted-foreground py-8">در حال بارگذاری زمان‌های خالی...</p>
              )}
              <div className="grid grid-cols-1 gap-4">
                {staff.map((member) => {
                  const freeSlots = slotsByStaff.get(member.id) ?? []
                  return (
                    <Card
                      key={member.id}
                      className={`transition-all hover:shadow-md ${
                        selectedStaff?.id === member.id ? 'ring-2 ring-primary bg-primary/5' : ''
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="w-7 h-7 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-semibold">
                                {member.user.firstName} {member.user.lastName}
                              </h3>
                              {member.averageRating > 0 && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Star className="w-4 h-4 fill-warning text-warning" />
                                  {member.averageRating.toFixed(1)}
                                </div>
                              )}
                            </div>
                            {!availabilityLoading && freeSlots.length === 0 && (
                              <p className="text-sm text-muted-foreground mt-2">زمان خالی ندارد</p>
                            )}
                            {freeSlots.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs text-muted-foreground mb-2">
                                  {freeSlots.length} زمان خالی
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {freeSlots.map((time) => (
                                    <Button
                                      key={time}
                                      type="button"
                                      size="sm"
                                      variant={
                                        selectedStaff?.id === member.id &&
                                        selectedSlot?.start === time
                                          ? 'default'
                                          : 'outline'
                                      }
                                      className="h-9 min-w-[4.5rem]"
                                      onClick={() => selectStaffAndTime(member, time)}
                                    >
                                      {formatJalaliTime(time)}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              {staff.length === 0 && !availabilityLoading && (
                <p className="text-center text-muted-foreground py-8">پرسنلی برای این خدمات یافت نشد</p>
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h2 className="text-xl font-bold mb-2">تایید زمان انتخاب‌شده</h2>
              {selectedStaff && selectedSlot ? (
                <Card className="mb-6">
                  <CardContent className="p-6 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">متخصص:</span>
                      <span className="font-medium">
                        {selectedStaff.user.firstName} {selectedStaff.user.lastName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تاریخ:</span>
                      <span>{formatJalaliDate(selectedDate, 'EEEE d MMMM yyyy')}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-muted-foreground">ساعت:</span>
                      <span className="text-primary">
                        {formatJalaliTime(selectedSlot.start)} تا {formatJalaliTime(selectedSlot.end)}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentStep(3)}>
                      تغییر زمان یا پرسنل
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm mb-6">
                    زمان‌های خالی {selectedStaff?.user.firstName} {selectedStaff?.user.lastName}
                    {` — ${formatJalaliDate(selectedDate, 'EEEE d MMMM')}`}
                  </p>
                  {slotsLoading ? (
                    <div className="text-center py-12 text-muted-foreground">در حال بارگذاری...</div>
                  ) : slots.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p>در این روز زمان خالی وجود ندارد.</p>
                      <Button variant="outline" className="mt-4" onClick={() => setCurrentStep(3)}>
                        انتخاب پرسنل دیگر
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground mb-4">
                        {slots.length} زمان خالی موجود است
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {slots.map((slot, index) => (
                          <Button
                            key={index}
                            variant={selectedSlot?.start === slot.start ? 'default' : 'outline'}
                            disabled={!slot.available}
                            onClick={() => setSelectedSlot(slot)}
                            className="h-12"
                          >
                            {formatJalaliTime(slot.start)}
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
              {slotHoldError && (
                <p className="text-sm text-destructive text-center mt-4">{slotHoldError}</p>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">ورود و پرداخت</h2>
              <p className="text-muted-foreground text-sm">
                زمان شما انتخاب شد. برای ثبت نوبت وارد شوید و پرداخت را انجام دهید.
              </p>

              <BookingSummary
                selectedServices={selectedServices}
                selectedStaff={selectedStaff}
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                totalPrice={totalPrice}
              />

              {!isCustomerLoggedIn ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">ورود با پیامک</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">شماره موبایل *</Label>
                      <div className="relative">
                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                          value={customerPhone}
                          onChange={(e) => {
                            setCustomerPhone(e.target.value)
                            setIsExistingCustomer(null)
                            setNeedsCustomerName(false)
                            setOtpSent(false)
                            setOtpCode('')
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && canLoginContinue()) {
                              void handleLoginContinue()
                            }
                          }}
                          className="pr-10"
                          dir="ltr"
                        />
                      </div>
                      {lookupLoading && (
                        <p className="text-xs text-muted-foreground">در حال بررسی...</p>
                      )}
                      {isExistingCustomer === true && customerName && (
                        <p className="text-xs text-success">
                          خوش آمدید {customerName} — فقط کد تایید لازم است
                        </p>
                      )}
                      {needsCustomerName && (
                        <p className="text-xs text-muted-foreground">مشتری جدید — نام و کد تایید لازم است</p>
                      )}
                    </div>

                    {needsCustomerName && (
                      <div className="space-y-2">
                        <Label htmlFor="name">نام و نام خانوادگی *</Label>
                        <Input
                          id="name"
                          placeholder="مثال: سارا احمدی"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && canLoginContinue()) {
                              void handleLoginContinue()
                            }
                          }}
                        />
                      </div>
                    )}

                    {isPhoneValid && isExistingCustomer !== null && !otpSent && (
                      <p className="text-xs text-muted-foreground">
                        {isExistingCustomer
                          ? 'با زدن ادامه کد تایید ارسال می‌شود'
                          : 'نام خود را وارد کنید و ادامه را بزنید'}
                      </p>
                    )}

                    {otpSent && (
                      <div className="space-y-3">
                        {devOtpCode && (
                          <div className="rounded-lg bg-muted p-3 text-center text-sm">
                            <p className="text-muted-foreground">حالت تست (بدون پیامک)</p>
                            <p className="font-mono text-lg font-bold tracking-widest dir-ltr">{devOtpCode}</p>
                          </div>
                        )}
                        <Label>کد تایید ۶ رقمی</Label>
                        <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    )}

                    {otpError && <p className="text-sm text-destructive">{otpError}</p>}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <p className="text-sm text-success flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      وارد شده: {user?.firstName} {user?.lastName} ({user?.phone})
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="notes">توضیحات (اختیاری)</Label>
                      <Textarea
                        id="notes"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      پس از پرداخت موفق، نوبت شما ثبت و پیامک تایید ارسال می‌شود.
                    </p>
                    {checkoutError && <p className="text-sm text-destructive">{checkoutError}</p>}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between mt-8">
        {currentStep > 1 ? (
          <Button variant="outline" onClick={prevStep} className="gap-2">
            <ArrowRight className="w-4 h-4" />
            مرحله قبل
          </Button>
        ) : (
          <div />
        )}

        {currentStep < 5 ? (
          <Button onClick={nextStep} disabled={!canProceed()} className="gap-2">
            {currentStep === 3 ? 'انتخاب زمان' : currentStep === 4 ? 'ورود و پرداخت' : 'مرحله بعد'}
            <ArrowLeft className="w-4 h-4" />
          </Button>
        ) : isCustomerLoggedIn ? (
          <Button onClick={handlePayment} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? 'در حال انتقال به درگاه...' : 'پرداخت آنلاین'}
            <CreditCard className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleLoginContinue}
            disabled={!canLoginContinue()}
            className="gap-2"
          >
            {loginContinueLabel()}
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
