'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  ArrowRight, 
  Calendar, 
  Clock, 
  User, 
  Scissors, 
  CheckCircle2,
  Star,
  Phone
} from 'lucide-react'
import { formatJalaliDate, formatJalaliTime, getJalaliWeekDays, convertPersianToEnglishDigits } from '@/lib/jalali'
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

const fetcher = (url: string) => fetch(url).then(res => res.json())

const steps = [
  { id: 1, title: 'انتخاب خدمات', icon: Scissors },
  { id: 2, title: 'انتخاب متخصص', icon: User },
  { id: 3, title: 'انتخاب تاریخ', icon: Calendar },
  { id: 4, title: 'انتخاب ساعت', icon: Clock },
  { id: 5, title: 'تایید نهایی', icon: CheckCircle2 },
]

export function BookingFlow({ salonSlug }: { salonSlug: string }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState(false)

  // Fetch services
  const { data: servicesData } = useSWR<{ services: Service[] }>(
    `/api/salons/${salonSlug}/services`,
    fetcher
  )

  // Fetch staff based on selected services
  const { data: staffData } = useSWR<{ staff: Staff[] }>(
    selectedServices.length > 0
      ? `/api/salons/${salonSlug}/staff?services=${selectedServices.map(s => s.id).join(',')}`
      : null,
    fetcher
  )

  // Fetch available slots
  const { data: slotsData } = useSWR<{ slots: TimeSlot[] }>(
    selectedStaff && selectedDate
      ? `/api/salons/${salonSlug}/slots?staffId=${selectedStaff.id}&date=${selectedDate.toISOString()}&duration=${totalDuration}`
      : null,
    fetcher
  )

  const services = servicesData?.services || []
  const staff = staffData?.staff || []
  const slots = slotsData?.slots || []

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0)
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0)

  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id)
      if (exists) {
        return prev.filter(s => s.id !== service.id)
      }
      return [...prev, service]
    })
  }

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedServices.length > 0
      case 2: return selectedStaff !== null
      case 3: return selectedDate !== null
      case 4: return selectedSlot !== null
      case 5: return customerPhone.length >= 10 && customerName.length > 0
      default: return false
    }
  }

  const handleSubmit = async () => {
    if (!canProceed()) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/salons/${salonSlug}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceIds: selectedServices.map(s => s.id),
          staffId: selectedStaff?.id,
          date: selectedDate?.toISOString(),
          startTime: selectedSlot?.start,
          customerPhone: convertPersianToEnglishDigits(customerPhone),
          customerName,
          notes: customerNotes,
        }),
      })

      if (response.ok) {
        setBookingSuccess(true)
      }
    } catch (error) {
      console.error('Booking failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Generate dates for next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() + i)
    return date
  })

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
        <h2 className="text-2xl font-bold text-foreground mb-2">رزرو شما ثبت شد!</h2>
        <p className="text-muted-foreground mb-6">
          کد پیگیری و جزئیات نوبت به شماره {customerPhone} پیامک خواهد شد.
        </p>
        <Button onClick={() => window.location.reload()}>
          رزرو نوبت جدید
        </Button>
      </motion.div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 overflow-x-auto pb-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <motion.div
              className={`flex flex-col items-center ${
                currentStep >= step.id ? 'text-primary' : 'text-muted-foreground'
              }`}
              animate={{ scale: currentStep === step.id ? 1.1 : 1 }}
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
                className={`w-12 md:w-24 h-0.5 mx-2 transition-colors ${
                  currentStep > step.id ? 'bg-primary' : 'bg-muted'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Summary Bar */}
      {selectedServices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-muted/50 rounded-xl p-4 mb-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {selectedServices.map(service => (
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

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Step 1: Services */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-xl font-bold mb-6">خدمات مورد نظر خود را انتخاب کنید</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map(service => (
                  <Card
                    key={service.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedServices.find(s => s.id === service.id)
                        ? 'ring-2 ring-primary bg-primary/5'
                        : ''
                    }`}
                    onClick={() => toggleService(service)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-foreground">{service.name}</h3>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {service.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                            <span>
                              <Clock className="w-3 h-3 inline ml-1" />
                              {service.duration} دقیقه
                            </span>
                          </div>
                        </div>
                        <div className="text-left">
                          <span className="font-bold text-primary">
                            {service.price.toLocaleString('fa-IR')}
                          </span>
                          <span className="text-xs text-muted-foreground block">تومان</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Staff */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-6">متخصص خود را انتخاب کنید</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staff.map(member => (
                  <Card
                    key={member.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedStaff?.id === member.id
                        ? 'ring-2 ring-primary bg-primary/5'
                        : ''
                    }`}
                    onClick={() => setSelectedStaff(member)}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="w-20 h-20 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center overflow-hidden">
                        {member.user.avatar ? (
                          <img
                            src={member.user.avatar}
                            alt={`${member.user.firstName} ${member.user.lastName}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-10 h-10 text-muted-foreground" />
                        )}
                      </div>
                      <h3 className="font-semibold">
                        {member.user.firstName} {member.user.lastName}
                      </h3>
                      {member.averageRating > 0 && (
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <Star className="w-4 h-4 fill-warning text-warning" />
                          <span className="text-sm">{member.averageRating.toFixed(1)}</span>
                        </div>
                      )}
                      {member.specialties.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-1 mt-2">
                          {member.specialties.slice(0, 3).map((specialty, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {specialty}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Date */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-xl font-bold mb-6">تاریخ مورد نظر را انتخاب کنید</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {dates.map((date, index) => {
                  const isSelected = selectedDate?.toDateString() === date.toDateString()
                  const dayInfo = getJalaliWeekDays().find(
                    (_, i) => i === date.getDay()
                  )
                  
                  return (
                    <Card
                      key={index}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedDate(date)}
                    >
                      <CardContent className="p-3 text-center">
                        <div className="text-xs text-muted-foreground mb-1">
                          {getJalaliWeekDays()[date.getDay()]}
                        </div>
                        <div className="font-bold text-lg">
                          {formatJalaliDate(date, 'D')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatJalaliDate(date, 'MMMM')}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 4: Time Slot */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-xl font-bold mb-6">
                ساعت مورد نظر را انتخاب کنید
                {selectedDate && (
                  <span className="text-base font-normal text-muted-foreground mr-2">
                    ({formatJalaliDate(selectedDate, 'dddd D MMMM')})
                  </span>
                )}
              </h2>
              {slots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>متاسفانه در این روز زمان خالی وجود ندارد.</p>
                  <Button variant="outline" className="mt-4" onClick={prevStep}>
                    انتخاب روز دیگر
                  </Button>
                </div>
              ) : (
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
              )}
            </div>
          )}

          {/* Step 5: Confirmation */}
          {currentStep === 5 && (
            <div>
              <h2 className="text-xl font-bold mb-6">تایید و تکمیل اطلاعات</h2>
              
              {/* Booking Summary */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-base">خلاصه نوبت</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">خدمات:</span>
                    <span>{selectedServices.map(s => s.name).join('، ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">متخصص:</span>
                    <span>
                      {selectedStaff?.user.firstName} {selectedStaff?.user.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تاریخ:</span>
                    <span>{selectedDate && formatJalaliDate(selectedDate, 'dddd D MMMM YYYY')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ساعت:</span>
                    <span>{selectedSlot && formatJalaliTime(selectedSlot.start)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مدت:</span>
                    <span>{totalDuration} دقیقه</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-bold">
                    <span>مبلغ قابل پرداخت:</span>
                    <span className="text-primary">
                      {totalPrice.toLocaleString('fa-IR')} تومان
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">اطلاعات شما</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">شماره موبایل *</Label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="pr-10"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      کد تایید و جزئیات نوبت به این شماره ارسال می‌شود
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">نام و نام خانوادگی *</Label>
                    <Input
                      id="name"
                      placeholder="مثال: سارا احمدی"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">توضیحات (اختیاری)</Label>
                    <Textarea
                      id="notes"
                      placeholder="توضیحات یا درخواست خاصی دارید؟"
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1}
          className="gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          مرحله قبل
        </Button>
        
        {currentStep < 5 ? (
          <Button
            onClick={nextStep}
            disabled={!canProceed()}
            className="gap-2"
          >
            مرحله بعد
            <ArrowLeft className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canProceed() || isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin">◌</span>
                در حال ثبت...
              </>
            ) : (
              <>
                تایید و ثبت نوبت
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
