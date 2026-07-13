// Type definitions for Fair Salon SaaS

export type UserRole = 'SUPER_ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER'

export type AppointmentStatus = 
  | 'PENDING' 
  | 'CONFIRMED' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'NO_SHOW'
  | 'AWAITING_PAYMENT'

export type DayOfWeek = 
  | 'SATURDAY' 
  | 'SUNDAY' 
  | 'MONDAY' 
  | 'TUESDAY' 
  | 'WEDNESDAY' 
  | 'THURSDAY' 
  | 'FRIDAY'

export type Gender = 'MALE' | 'FEMALE' | 'OTHER'

export interface JWTPayload {
  userId: string
  phone: string
  role: UserRole
  salonId?: string
  iat?: number
  exp?: number
}

export interface AuthUser {
  id: string
  phone: string
  email?: string | null
  firstName: string
  lastName: string
  avatar?: string | null
  role: UserRole
  salonId?: string | null
  salon?: {
    id: string
    name: string
    slug: string
  } | null
}

export interface TimeSlot {
  time: string // "HH:mm"
  available: boolean
  staffId?: string
}

export interface AvailableSlot {
  date: string // "YYYY-MM-DD"
  slots: TimeSlot[]
}

// Persian day names
export const PERSIAN_DAYS: Record<DayOfWeek, string> = {
  SATURDAY: 'شنبه',
  SUNDAY: 'یکشنبه',
  MONDAY: 'دوشنبه',
  TUESDAY: 'سه‌شنبه',
  WEDNESDAY: 'چهارشنبه',
  THURSDAY: 'پنجشنبه',
  FRIDAY: 'جمعه',
}

// Persian status names
export const PERSIAN_STATUS: Record<AppointmentStatus, string> = {
  PENDING: 'در انتظار تایید',
  CONFIRMED: 'تایید شده',
  IN_PROGRESS: 'در حال انجام',
  COMPLETED: 'انجام شده',
  CANCELLED: 'لغو شده',
  NO_SHOW: 'عدم مراجعه',
  AWAITING_PAYMENT: 'در انتظار پرداخت',
}

// Status colors for UI
export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-gray-100 text-gray-800',
  AWAITING_PAYMENT: 'bg-orange-100 text-orange-800',
}

// Role permissions
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: ['*'],
  MANAGER: [
    'salon:read', 'salon:update',
    'staff:read', 'staff:create', 'staff:update', 'staff:delete',
    'service:read', 'service:create', 'service:update', 'service:delete',
    'appointment:read', 'appointment:create', 'appointment:update', 'appointment:delete',
    'review:read', 'review:reply',
    'analytics:read',
    'settings:read', 'settings:update',
  ],
  STAFF: [
    'appointment:read:own', 'appointment:update:own',
    'schedule:read:own', 'schedule:update:own',
    'review:read:own',
  ],
  CUSTOMER: [
    'appointment:read:own', 'appointment:create', 'appointment:cancel:own',
    'review:create', 'review:read:own',
    'profile:read', 'profile:update',
  ],
}
