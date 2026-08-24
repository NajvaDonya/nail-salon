import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

type DbClient = Prisma.TransactionClient | typeof prisma

export class StaffQualificationError extends Error {
  constructor(message = 'پرسنل انتخاب‌شده برای این خدمات مجاز نیست') {
    super(message)
    this.name = 'StaffQualificationError'
  }
}

export async function assertStaffQualifiedForServices(
  params: {
    staffId: string
    salonId: string
    serviceIds: string[]
  },
  client: DbClient = prisma
): Promise<void> {
  const { staffId, salonId, serviceIds } = params

  if (serviceIds.length === 0) {
    throw new StaffQualificationError('حداقل یک خدمت انتخاب کنید')
  }

  const staff = await client.staff.findFirst({
    where: {
      id: staffId,
      salonId,
      isActive: true,
      user: { isActive: true },
    },
    select: { id: true },
  })

  if (!staff) {
    throw new StaffQualificationError('پرسنل یافت نشد')
  }

  const qualifiedCount = await client.staffService.count({
    where: {
      staffId,
      serviceId: { in: serviceIds },
      service: { salonId, isActive: true },
    },
  })

  if (qualifiedCount !== serviceIds.length) {
    throw new StaffQualificationError()
  }
}
