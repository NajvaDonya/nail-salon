export interface PricedService {
  price: number
  discountPrice?: number | null
}

export function getServiceFinalPrice(service: PricedService): number {
  const { price, discountPrice } = service
  if (
    typeof discountPrice === 'number' &&
    Number.isInteger(discountPrice) &&
    discountPrice > 0 &&
    discountPrice < price
  ) {
    return discountPrice
  }
  return price
}

export function sumServicesPrice(services: PricedService[]): number {
  return services.reduce((sum, service) => sum + getServiceFinalPrice(service), 0)
}

export interface ServiceSnapshotInput extends PricedService {
  id: string
  name: string
  duration: number
  bufferTime?: number
}

export function buildServiceSnapshot(service: ServiceSnapshotInput) {
  const finalPrice = getServiceFinalPrice(service)
  return {
    serviceId: service.id,
    serviceName: service.name,
    price: service.price,
    finalPrice,
    duration: service.duration,
    bufferTime: service.bufferTime ?? 0,
  }
}
