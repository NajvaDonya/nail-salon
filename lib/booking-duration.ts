export interface DurationService {
  duration: number
  bufferTime?: number
}

export function sumServiceDurations(services: DurationService[]): number {
  return services.reduce((sum, service) => sum + service.duration, 0)
}

export function sumServiceBufferTimes(services: DurationService[]): number {
  return services.reduce((sum, service) => sum + (service.bufferTime ?? 0), 0)
}

export function computeOccupiedMinutes(services: DurationService[]): number {
  return sumServiceDurations(services) + sumServiceBufferTimes(services)
}

export function computeEndTimeFromStart(startTime: string, occupiedMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const total = hours * 60 + minutes + occupiedMinutes
  const endHours = Math.floor(total / 60)
  const endMinutes = total % 60
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`
}
