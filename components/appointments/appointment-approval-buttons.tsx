'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

interface AppointmentApprovalButtonsProps {
  appointmentId: string
  pendingApproval: 'NONE' | 'UPDATE' | 'DELETE'
  status: string
  kind?: 'SERVICE' | 'LUNCH'
  viewerRole: 'STAFF' | 'MANAGER'
  onComplete?: () => void
}

export function AppointmentApprovalButtons({
  appointmentId,
  pendingApproval,
  status,
  kind = 'SERVICE',
  viewerRole,
  onComplete,
}: AppointmentApprovalButtonsProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)

  const needsStaffApproval =
    status === 'PENDING' && pendingApproval === 'NONE' && kind !== 'LUNCH'
  const needsManagerApproval =
    status === 'PENDING' && pendingApproval === 'NONE' && kind === 'LUNCH'

  const canShow =
    (viewerRole === 'STAFF' && needsStaffApproval) ||
    (viewerRole === 'MANAGER' && needsManagerApproval)

  if (!canShow) return null

  const handleApproval = async (approvalAction: 'approve' | 'reject') => {
    setLoading(approvalAction)
    try {
      const res = await fetch(`/api/dashboard/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ approvalAction }),
      })

      const result = await res.json()
      if (!res.ok) {
        alert(result.error || 'خطا در پردازش درخواست')
        return
      }

      onComplete?.()
    } catch {
      alert('خطا در برقراری ارتباط با سرور')
    } finally {
      setLoading(null)
    }
  }

  const approveLabel = kind === 'LUNCH' ? 'تایید ناهار' : 'تایید نوبت'
  const rejectLabel = kind === 'LUNCH' ? 'رد ناهار' : 'رد نوبت'

  return (
    <div className="flex flex-wrap gap-2 border-t pt-4">
      <Button
        size="sm"
        className="text-success"
        variant="outline"
        disabled={loading !== null}
        onClick={() => handleApproval('approve')}
      >
        {loading === 'approve' ? (
          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4 ml-2" />
        )}
        {approveLabel}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive"
        disabled={loading !== null}
        onClick={() => handleApproval('reject')}
      >
        {loading === 'reject' ? (
          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
        ) : (
          <XCircle className="w-4 h-4 ml-2" />
        )}
        {rejectLabel}
      </Button>
    </div>
  )
}

export function getPendingApprovalLabel(
  pendingApproval: 'NONE' | 'UPDATE' | 'DELETE',
  status: string,
  kind: 'SERVICE' | 'LUNCH' = 'SERVICE'
) {
  if (status === 'PENDING' && pendingApproval === 'NONE') {
    return kind === 'LUNCH' ? 'در انتظار تایید مدیر' : 'در انتظار تایید پرسنل'
  }
  return null
}
