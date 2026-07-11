'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { formatPersianPrice, englishToPersian } from '@/lib/jalali'
import { Plus, Search, MoreVertical, Phone, Mail, Star, Edit, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface StaffMember {
  id: string
  firstName: string
  lastName: string
  phone: string
  email?: string
  avatar?: string
  specialties: string[]
  appointmentsToday: number
  rating: number
  isActive: boolean
}

// Mock data
const mockStaff: StaffMember[] = [
  {
    id: '1',
    firstName: 'مریم',
    lastName: 'کریمی',
    phone: '09121234567',
    email: 'maryam@example.com',
    specialties: ['کراتین', 'رنگ مو', 'کوتاهی'],
    appointmentsToday: 4,
    rating: 4.8,
    isActive: true,
  },
  {
    id: '2',
    firstName: 'فاطمه',
    lastName: 'حسینی',
    phone: '09129876543',
    specialties: ['مانیکور', 'پدیکور', 'ناخن'],
    appointmentsToday: 3,
    rating: 4.6,
    isActive: true,
  },
  {
    id: '3',
    firstName: 'زهرا',
    lastName: 'علیزاده',
    phone: '09123456789',
    specialties: ['اصلاح ابرو', 'میکاپ', 'پاکسازی'],
    appointmentsToday: 5,
    rating: 4.9,
    isActive: true,
  },
  {
    id: '4',
    firstName: 'نرگس',
    lastName: 'محمودی',
    phone: '09127654321',
    specialties: ['ماساژ', 'اسپا'],
    appointmentsToday: 0,
    rating: 4.5,
    isActive: false,
  },
]

export default function StaffPage() {
  const [search, setSearch] = useState('')
  const [staff] = useState<StaffMember[]>(mockStaff)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const filteredStaff = staff.filter(
    (s) =>
      s.firstName.includes(search) ||
      s.lastName.includes(search) ||
      s.phone.includes(search)
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مدیریت پرسنل</h1>
          <p className="text-muted-foreground">لیست کارکنان و تنظیمات آن‌ها</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 ml-2" />
              افزودن پرسنل
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>افزودن پرسنل جدید</DialogTitle>
              <DialogDescription>
                اطلاعات پرسنل جدید را وارد کنید
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">نام</Label>
                  <Input id="firstName" placeholder="نام" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">نام خانوادگی</Label>
                  <Input id="lastName" placeholder="نام خانوادگی" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">شماره موبایل</Label>
                <Input id="phone" type="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">ایمیل (اختیاری)</Label>
                <Input id="email" type="email" placeholder="email@example.com" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialties">تخصص‌ها</Label>
                <Input id="specialties" placeholder="کراتین، رنگ مو، ..." />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  انصراف
                </Button>
                <Button type="submit">ذخیره</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="جستجو در پرسنل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.map((member, index) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`glass ${!member.isActive && 'opacity-60'}`}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {member.firstName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">
                      {member.firstName} {member.lastName}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-warning text-warning" />
                      {englishToPersian(member.rating.toFixed(1))}
                    </CardDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit className="w-4 h-4 ml-2" />
                      ویرایش
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="w-4 h-4 ml-2" />
                      حذف
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1">
                  {member.specialties.map((specialty) => (
                    <Badge key={specialty} variant="secondary" className="text-xs">
                      {specialty}
                    </Badge>
                  ))}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span dir="ltr">{member.phone}</span>
                  </div>
                  {member.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span dir="ltr" className="truncate">{member.email}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground">نوبت‌های امروز</span>
                  <Badge variant={member.appointmentsToday > 0 ? 'default' : 'secondary'}>
                    {englishToPersian(member.appointmentsToday.toString())} نوبت
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">وضعیت</span>
                  <Badge variant={member.isActive ? 'default' : 'secondary'}>
                    {member.isActive ? 'فعال' : 'غیرفعال'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredStaff.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">پرسنلی یافت نشد</p>
        </Card>
      )}
    </motion.div>
  )
}
