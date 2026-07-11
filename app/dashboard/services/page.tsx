'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Textarea } from '@/components/ui/textarea'
import { formatPersianPrice, formatPersianDuration, englishToPersian } from '@/lib/jalali'
import { Plus, Search, MoreVertical, Clock, DollarSign, Edit, Trash2, Scissors } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Service {
  id: string
  name: string
  description?: string
  price: number
  discountPrice?: number
  duration: number
  category: string
  isActive: boolean
}

interface Category {
  id: string
  name: string
  servicesCount: number
}

// Mock data
const mockCategories: Category[] = [
  { id: '1', name: 'مو', servicesCount: 5 },
  { id: '2', name: 'ناخن', servicesCount: 3 },
  { id: '3', name: 'صورت', servicesCount: 4 },
  { id: '4', name: 'ماساژ', servicesCount: 2 },
]

const mockServices: Service[] = [
  {
    id: '1',
    name: 'کراتین مو',
    description: 'صافی و براقیت مو با کراتین برزیلی اصل',
    price: 2500000,
    discountPrice: 2200000,
    duration: 180,
    category: 'مو',
    isActive: true,
  },
  {
    id: '2',
    name: 'رنگ مو',
    description: 'رنگ مو با رنگ‌های معتبر',
    price: 800000,
    duration: 120,
    category: 'مو',
    isActive: true,
  },
  {
    id: '3',
    name: 'کوتاهی مو',
    description: 'کوتاهی مدل روز',
    price: 350000,
    duration: 45,
    category: 'مو',
    isActive: true,
  },
  {
    id: '4',
    name: 'مانیکور',
    description: 'مانیکور ساده یا ژل',
    price: 250000,
    duration: 60,
    category: 'ناخن',
    isActive: true,
  },
  {
    id: '5',
    name: 'پاکسازی صورت',
    description: 'پاکسازی عمقی پوست',
    price: 450000,
    duration: 90,
    category: 'صورت',
    isActive: true,
  },
  {
    id: '6',
    name: 'اصلاح ابرو',
    description: 'اصلاح و فرم‌دهی ابرو',
    price: 150000,
    duration: 30,
    category: 'صورت',
    isActive: true,
  },
]

export default function ServicesPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [services] = useState<Service[]>(mockServices)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  const filteredServices = services.filter((s) => {
    const matchesSearch = s.name.includes(search) || s.description?.includes(search)
    const matchesCategory = !selectedCategory || s.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مدیریت خدمات</h1>
          <p className="text-muted-foreground">لیست خدمات و قیمت‌گذاری</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 ml-2" />
              افزودن خدمت
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>افزودن خدمت جدید</DialogTitle>
              <DialogDescription>
                اطلاعات خدمت جدید را وارد کنید
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">نام خدمت</Label>
                <Input id="name" placeholder="نام خدمت" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">توضیحات</Label>
                <Textarea id="description" placeholder="توضیحات خدمت..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">قیمت (تومان)</Label>
                  <Input id="price" type="number" placeholder="۰" dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">مدت (دقیقه)</Label>
                  <Input id="duration" type="number" placeholder="۶۰" dir="ltr" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">دسته‌بندی</Label>
                <Input id="category" placeholder="انتخاب دسته‌بندی" />
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

      {/* Categories */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          همه
        </Button>
        {mockCategories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.name ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category.name)}
          >
            {category.name}
            <Badge variant="secondary" className="mr-2 text-xs">
              {englishToPersian(category.servicesCount.toString())}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="جستجو در خدمات..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((service, index) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`glass ${!service.isActive && 'opacity-60'}`}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Scissors className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{service.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {service.category}
                    </Badge>
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
                {service.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {service.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {formatPersianDuration(service.duration)}
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <div className="text-left">
                      {service.discountPrice ? (
                        <>
                          <span className="text-destructive line-through text-xs">
                            {formatPersianPrice(service.price)}
                          </span>
                          <br />
                          <span className="font-bold text-success">
                            {formatPersianPrice(service.discountPrice)}
                          </span>
                        </>
                      ) : (
                        <span className="font-bold">{formatPersianPrice(service.price)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredServices.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">خدمتی یافت نشد</p>
        </Card>
      )}
    </motion.div>
  )
}
