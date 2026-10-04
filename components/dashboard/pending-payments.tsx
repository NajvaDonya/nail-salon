'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Clock, Loader2, Phone, Receipt, Scissors } from 'lucide-react'
import {
  formatPersianDate,
  formatPersianPrice,
  formatPersianTime,
  englishToPersian,
} from '@/lib/jalali'
import { PAYMENT_STATUS_COLORS, PERSIAN_PAYMENT_STATUS } from '@/lib/types'
import type { PaymentStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PendingPayment {
  id: string
  appointmentId: string
  trackingCode: string | null
  paymentStatus: PaymentStatus
  amount: number
  totalPrice: number
  balanceDue: number
  customerName: string
  customerPhone: string
  staffName: string
  services: string[]
  startTime: string
  bookedAt: string
  submittedAt: string | null
  expiresAt: string
  rejectionReason: string | null
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'خطا در دریافت پرداخت‌ها')
  return data
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${formatPersianDate(date, 'd MMMM yyyy')} — ${formatPersianTime(time)}`
}

function remainingLabel(expiresAt: string, serverNow: string): string {
  const remainingMs = new Date(expiresAt).getTime() - new Date(serverNow).getTime()
  if (remainingMs <= 0) return 'مهلت تمام شده'
  const minutes = Math.ceil(remainingMs / 60000)
  return `${englishToPersian(String(minutes))} دقیقه مانده`
}

export function PendingPayments() {
  const { data, error, isLoading, mutate } = useSWR<{
    payments: PendingPayment[]
    serverNow: string
  }>('/api/dashboard/payments', fetcher, { refreshInterval: 30000 })

  const [rejectTarget, setRejectTarget] = useState<PendingPayment | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const payments = data?.payments ?? []
  const serverNow = data?.serverNow ?? new Date().toISOString()

  const review = async (
    payment: PendingPayment,
    body: { action: 'approve' } | { action: 'reject'; reason: string }
  ) => {
    setBusyId(payment.id)
    try {
      const res = await fetch(`/api/dashboard/payments/${payment.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'خطا در بررسی پرداخت')
      toast.success(json.message)
      setRejectTarget(null)
      setRejectReason('')
      await mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در بررسی پرداخت')
      await mutate()
    } finally {
      setBusyId(null)
    }
  }

  const confirmApprove = (payment: PendingPayment) => {
    const ok = window.confirm(
      `پرداخت ${formatPersianPrice(payment.amount)} برای ${payment.customerName} تأیید شود؟ نوبت قطعی می‌شود.`
    )
    if (ok) void review(payment, { action: 'approve' })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive">{error.message}</p>
      </Card>
    )
  }

  if (payments.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Receipt className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
        <p className="text-muted-foreground">پرداختی در انتظار تأیید نیست</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        رسید پرداخت در تلگرام برای شما ارسال می‌شود. اطلاعات زیر را با رسید دریافتی تطبیق دهید و
        سپس تأیید یا رد کنید.
      </p>

      {payments.map((payment, index) => (
        <motion.div
          key={payment.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04 }}
        >
          <Card className="glass">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    رزرو {payment.trackingCode ? `#${payment.trackingCode}` : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">{payment.customerName}</p>
                </div>
                <Badge className={cn('shrink-0', PAYMENT_STATUS_COLORS[payment.paymentStatus])}>
                  {PERSIAN_PAYMENT_STATUS[payment.paymentStatus]}
                </Badge>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span dir="ltr">{payment.customerPhone}</span>
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Scissors className="w-4 h-4" />
                  {payment.services.join('، ')}
                </span>
                <span className="text-muted-foreground">
                  تاریخ و ساعت نوبت: {formatDateTime(payment.startTime)}
                </span>
                <span className="text-muted-foreground">پرسنل: {payment.staffName}</span>
                <span className="text-muted-foreground">
                  ثبت رزرو: {formatDateTime(payment.bookedAt)}
                </span>
                <span className="text-muted-foreground">
                  اعلام ارسال رسید:{' '}
                  {payment.submittedAt ? formatDateTime(payment.submittedAt) : '—'}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
                <div className="space-y-1 text-sm">
                  <p className="font-bold text-primary text-base">
                    مبلغ بیعانه: {formatPersianPrice(payment.amount)}
                  </p>
                  {payment.balanceDue > 0 && (
                    <p className="text-muted-foreground">
                      مانده در سالن: {formatPersianPrice(payment.balanceDue)}
                    </p>
                  )}
                </div>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {remainingLabel(payment.expiresAt, serverNow)}
                </span>
              </div>

              {payment.paymentStatus === 'SUBMITTED' && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busyId === payment.id}
                    onClick={() => confirmApprove(payment)}
                  >
                    تأیید پرداخت
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === payment.id}
                    onClick={() => {
                      setRejectTarget(payment)
                      setRejectReason('')
                    }}
                  >
                    رد پرداخت
                  </Button>
                </div>
              )}

              {payment.rejectionReason && (
                <p className="text-sm text-muted-foreground">
                  دلیل رد: {payment.rejectionReason}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ))}

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
            setRejectReason('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>رد پرداخت</DialogTitle>
            <DialogDescription>
              دلیل رد پرداخت برای مشتری نمایش داده می‌شود و نوبت لغو خواهد شد.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectReason">دلیل رد پرداخت</Label>
            <Textarea
              id="rejectReason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="مثلاً رسیدی در تلگرام دریافت نشد"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setRejectTarget(null)
                setRejectReason('')
              }}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.trim().length < 3 || busyId === rejectTarget?.id}
              onClick={() => {
                if (rejectTarget) {
                  void review(rejectTarget, {
                    action: 'reject',
                    reason: rejectReason.trim(),
                  })
                }
              }}
            >
              ثبت رد پرداخت
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
