import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const services = await prisma.service.findMany({
    select: { id: true, name: true },
  })

  if (services.length === 0) {
    console.log('No services found.')
    return
  }

  const serviceIds = services.map((service) => service.id)

  const deletedAppointmentServices = await prisma.appointmentService.deleteMany({
    where: { serviceId: { in: serviceIds } },
  })

  const deletedStaffServices = await prisma.staffService.deleteMany({
    where: { serviceId: { in: serviceIds } },
  })

  const deletedServices = await prisma.service.deleteMany({
    where: { id: { in: serviceIds } },
  })

  console.log(`Deleted ${deletedServices.count} service(s): ${services.map((s) => s.name).join(', ')}`)
  console.log(`Removed ${deletedAppointmentServices.count} appointment-service link(s)`)
  console.log(`Removed ${deletedStaffServices.count} staff-service link(s)`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
