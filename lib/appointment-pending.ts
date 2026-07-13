export type PendingApprovalType = 'NONE' | 'UPDATE' | 'DELETE'

export interface PendingAppointmentChanges {
  customerId?: string
  staffId?: string
  serviceIds?: string[]
  date?: string
  startTime?: string
  customerName?: string
  customerPhone?: string
  notes?: string | null
}

export function parsePendingChanges(value: unknown): PendingAppointmentChanges | null {
  if (!value || typeof value !== 'object') return null
  return value as PendingAppointmentChanges
}

export function buildDateTimes(date: string, startTime: string, durationMinutes: number) {
  const dateKey = date.split('T')[0]
  const appointmentDate = new Date(`${dateKey}T00:00:00`)
  const startDateTime = new Date(`${dateKey}T${startTime}`)
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000)
  return { appointmentDate, startDateTime, endDateTime }
}
