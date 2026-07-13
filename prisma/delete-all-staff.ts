import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const staffMembers = await prisma.staff.findMany({
    select: { id: true, userId: true },
  })

  if (staffMembers.length === 0) {
    console.log('No staff records found.')
    return
  }

  const staffIds = staffMembers.map((member) => member.id)
  const userIds = [...new Set(staffMembers.map((member) => member.userId))]

  const appointments = await prisma.appointment.findMany({
    where: { staffId: { in: staffIds } },
    select: { id: true },
  })
  const appointmentIds = appointments.map((appointment) => appointment.id)

  if (appointmentIds.length > 0) {
    await prisma.review.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    })
    await prisma.appointmentService.deleteMany({
      where: { appointmentId: { in: appointmentIds } },
    })
    await prisma.appointment.deleteMany({
      where: { id: { in: appointmentIds } },
    })
  }

  await prisma.review.deleteMany({
    where: { staffId: { in: staffIds } },
  })

  const deletedStaff = await prisma.staff.deleteMany({
    where: { id: { in: staffIds } },
  })

  const deletedUsers = await prisma.user.deleteMany({
    where: {
      id: { in: userIds },
      role: 'STAFF',
    },
  })

  console.log(`Deleted ${deletedStaff.count} staff record(s)`)
  console.log(`Deleted ${deletedUsers.count} staff user account(s)`)
  if (appointmentIds.length > 0) {
    console.log(`Deleted ${appointmentIds.length} related appointment(s)`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
