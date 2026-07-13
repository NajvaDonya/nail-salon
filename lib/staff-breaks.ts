import { prisma } from './db'

export interface LunchWindow {
  start: string
  end: string
}

export interface StaffBreakSettings {
  restMinutes: number
  lunch: LunchWindow | null
}

function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null
  return value.slice(0, 5)
}

export function parseLunchWindow(
  start: string | null | undefined,
  end: string | null | undefined
): LunchWindow | null {
  const lunchStart = normalizeTime(start)
  const lunchEnd = normalizeTime(end)
  if (!lunchStart || !lunchEnd) return null
  return { start: lunchStart, end: lunchEnd }
}

export async function getStaffBreakSettings(
  staffId: string,
  salonId: string
): Promise<StaffBreakSettings> {
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, salonId },
    select: { restMinutes: true, lunchStart: true, lunchEnd: true },
  })

  if (!staff) {
    return { restMinutes: 0, lunch: null }
  }

  return {
    restMinutes: staff.restMinutes ?? 0,
    lunch: parseLunchWindow(staff.lunchStart, staff.lunchEnd),
  }
}

export function lunchDurationMinutes(lunch: LunchWindow): number {
  const [sh, sm] = lunch.start.split(':').map(Number)
  const [eh, em] = lunch.end.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}
