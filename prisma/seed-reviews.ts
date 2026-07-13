import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SAMPLE_COMMENTS = [
  { rating: 5, comment: 'کار فوق‌العاده بود، حتما دوباره می‌آیم.' },
  { rating: 4, comment: 'کیفیت خوب بود، فقط کمی معطل شدم.' },
  { rating: 5, comment: 'خیلی حرفه‌ای و دقیق کار کردند.' },
  { rating: 3, comment: 'قابل قبول بود ولی انتظار بیشتری داشتم.' },
  { rating: 5, comment: 'بهترین تجربه‌ام در سالن‌های ناخن بود.' },
]

async function main() {
  const completedAppointments = await prisma.appointment.findMany({
    where: {
      status: 'COMPLETED',
      reviews: { none: {} },
    },
    select: {
      id: true,
      customerId: true,
      staffId: true,
    },
    take: 10,
  })

  if (completedAppointments.length === 0) {
    console.log('No completed appointments without reviews found.')
    return
  }

  let created = 0

  for (const [index, appointment] of completedAppointments.entries()) {
    const sample = SAMPLE_COMMENTS[index % SAMPLE_COMMENTS.length]

    await prisma.review.create({
      data: {
        appointmentId: appointment.id,
        customerId: appointment.customerId,
        staffId: appointment.staffId,
        rating: sample.rating,
        comment: sample.comment,
      },
    })

    created += 1
  }

  console.log(`Created ${created} review(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
