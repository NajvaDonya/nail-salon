'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatPersianDate, englishToPersian } from '@/lib/jalali'
import { Star, MessageSquare, Filter, TrendingUp, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Review {
  id: string
  customer: {
    firstName: string | null
    lastName: string | null
  }
  services: string[]
  rating: number
  comment: string | null
  reply?: string | null
  createdAt: string
}

interface ReviewsResponse {
  reviews: Review[]
  stats: {
    total: number
    average: number
    distribution: Record<number, number>
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'خطا در دریافت نظرات')
  }
  return data
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-4 h-4 ${
            star <= rating ? 'fill-warning text-warning' : 'text-muted'
          }`}
        />
      ))}
    </div>
  )
}

function customerName(customer: Review['customer']) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'مشتری'
}

export default function StaffReviewsPage() {
  const [ratingFilter, setRatingFilter] = useState<string>('all')

  const { data, error, isLoading } = useSWR<ReviewsResponse>('/api/dashboard/reviews', fetcher)

  const reviews = data?.reviews ?? []
  const stats = data?.stats ?? { total: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }

  const filteredReviews = useMemo(() => {
    if (ratingFilter === 'all') return reviews
    return reviews.filter((review) => review.rating === parseInt(ratingFilter))
  }, [reviews, ratingFilter])

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: stats.distribution[rating] ?? 0,
    percentage: stats.total > 0 ? ((stats.distribution[rating] ?? 0) / stats.total) * 100 : 0,
  }))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">نظرات من</h1>
        <p className="text-muted-foreground">بازخورد مشتریان درباره خدمات شما</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <Card className="p-8 text-center">
          <p className="text-destructive">{error.message}</p>
        </Card>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center">
                    <Star className="w-8 h-8 text-warning fill-warning" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">
                      {englishToPersian(stats.average.toFixed(1))}
                    </p>
                    <p className="text-sm text-muted-foreground">میانگین امتیاز</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{englishToPersian(stats.total.toString())}</p>
                    <p className="text-sm text-muted-foreground">کل نظرات</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center">
                    <TrendingUp className="w-8 h-8 text-success" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">
                      {englishToPersian(
                        String(
                          stats.total > 0
                            ? Math.round(
                                (reviews.filter((r) => r.rating >= 4).length / stats.total) * 100
                              )
                            : 0
                        )
                      )}
                      %
                    </p>
                    <p className="text-sm text-muted-foreground">رضایت مشتریان</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">توزیع امتیازات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ratingDistribution.map(({ rating, count, percentage }) => (
                  <div key={rating} className="flex items-center gap-3">
                    <span className="w-8 text-sm">{englishToPersian(rating.toString())} ستاره</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-warning rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-8 text-sm text-muted-foreground">
                      {englishToPersian(count.toString())}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 ml-2" />
                <SelectValue placeholder="فیلتر امتیاز" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه امتیازات</SelectItem>
                <SelectItem value="5">۵ ستاره</SelectItem>
                <SelectItem value="4">۴ ستاره</SelectItem>
                <SelectItem value="3">۳ ستاره</SelectItem>
                <SelectItem value="2">۲ ستاره</SelectItem>
                <SelectItem value="1">۱ ستاره</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {filteredReviews.map((review, index) => {
              const name = customerName(review.customer)
              const serviceLabel = review.services.join('، ') || 'خدمت'

              return (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="glass">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{name}</p>
                            <p className="text-sm text-muted-foreground">{serviceLabel}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <StarRating rating={review.rating} />
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatPersianDate(new Date(review.createdAt), 'd MMMM')}
                          </p>
                        </div>
                      </div>

                      {review.comment && <p className="text-sm">{review.comment}</p>}

                      {review.reply && (
                        <div className="bg-muted/50 rounded-lg p-3 mr-8 border-r-2 border-primary">
                          <p className="text-sm font-medium mb-1">پاسخ مدیر:</p>
                          <p className="text-sm text-muted-foreground">{review.reply}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>

          {filteredReviews.length === 0 && (
            <Card className="p-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">نظری ثبت نشده است</p>
            </Card>
          )}
        </>
      )}
    </motion.div>
  )
}
