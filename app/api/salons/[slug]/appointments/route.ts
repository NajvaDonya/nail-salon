import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendAppointmentConfirmation } from '@/lib/sms'
import { z } from 'zod'

const createAppointmentSchema = z.object({
  serviceIds: z.array(z.string()).min(1),
  staffId: z.string(),
  date: z.string(),
  startTime: z.string(),
  customerPhone: z.string().min(10),
  customerName: z.string().min(2),
  notes: z.string().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const staffId = url.searchParams.get('staffId')
    const date = url.searchParams.get('date')

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!salon) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    const whereClause: Record<string, unknown> = { salonId: salon.id }

    if (status) {
      whereClause.status = status
    }

    if (staffId) {
      whereClause.staffId = staffId
    }

    if (date) {
      const targetDate = new Date(date)
      const nextDate = new Date(targetDate)
      nextDate.setDate(nextDate.getDate() + 1)
      
      whereClause.startTime = {
        gte: targetDate,
        lt: nextDate,
      }
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        services: {
          include: {
            service: {
              select: {
                name: true,
                price: true,
                duration: true,
              },
            },
          },
        },
        staff: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        customer: {
          select: {
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    })

    return NextResponse.json({ appointments })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json(
      { error: 'خطا در دریافت نوبت‌ها' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    
    const validation = createAppointmentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'اطلاعات وارد شده نامعتبر است', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { serviceIds, staffId, date, startTime, customerPhone, customerName, notes } = validation.data

    const salon = await prisma.salon.findUnique({
      where: { slug },
      select: { id: true, name: true },
    })

    if (!salon) {
      return NextResponse.json(
        { error: 'سالن یافت نشد' },
        { status: 404 }
      )
    }

    // Get services to calculate total
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, price: true, duration: true },
    })

    const totalPrice = services.reduce((sum, s) => sum + s.price, 0)
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0)

    // Parse start time and calculate end time
    const appointmentDate = new Date(`${date.split('T')[0]}T00:00:00`)
    const startDateTime = new Date(`${date.split('T')[0]}T${startTime}`)
    const endDateTime = new Date(startDateTime.getTime() + totalDuration * 60000)

    // Find or create customer
    let customer = await prisma.user.findFirst({
      where: { phone: customerPhone },
    })

    if (!customer) {
      // Split name into first and last name
      const nameParts = customerName.trim().split(' ')
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ') || ''

      customer = await prisma.user.create({
        data: {
          phone: customerPhone,
          firstName,
          lastName,
          name: customerName.trim(),
          role: 'CUSTOMER',
        },
      })
    }

    // Generate tracking code
    const trackingCode = `SL${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        salonId: salon.id,
        customerId: customer.id,
        staffId,
        date: appointmentDate,
        startTime: startDateTime,
        endTime: endDateTime,
        totalPrice,
        status: 'PENDING',
        trackingCode,
        notes,
        services: {
          create: serviceIds.map(serviceId => ({
            serviceId,
          })),
        },
      },
      include: {
        staff: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        services: {
          include: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    // Send SMS confirmation
    try {
      await sendAppointmentConfirmation(customerPhone, {
        salonName: salon.name,
        trackingCode,
        date: startDateTime.toLocaleDateString('fa-IR'),
        time: startDateTime.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        staffName: `${appointment.staff.user.firstName} ${appointment.staff.user.lastName}`,
        services: appointment.services.map(s => s.service.name).join('، '),
      })
    } catch (smsError) {
      console.error('Failed to send SMS:', smsError)
      // Don't fail the appointment if SMS fails
    }

    return NextResponse.json({
      success: true,
      appointment: {
        id: appointment.id,
        trackingCode: appointment.trackingCode,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        totalPrice: appointment.totalPrice,
      },
    })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json(
      { error: 'خطا در ثبت نوبت' },
      { status: 500 }
    )
  }
}
