'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  englishToPersian,
  formatPersianDate,
  formatPersianPrice,
} from '@/lib/jalali'
import { PERSIAN_DAYS } from '@/lib/types'
import type { DayOfWeek } from '@/lib/types'
import {
  BarChart3,
  Clock,
  DollarSign,
  Loader2,
  Star,
  TrendingUp,
  Users,
  CalendarCheck,
} from 'lucide-react'

interface AnalyticsResponse {
  period: { from: string; to: string; preset: string }
  filters: { staffId: string | null }
  summary: {
    totalAppointments: number
    completedCount: number
    pendingCount: number
    cancelledCount: number
    completedRevenue: number
    bookedHours: number
    availableHours: number
    salonAvailableHours: number
    utilizationPercent: number
    averageTicket: number
    averageRating: number | null
  }
  revenueByDay: Array<{ date: string; revenue: number; appointments: number }>
  salonHours: Array<{
    dayOfWeek: DayOfWeek
    openTime: string
    closeTime: string
    isClosed: boolean
    dailyMinutes: number
    bookedMinutes: number
    bookedHours: number
  }>
  staffPerformance: Array<{
    staffId: string
    name: string
    appointmentCount: number
    completedCount: number
    cancelledCount: number
    revenue: number
    bookedHours: number
    availableHours: number
    utilizationPercent: number
    averageRating: number | null
  }>
  staffList: Array<{ id: string; name: string }>
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'خطا در دریافت گزارشات')
  return data as AnalyticsResponse
}

function StatCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string
  value: string
  hint?: string
  icon: React.ReactNode
}) {
  return (
    <Card className="glass">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month')
  const [staffId, setStaffId] = useState('all')

  const query = useMemo(() => {
    const params = new URLSearchParams({ period })
    if (staffId !== 'all') params.set('staffId', staffId)
    return `/api/dashboard/analytics?${params.toString()}`
  }, [period, staffId])

  const { data, error, isLoading } = useSWR<AnalyticsResponse>(query, fetcher)

  const chartData = useMemo(() => {
    if (!data) return []
    return data.revenueByDay.map((row) => ({
      label: formatPersianDate(new Date(row.date), 'd MMM'),
      revenue: row.revenue,
      appointments: row.appointments,
    }))
  }, [data])

  const maxRevenue = Math.max(...chartData.map((row) => row.revenue), 1)

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="p-8 text-center">
        <p className="text-destructive">{error?.message || 'خطا در بارگذاری گزارشات'}</p>
      </Card>
    )
  }

  const { summary } = data
  const selectedStaffName =
    staffId === 'all'
      ? 'همه پرسنل'
      : data.staffList.find((s) => s.id === staffId)?.name ?? 'پرسنل'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            گزارشات سالن
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatPersianDate(new Date(data.period.from), 'd MMMM yyyy')} تا{' '}
            {formatPersianDate(new Date(data.period.to), 'd MMMM yyyy')}
            {' — '}
            {selectedStaffName}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">این هفته</SelectItem>
              <SelectItem value="month">این ماه</SelectItem>
              <SelectItem value="lastMonth">ماه قبل</SelectItem>
            </SelectContent>
          </Select>

          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="فیلتر پرسنل" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه پرسنل</SelectItem>
              {data.staffList.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="درآمد انجام‌شده"
          value={formatPersianPrice(summary.completedRevenue)}
          hint={`میانگین هر نوبت: ${formatPersianPrice(summary.averageTicket)}`}
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatCard
          title="نوبت‌ها"
          value={englishToPersian(summary.totalAppointments.toString())}
          hint={`${englishToPersian(summary.completedCount.toString())} انجام‌شده · ${englishToPersian(summary.pendingCount.toString())} در انتظار`}
          icon={<CalendarCheck className="w-5 h-5" />}
        />
        <StatCard
          title="پر شدن زمان کاری"
          value={`${englishToPersian(summary.utilizationPercent.toString())}٪`}
          hint={`${englishToPersian(summary.bookedHours.toString())} از ${englishToPersian(summary.availableHours.toString())} ساعت`}
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          title="رضایت مشتری"
          value={
            summary.averageRating
              ? `${englishToPersian(summary.averageRating.toString())} / ۵`
              : '—'
          }
          hint={
            summary.cancelledCount > 0
              ? `${englishToPersian(summary.cancelledCount.toString())} لغو / عدم حضور`
              : 'بدون لغو در این بازه'
          }
          icon={<Star className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              درآمد روزانه
            </CardTitle>
            <CardDescription>فقط نوبت‌های انجام‌شده</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {chartData.every((row) => row.revenue === 0) ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                در این بازه درآمد ثبت نشده است
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) => englishToPersian(Math.round(v / 1000).toString()) + 'k'}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatPersianPrice(value), 'درآمد']}
                    labelFormatter={(label) => `روز: ${label}`}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              ساعات سالن
            </CardTitle>
            <CardDescription>
              {englishToPersian(summary.salonAvailableHours.toString())} ساعت باز در این بازه
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.salonHours.map((row) => (
                <div
                  key={row.dayOfWeek}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span>{PERSIAN_DAYS[row.dayOfWeek]}</span>
                  <div className="text-left space-y-0.5">
                    {row.isClosed ? (
                      <Badge variant="secondary">تعطیل</Badge>
                    ) : (
                      <>
                        <p dir="ltr" className="text-muted-foreground">
                          {row.openTime} – {row.closeTime}
                        </p>
                        {row.bookedHours > 0 && (
                          <p className="text-xs text-primary">
                            {englishToPersian(row.bookedHours.toString())} ساعت رزرو
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            عملکرد پرسنل
          </CardTitle>
          <CardDescription>درآمد، نوبت‌ها و درصد استفاده از زمان کاری</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>پرسنل</TableHead>
                <TableHead>نوبت‌ها</TableHead>
                <TableHead>انجام‌شده</TableHead>
                <TableHead>درآمد</TableHead>
                <TableHead>ساعت رزرو</TableHead>
                <TableHead>پر شدن زمان</TableHead>
                <TableHead>امتیاز</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.staffPerformance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    داده‌ای برای نمایش وجود ندارد
                  </TableCell>
                </TableRow>
              ) : (
                data.staffPerformance.map((row) => (
                  <TableRow key={row.staffId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{englishToPersian(row.appointmentCount.toString())}</TableCell>
                    <TableCell>{englishToPersian(row.completedCount.toString())}</TableCell>
                    <TableCell>{formatPersianPrice(row.revenue)}</TableCell>
                    <TableCell>
                      {englishToPersian(row.bookedHours.toString())} /{' '}
                      {englishToPersian(row.availableHours.toString())}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.utilizationPercent >= 50 ? 'default' : 'secondary'}
                      >
                        {englishToPersian(row.utilizationPercent.toString())}٪
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {row.averageRating
                        ? englishToPersian(row.averageRating.toString())
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>خلاصه درآمد روزانه</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {data.revenueByDay
              .filter((row) => row.revenue > 0 || row.appointments > 0)
              .slice(-14)
              .map((row) => (
                <div key={row.date} className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">
                    {formatPersianDate(new Date(row.date), 'd MMM')}
                  </p>
                  <p className="font-semibold text-sm">{formatPersianPrice(row.revenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {englishToPersian(row.appointments.toString())} نوبت
                  </p>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.max(8, (row.revenue / maxRevenue) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
