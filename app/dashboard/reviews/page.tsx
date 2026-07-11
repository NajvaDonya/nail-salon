'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { formatPersianDate, englishToPersian } from '@/lib/jalali'
import {
  Star,
  MessageSquare,
  Filter,
  TrendingUp,
  Reply,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface Review {
  id: string
  customer: {
    name: string
    avatar?: string
  }
  staff: {
    name: string
  }
  service: string
  rating: number
  comment: string
  reply?: string
  repliedAt?: string
  createdAt: string
  isPublic: boolean
}

// Mock data
const mockReviews: Review[] = [
  {
    id: '1',
    customer: { name: 'سارا احمدی' },
    staff: { name: 'مریم کریمی' },
    service: 'کراتین مو',
    rating: 5,
    comment: 'خیلی عالی بود! موهام خیلی نرم و براق شدن. حتما دوباره میام.',
    reply: 'ممنون از نظر لطف شما. منتظرتون هستیم!',
    repliedAt: '2024-01-10',
    createdAt: '2024-01-09',
    isPublic: true,
  },
  {
    id: '2',
    customer: { name: 'نازنین رضایی' },
    staff: { name: 'فاطمه حسینی' },
    service: 'رنگ مو',
    rating: 4,
    comment: 'رنگ خوب شد ولی کمی طول کشید. در کل راضی بودم.',
    createdAt: '2024-01-08',
    isPublic: true,
  },
  {
    id: '3',
    customer: { name: 'مینا محمدی' },
    staff: { name: 'زهرا علیزاده' },
    service: 'مانیکور',
    rating: 5,
    comment: 'کار تمیز و دقیق. پیشنهاد می‌کنم.',
    createdAt: '2024-01-07',
    isPublic: true,
  },
  {
    id: '4',
    customer: { name: 'لیلا کاظمی' },
    staff: { name: 'مریم کریمی' },
    service: 'اصلاح ابرو',
    rating: 3,
    comment: 'فرم ابرو خوب نشد. انتظار بیشتری داشتم.',
    createdAt: '2024-01-06',
    isPublic: true,
  },
]

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

export default function ReviewsPage() {
  const [ratingFilter, setRatingFilter] = useState<string>('all')
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [replyText, setReplyText] = useState('')

  const filteredReviews = mockReviews.filter((review) => {
    if (ratingFilter === 'all') return true
    return review.rating === parseInt(ratingFilter)
  })

  const avgRating =
    mockReviews.reduce((sum, r) => sum + r.rating, 0) / mockReviews.length

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: mockReviews.filter((r) => r.rating === rating).length,
    percentage:
      (mockReviews.filter((r) => r.rating === rating).length / mockReviews.length) *
      100,
  }))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">نظرات مشتریان</h1>
        <p className="text-muted-foreground">مدیریت و پاسخ به نظرات</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center">
                <Star className="w-8 h-8 text-warning fill-warning" />
              </div>
              <div>
                <p className="text-3xl font-bold">{englishToPersian(avgRating.toFixed(1))}</p>
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
                <p className="text-3xl font-bold">{englishToPersian(mockReviews.length.toString())}</p>
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
                    Math.round(
                      (mockReviews.filter((r) => r.rating >= 4).length / mockReviews.length) *
                        100
                    ).toString()
                  )}%
                </p>
                <p className="text-sm text-muted-foreground">رضایت مشتریان</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rating Distribution */}
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

      {/* Filter */}
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

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.map((review, index) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="glass">
              <CardContent className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={review.customer.avatar} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {review.customer.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{review.customer.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{review.service}</span>
                        <span>•</span>
                        <span>{review.staff.name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left">
                    <StarRating rating={review.rating} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatPersianDate(new Date(review.createdAt), 'd MMMM')}
                    </p>
                  </div>
                </div>

                {/* Comment */}
                <p className="text-sm">{review.comment}</p>

                {/* Reply */}
                {review.reply && (
                  <div className="bg-muted/50 rounded-lg p-3 mr-8 border-r-2 border-primary">
                    <p className="text-sm font-medium mb-1">پاسخ شما:</p>
                    <p className="text-sm text-muted-foreground">{review.reply}</p>
                  </div>
                )}

                {/* Actions */}
                {!review.reply && (
                  <div className="flex justify-end">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedReview(review)}
                        >
                          <Reply className="w-4 h-4 ml-2" />
                          پاسخ دادن
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>پاسخ به نظر</DialogTitle>
                          <DialogDescription>
                            پاسخ شما به {review.customer.name} نمایش داده خواهد شد.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-sm">{review.comment}</p>
                          </div>
                          <Textarea
                            placeholder="پاسخ خود را بنویسید..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={4}
                          />
                          <div className="flex gap-2 justify-end">
                            <Button variant="outline">انصراف</Button>
                            <Button>ارسال پاسخ</Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredReviews.length === 0 && (
        <Card className="p-12 text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">نظری یافت نشد</p>
        </Card>
      )}
    </motion.div>
  )
}
