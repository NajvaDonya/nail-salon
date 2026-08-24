'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatPersianPrice, formatPersianDuration, englishToPersian } from '@/lib/jalali'
import {
  Plus,
  Search,
  MoreVertical,
  Clock,
  DollarSign,
  Edit,
  Trash2,
  Scissors,
  Loader2,
  FolderPlus,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Service {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  duration: number
  depositAmount?: number
  kind?: 'BASE' | 'ADDON'
  allowQuantity?: boolean
  maxQuantity?: number | null
  categoryId: string
  category: string
  isActive: boolean
  appointmentCount?: number
  staffCount?: number
  isInUse?: boolean
}

interface Category {
  id: string
  name: string
  servicesCount: number
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'خطا در دریافت اطلاعات')
  }
  return data
}

const emptyServiceForm = {
  name: '',
  price: '',
  duration: '',
  depositAmount: '',
  categoryId: '',
  kind: 'BASE' as 'BASE' | 'ADDON',
  allowQuantity: false,
  maxQuantity: '',
}

export default function ServicesPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)
  const [serviceForm, setServiceForm] = useState(emptyServiceForm)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [formError, setFormError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [addonServiceIds, setAddonServiceIds] = useState<string[]>([])
  const [availableAddons, setAvailableAddons] = useState<
    { id: string; name: string; price: number; duration: number; depositAmount: number }[]
  >([])
  const [addonsLoading, setAddonsLoading] = useState(false)
  const [addonsSaving, setAddonsSaving] = useState(false)

  const {
    data: servicesData,
    error: servicesError,
    isLoading: servicesLoading,
    mutate: mutateServices,
  } = useSWR<{ services: Service[] }>('/api/dashboard/services', fetcher)

  const {
    data: categoriesData,
    error: categoriesError,
    isLoading: categoriesLoading,
    mutate: mutateCategories,
  } = useSWR<{ categories: Category[] }>('/api/dashboard/categories', fetcher)

  const services = servicesData?.services ?? []
  const categories = categoriesData?.categories ?? []

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch = service.name.includes(search)
      const matchesCategory =
        !selectedCategory ||
        service.categoryId === selectedCategory ||
        service.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [services, search, selectedCategory])

  const resetServiceForm = () => {
    setServiceForm(emptyServiceForm)
    setFormError('')
    setEditingService(null)
    setAddonServiceIds([])
    setAvailableAddons([])
  }

  const loadServiceAddons = async (serviceId: string) => {
    setAddonsLoading(true)
    try {
      const res = await fetch(`/api/dashboard/services/${serviceId}/addons`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'خطا در دریافت افزونه‌ها')
      }
      setAvailableAddons(data.availableAddons ?? [])
      setAddonServiceIds((data.linkedAddons ?? []).map((addon: { id: string }) => addon.id))
    } catch {
      setAvailableAddons([])
      setAddonServiceIds([])
    } finally {
      setAddonsLoading(false)
    }
  }

  const openEditDialog = async (service: Service) => {
    setEditingService(service)
    setServiceForm({
      name: service.name,
      price: service.price.toString(),
      duration: service.duration.toString(),
      depositAmount: (service.depositAmount ?? 0).toString(),
      categoryId: service.categoryId,
      kind: service.kind ?? 'BASE',
      allowQuantity: service.allowQuantity ?? false,
      maxQuantity: service.maxQuantity?.toString() ?? '',
    })
    setFormError('')
    setIsEditDialogOpen(true)
    if ((service.kind ?? 'BASE') === 'BASE') {
      await loadServiceAddons(service.id)
    } else {
      setAddonServiceIds([])
      setAvailableAddons([])
    }
  }

  const handleCreateCategory = async (event: React.FormEvent) => {
    event.preventDefault()
    setCategoryError('')

    const name = newCategoryName.trim()
    if (name.length < 2) {
      setCategoryError('نام دسته‌بندی باید حداقل ۲ کاراکتر باشد')
      return
    }

    setIsCreatingCategory(true)

    try {
      const res = await fetch('/api/dashboard/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      })

      const result = await res.json()

      if (!res.ok) {
        setCategoryError(result.error || 'خطا در افزودن دسته‌بندی')
        return
      }

      await mutateCategories()
      setNewCategoryName('')
      setIsCategoryDialogOpen(false)
    } catch {
      setCategoryError('خطا در برقراری ارتباط با سرور')
    } finally {
      setIsCreatingCategory(false)
    }
  }

  const handleDeleteCategory = async (category: Category) => {
    if (category.servicesCount > 0) {
      setCategoryError('دسته‌بندی‌های دارای خدمت قابل حذف نیستند')
      return
    }

    if (!confirm(`دسته‌بندی «${category.name}» حذف شود؟`)) return

    try {
      const res = await fetch(`/api/dashboard/categories/${category.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const result = await res.json()
      if (!res.ok) {
        setCategoryError(result.error || 'خطا در حذف دسته‌بندی')
        return
      }

      if (selectedCategory === category.id) {
        setSelectedCategory(null)
      }

      await mutateCategories()
    } catch {
      setCategoryError('خطا در برقراری ارتباط با سرور')
    }
  }

  const handleSubmitService = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')

    const price = Number(serviceForm.price)
    const duration = Number(serviceForm.duration)

    if (!serviceForm.name.trim()) {
      setFormError('نام خدمت الزامی است')
      return
    }

    if (!serviceForm.categoryId) {
      setFormError('لطفاً یک دسته‌بندی انتخاب کنید')
      return
    }

    if (!Number.isFinite(price) || price <= 0) {
      setFormError('قیمت معتبر وارد کنید')
      return
    }

    if (!Number.isFinite(duration) || duration < 5) {
      setFormError('مدت زمان باید حداقل ۵ دقیقه باشد')
      return
    }

    const depositAmount = Number(serviceForm.depositAmount || 0)

    if (!Number.isFinite(depositAmount) || depositAmount < 0) {
      setFormError('بیعانه معتبر وارد کنید')
      return
    }

    setIsSubmitting(true)

    const payload = {
      name: serviceForm.name.trim(),
      price,
      duration,
      depositAmount,
      categoryId: serviceForm.categoryId,
      kind: serviceForm.kind,
      allowQuantity: serviceForm.allowQuantity,
      maxQuantity: serviceForm.maxQuantity ? Number(serviceForm.maxQuantity) : undefined,
    }

    try {
      const res = await fetch(
        editingService
          ? `/api/dashboard/services/${editingService.id}`
          : '/api/dashboard/services',
        {
          method: editingService ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      )

      const result = await res.json()

      if (!res.ok) {
        setFormError(result.error || (editingService ? 'خطا در ویرایش خدمت' : 'خطا در افزودن خدمت'))
        return
      }

      await Promise.all([mutateServices(), mutateCategories()])
      resetServiceForm()
      setIsAddDialogOpen(false)
      setIsEditDialogOpen(false)
    } catch {
      setFormError('خطا در برقراری ارتباط با سرور')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleAddonService = (addonId: string) => {
    setAddonServiceIds((prev) =>
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    )
  }

  const handleSaveAddons = async () => {
    if (!editingService || (editingService.kind ?? 'BASE') !== 'BASE') return

    setAddonsSaving(true)
    setFormError('')

    try {
      const res = await fetch(`/api/dashboard/services/${editingService.id}/addons`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ addonServiceIds }),
      })

      const result = await res.json()
      if (!res.ok) {
        setFormError(result.error || 'خطا در ذخیره افزونه‌ها')
        return
      }
    } catch {
      setFormError('خطا در برقراری ارتباط با سرور')
    } finally {
      setAddonsSaving(false)
    }
  }

  const handleDeleteService = async (service: Service) => {
    if (service.isInUse) {
      setFormError('این خدمت در نوبت یا پرسنل استفاده شده و قابل حذف نیست')
      return
    }

    if (!confirm(`خدمت «${service.name}» حذف شود؟`)) return

    try {
      const res = await fetch(`/api/dashboard/services/${service.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const result = await res.json()
      if (!res.ok) {
        setFormError(result.error || 'خطا در حذف خدمت')
        return
      }

      await Promise.all([mutateServices(), mutateCategories()])
    } catch {
      setFormError('خطا در برقراری ارتباط با سرور')
    }
  }

  const renderServiceForm = (mode: 'add' | 'edit') => (
    <form className="space-y-4" onSubmit={handleSubmitService}>
      <div className="space-y-2">
        <Label htmlFor={`${mode}-name`}>نام خدمت</Label>
        <Input
          id={`${mode}-name`}
          placeholder="مثلاً مانیکور ساده"
          value={serviceForm.name}
          onChange={(e) =>
            setServiceForm((prev) => ({ ...prev, name: e.target.value }))
          }
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-price`}>قیمت (تومان)</Label>
          <Input
            id={`${mode}-price`}
            type="number"
            min={0}
            placeholder="150000"
            dir="ltr"
            value={serviceForm.price}
            onChange={(e) =>
              setServiceForm((prev) => ({ ...prev, price: e.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-duration`}>مدت (دقیقه)</Label>
          <Input
            id={`${mode}-duration`}
            type="number"
            min={5}
            placeholder="60"
            dir="ltr"
            value={serviceForm.duration}
            onChange={(e) =>
              setServiceForm((prev) => ({ ...prev, duration: e.target.value }))
            }
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-deposit`}>بیعانه (تومان)</Label>
          <Input
            id={`${mode}-deposit`}
            type="number"
            min={0}
            dir="ltr"
            value={serviceForm.depositAmount}
            onChange={(e) =>
              setServiceForm((prev) => ({ ...prev, depositAmount: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-kind`}>نوع</Label>
          <Select
            value={serviceForm.kind}
            onValueChange={(value: 'BASE' | 'ADDON') =>
              setServiceForm((prev) => ({ ...prev, kind: value }))
            }
          >
            <SelectTrigger id={`${mode}-kind`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BASE">خدمت پایه</SelectItem>
              <SelectItem value="ADDON">افزونه</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label htmlFor={`${mode}-allowQuantity`}>امکان انتخاب تعداد</Label>
          <p className="text-xs text-muted-foreground">
            برای خدماتی مثل «ناخن شکسته» که قیمت و مدت به ازای هر واحد است
          </p>
        </div>
        <Checkbox
          id={`${mode}-allowQuantity`}
          checked={serviceForm.allowQuantity}
          onCheckedChange={(checked) =>
            setServiceForm((prev) => ({
              ...prev,
              allowQuantity: checked === true,
              maxQuantity: checked === true ? prev.maxQuantity : '',
            }))
          }
        />
      </div>
      {serviceForm.allowQuantity && (
        <div className="space-y-2">
          <Label htmlFor={`${mode}-maxQuantity`}>حداکثر تعداد</Label>
          <Input
            id={`${mode}-maxQuantity`}
            type="number"
            min={1}
            dir="ltr"
            placeholder="مثلاً ۱۰"
            value={serviceForm.maxQuantity}
            onChange={(e) =>
              setServiceForm((prev) => ({ ...prev, maxQuantity: e.target.value }))
            }
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={`${mode}-categoryId`}>دسته‌بندی</Label>
        <Select
          value={serviceForm.categoryId}
          onValueChange={(value) =>
            setServiceForm((prev) => ({ ...prev, categoryId: value }))
          }
        >
          <SelectTrigger id={`${mode}-categoryId`}>
            <SelectValue placeholder="انتخاب دسته‌بندی" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === 'edit' && serviceForm.kind === 'BASE' && (
        <div className="space-y-2 rounded-lg border p-3">
          <Label>افزونه‌های مرتبط</Label>
          <p className="text-xs text-muted-foreground">
            افزونه‌هایی که در رزرو بعد از انتخاب این خدمت نمایش داده می‌شوند
          </p>
          {addonsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              در حال بارگذاری افزونه‌ها...
            </div>
          ) : availableAddons.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              افزونه‌ای تعریف نشده. ابتدا خدمت با نوع «افزونه» بسازید.
            </p>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {availableAddons.map((addon) => (
                <label
                  key={addon.id}
                  htmlFor={`${mode}-addon-${addon.id}`}
                  className="flex items-center gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/50"
                >
                  <Checkbox
                    id={`${mode}-addon-${addon.id}`}
                    checked={addonServiceIds.includes(addon.id)}
                    onCheckedChange={() => toggleAddonService(addon.id)}
                  />
                  <span className="text-sm flex-1">{addon.name}</span>
                  <span className="text-xs text-muted-foreground" dir="ltr">
                    {formatPersianPrice(addon.price)}
                  </span>
                </label>
              ))}
            </div>
          )}
          {availableAddons.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSaveAddons}
              disabled={addonsSaving || addonsLoading}
            >
              {addonsSaving ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  در حال ذخیره افزونه‌ها...
                </>
              ) : (
                'ذخیره افزونه‌ها'
              )}
            </Button>
          )}
        </div>
      )}

      {formError && (
        <p className="text-sm text-destructive text-center">{formError}</p>
      )}

      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (mode === 'add') setIsAddDialogOpen(false)
            else setIsEditDialogOpen(false)
            resetServiceForm()
          }}
          disabled={isSubmitting}
        >
          انصراف
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              در حال ذخیره...
            </>
          ) : mode === 'add' ? (
            'ذخیره'
          ) : (
            'ذخیره تغییرات'
          )}
        </Button>
      </div>
    </form>
  )

  const isLoading = servicesLoading || categoriesLoading
  const loadError = servicesError || categoriesError

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مدیریت خدمات</h1>
          <p className="text-muted-foreground">ابتدا دسته‌بندی بسازید، سپس خدمات را اضافه کنید</p>
        </div>
        <div className="flex gap-2">
          <Dialog
            open={isCategoryDialogOpen}
            onOpenChange={(open) => {
              setIsCategoryDialogOpen(open)
              if (!open) {
                setNewCategoryName('')
                setCategoryError('')
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <FolderPlus className="w-4 h-4 ml-2" />
                دسته‌بندی جدید
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>افزودن دسته‌بندی</DialogTitle>
                <DialogDescription>
                  دسته‌بندی گروه خدمات شماست، مثل «ناخن»، «مو» یا «پاکسازی»
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreateCategory}>
                <div className="space-y-2">
                  <Label htmlFor="categoryName">نام دسته‌بندی</Label>
                  <Input
                    id="categoryName"
                    placeholder="مثلاً ناخن"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    required
                  />
                </div>
                {categoryError && (
                  <p className="text-sm text-destructive text-center">{categoryError}</p>
                )}
                <Button type="submit" className="w-full" disabled={isCreatingCategory}>
                  {isCreatingCategory ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      در حال ذخیره...
                    </>
                  ) : (
                    'ذخیره دسته‌بندی'
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isAddDialogOpen}
            onOpenChange={(open) => {
              setIsAddDialogOpen(open)
              if (!open) resetServiceForm()
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={categories.length === 0}>
                <Plus className="w-4 h-4 ml-2" />
                افزودن خدمت
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>افزودن خدمت جدید</DialogTitle>
                <DialogDescription>
                  خدمت را به یکی از دسته‌بندی‌های سالن اضافه کنید
                </DialogDescription>
              </DialogHeader>
              {renderServiceForm('add')}
            </DialogContent>
          </Dialog>

          <Dialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open)
              if (!open) resetServiceForm()
            }}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>ویرایش خدمت</DialogTitle>
                <DialogDescription>
                  تغییر نام روی همه نوبت‌ها (گذشته و آینده) اعمال می‌شود. تغییر قیمت و مدت فقط
                  روی نوبت‌های جدید اثر دارد.
                </DialogDescription>
              </DialogHeader>
              {renderServiceForm('edit')}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {categories.length === 0 && !isLoading && (
        <Card className="p-6 border-dashed">
          <div className="text-center space-y-3">
            <FolderPlus className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-medium">هنوز دسته‌بندی نساخته‌اید</p>
            <p className="text-sm text-muted-foreground">
              برای افزودن خدمت، ابتدا با دکمه «دسته‌بندی جدید» یک گروه بسازید
            </p>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)}>
              ساخت اولین دسته‌بندی
            </Button>
          </div>
        </Card>
      )}

      {categories.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">دسته‌بندی‌های شما</p>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              همه
            </Button>
            {categories.map((category) => (
              <div key={category.id} className="flex items-center gap-1">
                <Button
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                >
                  {category.name}
                  <Badge variant="secondary" className="mr-2 text-xs">
                    {englishToPersian(category.servicesCount.toString())}
                  </Badge>
                </Button>
                {category.servicesCount === 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteCategory(category)}
                    title="حذف دسته‌بندی"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="جستجو در خدمات..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {loadError && (
        <Card className="p-8 text-center">
          <p className="text-destructive">{loadError.message}</p>
        </Card>
      )}

      {!isLoading && !loadError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service, index) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
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
                      <DropdownMenuItem onClick={() => openEditDialog(service)}>
                        <Edit className="w-4 h-4 ml-2" />
                        ویرایش
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        disabled={service.isInUse}
                        onClick={() => handleDeleteService(service)}
                      >
                        <Trash2 className="w-4 h-4 ml-2" />
                        {service.isInUse ? 'حذف (در حال استفاده)' : 'حذف'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
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
      )}

      {!isLoading && !loadError && filteredServices.length === 0 && categories.length > 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            {services.length === 0
              ? 'هنوز خدمتی ثبت نشده. اولین خدمت را اضافه کنید.'
              : 'خدمتی یافت نشد'}
          </p>
        </Card>
      )}
    </motion.div>
  )
}
