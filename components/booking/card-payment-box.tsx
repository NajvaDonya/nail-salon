'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Check, Clock, Copy, CreditCard, Send, ShieldCheck } from 'lucide-react'
import { englishToPersian, formatPersianPrice } from '@/lib/jalali'
import { PAYMENT_STATUS_COLORS, PERSIAN_PAYMENT_STATUS } from '@/lib/types'
import type { PaymentStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface CardPaymentData {
  amount: number
  status: PaymentStatus
  /** Deadline computed by the server; the countdown below is display only. */
  expiresAt: string
  serverNow: string
  submittedAt: string | null
  rejectionReason: string | null
  card: {
    number: string
    owner: string
    phone: string
    telegramUrl: string
  }
}

interface CardPaymentBoxProps {
  appointmentId: string
  payment: CardPaymentData
  trackingCode?: string | null
  onSubmitted?: () => void
  className?: string
}

function groupCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 16) return value
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return englishToPersian(`${minutes}:${String(seconds).padStart(2, '0')}`)
}

export function CardPaymentBox({
  appointmentId,
  payment,
  trackingCode,
  onSubmitted,
  className,
}: CardPaymentBoxProps) {
  const [status, setStatus] = useState<PaymentStatus>(payment.status)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  // Offset between server and device clock so a tampered local clock cannot extend the box.
  const clockOffsetMs = useMemo(
    () => new Date(payment.serverNow).getTime() - Date.now(),
    [payment.serverNow]
  )
  const expiresAtMs = useMemo(() => new Date(payment.expiresAt).getTime(), [payment.expiresAt])
  const [remainingMs, setRemainingMs] = useState(() => expiresAtMs - (Date.now() + clockOffsetMs))

  useEffect(() => {
    setStatus(payment.status)
  }, [payment.status])

  useEffect(() => {
    const tick = () => setRemainingMs(expiresAtMs - (Date.now() + clockOffsetMs))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [expiresAtMs, clockOffsetMs])

  const isOpen = status === 'PENDING' || status === 'SUBMITTED'
  const isSubmitted = status === 'SUBMITTED'
  const timedOut = isOpen && remainingMs <= 0

  const copyCardNumber = useCallback(async () => {
    const digits = payment.card.number.replace(/\s/g, '')
    try {
      await navigator.clipboard.writeText(digits)
      setCopied(true)
      toast.success('شماره کارت کپی شد')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('کپی نشد — شماره را دستی یادداشت کنید')
    }
  }, [payment.card.number])

  const declareReceiptSent = useCallback(async () => {
    setError('')
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/customer/appointments/${appointmentId}/receipt-sent`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.expired) setStatus('EXPIRED')
        throw new Error(data.error || 'خطا در ثبت ارسال رسید')
      }
      setStatus('SUBMITTED')
      toast.success(data.message)
      onSubmitted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت ارسال رسید')
    } finally {
      setIsSubmitting(false)
    }
  }, [appointmentId, onSubmitted])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'glass rounded-3xl border border-border/60 p-5 md:p-6 space-y-5 shadow-lg shadow-primary/5',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold">پرداخت رزرو</h3>
            {trackingCode && (
              <p className="text-xs text-muted-foreground font-mono">کد: {trackingCode}</p>
            )}
          </div>
        </div>
        <Badge className={cn('shrink-0', PAYMENT_STATUS_COLORS[status])}>
          {PERSIAN_PAYMENT_STATUS[status]}
        </Badge>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">مبلغ پرداختی</p>
        <p className="text-2xl font-bold text-primary">{formatPersianPrice(payment.amount)}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">شماره کارت</p>
        <div className="flex items-center gap-2">
          <p className="font-mono text-lg tracking-widest flex-1" dir="ltr">
            {groupCardNumber(payment.card.number)}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyCardNumber()}>
            {copied ? <Check className="w-4 h-4 ml-1" /> : <Copy className="w-4 h-4 ml-1" />}
            کپی
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">صاحب حساب</p>
        <p className="font-semibold">{payment.card.owner}</p>
      </div>

      {payment.card.phone && (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">شماره تماس سالن</p>
          <p className="font-medium" dir="ltr">
            {payment.card.phone}
          </p>
        </div>
      )}

      {isOpen && !timedOut && (
        <div className="flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 text-sm">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">مهلت باقی‌مانده:</span>
          <span className="font-mono font-bold tabular-nums">{formatRemaining(remainingMs)}</span>
        </div>
      )}

      <div className="border-t border-border/60 pt-5 space-y-3">
        <h4 className="font-semibold">ارسال رسید پرداخت</h4>
        <p className="text-sm text-muted-foreground">
          پس از واریز مبلغ، تصویر رسید پرداخت را در تلگرام برای ما ارسال کنید.
        </p>

        <Button asChild className="w-full" size="lg" disabled={!payment.card.telegramUrl}>
          <a href={payment.card.telegramUrl} target="_blank" rel="noopener noreferrer">
            <Send className="w-4 h-4 ml-2" />
            ارسال رسید در تلگرام
          </a>
        </Button>

        {isSubmitted ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-1">
            <p className="font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              رسید شما ارسال شده و در انتظار بررسی مدیر است.
            </p>
            <p className="text-sm text-muted-foreground">
              رزرو شما فعلاً قطعی نیست و پس از تأیید پرداخت توسط مدیریت نهایی خواهد شد.
            </p>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            size="lg"
            disabled={isSubmitting || timedOut || !isOpen}
            onClick={() => void declareReceiptSent()}
          >
            {isSubmitting ? 'در حال ثبت...' : 'رسید را در تلگرام ارسال کردم'}
          </Button>
        )}

        {status === 'REJECTED' && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-1">
            <p className="font-semibold text-destructive">پرداخت شما رد شد</p>
            {payment.rejectionReason && (
              <p className="text-sm text-muted-foreground">دلیل: {payment.rejectionReason}</p>
            )}
          </div>
        )}

        {(status === 'EXPIRED' || timedOut) && (
          <div className="rounded-2xl border border-border bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              مهلت پرداخت این رزرو به پایان رسیده است. لطفاً دوباره نوبت بگیرید.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <p className="text-sm text-muted-foreground">
          وضعیت: {PERSIAN_PAYMENT_STATUS[status]}
        </p>
      </div>
    </motion.div>
  )
}
