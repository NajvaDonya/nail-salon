'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { englishToPersian, persianToEnglish } from '@/lib/jalali'
import { mapLegacyCategory } from '@/lib/category-map'
import { Plus, Search, MoreVertical, Phone, Star, Edit, Trash2, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Category {
  id: string
  name: string
  servicesCount?: number
}

interface StaffService {
  id: string
  name: string
}

interface StaffMember {
  id: string
  user: {
    id: string
    phone: string
    firstName: string
    lastName: string
    avatar?: string | null
  }
  specialties: string[] | null
  services?: StaffService[]
  isActive: boolean
  appointmentCount: number
  averageRating: number
}

interface SalonService {
  id: string
  name: string
  kind?: 'BASE' | 'ADDON'
  isActive: boolean
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'خطا در دریافت پرسنل')
  }
  return data
}

const emptyStaffForm = {
  firstName: '',
  lastName: '',
  phone: '',
  password: '',
  specialties: [] as string[],
  serviceIds: [] as string[],
  isActive: true,
}

export default function StaffPage() {
  const [search, setSearch] = useState('')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [form, setForm] = useState(emptyStaffForm)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const { data, error, isLoading, mutate } = useSWR<{ staff: StaffMember[] }>(
    '/api/dashboard/staff',
    fetcher
  )

  const { data: categoriesData, isLoading: categoriesLoading } = useSWR<{ categories: Category[] }>(
    '/api/dashboard/categories',
    fetcher
  )

  const { data: servicesData, isLoading: servicesLoading } = useSWR<{ services: SalonService[] }>(
    '/api/dashboard/services',
    fetcher
  )

  const categories = categoriesData?.categories ?? []
  const bookableServices = (servicesData?.services ?? []).filter(
    (service) => service.isActive && (service.kind ?? 'BASE') === 'BASE'
  )

  const staff = data?.staff ?? []

  const filteredStaff = useMemo(() => {
    return staff.filter((member) => {
      const fullName = `${member.user.firstName} ${member.user.lastName}`
      return fullName.includes(search) || member.user.phone.includes(search)
    })
  }, [staff, search])

  const resetForm = () => {
    setForm(emptyStaffForm)
    setFormError('')
    setEditingStaff(null)
  }

  const formatPhone = (value: string) => {
    const cleaned = persianToEnglish(value).replace(/\D/g, '')
    if (cleaned.length <= 11) {
      setForm((prev) => ({ ...prev, phone: cleaned }))
    }
  }

  const toggleSpecialty = (name: string) => {
    setForm((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(name)
        ? prev.specialties.filter((item) => item !== name)
        : [...prev.specialties, name],
    }))
  }

  const toggleService = (serviceId: string) => {
    setForm((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter((id) => id !== serviceId)
        : [...prev.serviceIds, serviceId],
    }))
  }

  const normalizeMemberSpecialties = (member: StaffMember) => {
    const validNames = new Set(categories.map((category) => category.name))
    const existing = Array.isArray(member.specialties) ? member.specialties : []
    return [...new Set(existing.map(mapLegacyCategory).filter((name) => validNames.has(name)))]
  }

  const openEditDialog = (member: StaffMember) => {
    setFormError('')
    setEditingStaff(member)
    setForm({
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      phone: member.user.phone,
      password: '',
      specialties: normalizeMemberSpecialties(member),
      serviceIds: (member.services ?? []).map((service) => service.id),
      isActive: member.isActive,
    })
    setIsEditDialogOpen(true)
  }

  const handleSubmitStaff = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError('نام و نام خانوادگی الزامی است')
      return
    }

    const phone = persianToEnglish(form.phone).replace(/\D/g, '')

    if (phone.length !== 11 || !phone.startsWith('09')) {
      setFormError('شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود')
      return
    }

    if (!editingStaff && form.password.length < 6) {
      setFormError('رمز عبور باید حداقل ۶ کاراکتر باشد')
      return
    }

    if (editingStaff && form.password && form.password.length < 6) {
      setFormError('رمز عبور باید حداقل ۶ کاراکتر باشد')
      return
    }

    if (form.specialties.length === 0) {
      setFormError('حداقل یک تخصص باید انتخاب شود')
      return
    }

    if (categories.length === 0) {
      setFormError('ابتدا دسته‌بندی خدمات را در بخش خدمات تعریف کنید')
      return
    }

    const specialties = form.specialties

    setIsSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone,
        specialties,
        serviceIds: form.serviceIds,
        isActive: form.isActive,
      }

      if (form.password) {
        payload.password = form.password
      }

      const res = await fetch(
        editingStaff ? `/api/dashboard/staff/${editingStaff.id}` : '/api/dashboard/staff',
        {
          method: editingStaff ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(
            editingStaff
              ? payload
              : { ...payload, password: form.password }
          ),
        }
      )

      const result = await res.json()

      if (!res.ok) {
        setFormError(result.error || (editingStaff ? 'خطا در ویرایش پرسنل' : 'خطا در افزودن پرسنل'))
        return
      }

      await mutate()
      resetForm()
      setIsAddDialogOpen(false)
      setIsEditDialogOpen(false)
    } catch {
      setFormError('خطا در برقراری ارتباط با سرور')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (member: StaffMember) => {
    setTogglingId(member.id)
    try {
      const res = await fetch(`/api/dashboard/staff/${member.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !member.isActive }),
      })

      const result = await res.json()
      if (!res.ok) {
        setFormError(result.error || 'خطا در تغییر وضعیت')
        return
      }

      await mutate()
      setFormError('')
    } catch {
      setFormError('خطا در برقراری ارتباط با سرور')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDeleteStaff = async (member: StaffMember) => {
    if (member.appointmentCount > 0) {
      setFormError('این پرسنل نوبت دارد و قابل حذف نیست. می‌توانید غیرفعالش کنید.')
      return
    }

    const name = `${member.user.firstName} ${member.user.lastName}`
    if (!confirm(`پرسنل «${name}» حذف شود؟`)) return

    try {
      const res = await fetch(`/api/dashboard/staff/${member.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const result = await res.json()
      if (!res.ok) {
        setFormError(result.error || 'خطا در حذف پرسنل')
        return
      }

      await mutate()
      setFormError('')
    } catch {
      setFormError('خطا در برقراری ارتباط با سرور')
    }
  }

  const renderStaffForm = (mode: 'add' | 'edit') => (
    <form className="space-y-4" onSubmit={handleSubmitStaff}>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${mode}-firstName`}>نام</Label>
          <Input
            id={`${mode}-firstName`}
            placeholder="نام"
            value={form.firstName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, firstName: e.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${mode}-lastName`}>نام خانوادگی</Label>
          <Input
            id={`${mode}-lastName`}
            placeholder="نام خانوادگی"
            value={form.lastName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, lastName: e.target.value }))
            }
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${mode}-phone`}>شماره موبایل</Label>
        <Input
          id={`${mode}-phone`}
          type="tel"
          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
          dir="ltr"
          value={form.phone}
          onChange={(e) => formatPhone(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${mode}-password`}>
          {mode === 'edit' ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور'}
        </Label>
        <Input
          id={`${mode}-password`}
          type="password"
          placeholder={mode === 'edit' ? 'در صورت نیاز به تغییر' : 'حداقل ۶ کاراکتر'}
          value={form.password}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, password: e.target.value }))
          }
          required={mode === 'add'}
          minLength={mode === 'add' ? 6 : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label>تخصص‌ها *</Label>
        <p className="text-xs text-muted-foreground">حداقل یک دسته‌بندی انتخاب کنید</p>
        {categoriesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            در حال بارگذاری دسته‌بندی‌ها...
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-destructive rounded-lg border border-dashed p-3">
            دسته‌بندی‌ای تعریف نشده. از بخش خدمات دسته‌بندی اضافه کنید.
          </p>
        ) : (
          <div className="rounded-lg border p-3 space-y-2 max-h-40 overflow-y-auto">
            {categories.map((category) => (
              <label
                key={category.id}
                htmlFor={`${mode}-specialty-${category.id}`}
                className="flex items-center gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/50"
              >
                <Checkbox
                  id={`${mode}-specialty-${category.id}`}
                  checked={form.specialties.includes(category.name)}
                  onCheckedChange={() => toggleSpecialty(category.name)}
                />
                <span className="text-sm">{category.name}</span>
              </label>
            ))}
          </div>
        )}
        {form.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {form.specialties.map((specialty) => (
              <Badge key={specialty} variant="secondary" className="text-xs">
                {specialty}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>خدمات قابل ارائه</Label>
        <p className="text-xs text-muted-foreground">
          خدمات پایه‌ای که این پرسنل می‌تواند انجام دهد
        </p>
        {servicesLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            در حال بارگذاری خدمات...
          </div>
        ) : bookableServices.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
            خدمت پایه‌ای تعریف نشده. از بخش خدمات اضافه کنید.
          </p>
        ) : (
          <div className="rounded-lg border p-3 space-y-2 max-h-40 overflow-y-auto">
            {bookableServices.map((service) => (
              <label
                key={service.id}
                htmlFor={`${mode}-service-${service.id}`}
                className="flex items-center gap-3 cursor-pointer rounded-md p-2 hover:bg-muted/50"
              >
                <Checkbox
                  id={`${mode}-service-${service.id}`}
                  checked={form.serviceIds.includes(service.id)}
                  onCheckedChange={() => toggleService(service.id)}
                />
                <span className="text-sm">{service.name}</span>
              </label>
            ))}
          </div>
        )}
        {form.serviceIds.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {form.serviceIds.map((serviceId) => {
              const service = bookableServices.find((item) => item.id === serviceId)
              if (!service) return null
              return (
                <Badge key={serviceId} variant="outline" className="text-xs">
                  {service.name}
                </Badge>
              )
            })}
          </div>
        )}
      </div>

      {mode === 'edit' && (
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor={`${mode}-isActive`}>وضعیت</Label>
            <p className="text-xs text-muted-foreground">
              {form.isActive ? 'پرسنل فعال است' : 'پرسنل غیرفعال است'}
            </p>
          </div>
          <Switch
            id={`${mode}-isActive`}
            checked={form.isActive}
            onCheckedChange={(checked) =>
              setForm((prev) => ({ ...prev, isActive: checked }))
            }
          />
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
            setIsAddDialogOpen(false)
            setIsEditDialogOpen(false)
            resetForm()
          }}
          disabled={isSubmitting}
        >
          انصراف
        </Button>
        <Button type="submit" disabled={isSubmitting || categoriesLoading || categories.length === 0}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              در حال ذخیره...
            </>
          ) : (
            'ذخیره'
          )}
        </Button>
      </div>
    </form>
  )

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مدیریت پرسنل</h1>
          <p className="text-muted-foreground">افزودن و مدیریت کارکنان سالن</p>
        </div>
        <Dialog
          open={isAddDialogOpen}
          onOpenChange={(open) => {
            setIsAddDialogOpen(open)
            if (!open) resetForm()
          }}
        >
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
                پرسنل با شماره موبایل و رمز عبور وارد پنل کارکنان می‌شود
              </DialogDescription>
            </DialogHeader>
            {renderStaffForm('add')}
          </DialogContent>
        </Dialog>

        <Dialog
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open)
            if (!open) resetForm()
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>ویرایش پرسنل</DialogTitle>
              <DialogDescription>
                اطلاعات پرسنل را ویرایش کنید
              </DialogDescription>
            </DialogHeader>
            {renderStaffForm('edit')}
          </DialogContent>
        </Dialog>
      </div>

      {formError && !isAddDialogOpen && !isEditDialogOpen && (
        <p className="text-sm text-destructive">{formError}</p>
      )}

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="جستجو در پرسنل..."
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

      {error && (
        <Card className="p-8 text-center">
          <p className="text-destructive">{error.message}</p>
        </Card>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((member, index) => {
            const specialties = Array.isArray(member.specialties) ? member.specialties : []

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`glass ${!member.isActive && 'opacity-60'}`}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={member.user.avatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {member.user.firstName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">
                          {member.user.firstName} {member.user.lastName}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-warning text-warning" />
                          {englishToPersian(member.averageRating.toFixed(1))}
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
                        <DropdownMenuItem onClick={() => openEditDialog(member)}>
                          <Edit className="w-4 h-4 ml-2" />
                          ویرایش
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={member.appointmentCount > 0}
                          onClick={() => handleDeleteStaff(member)}
                        >
                          <Trash2 className="w-4 h-4 ml-2" />
                          {member.appointmentCount > 0 ? 'حذف (دارای نوبت)' : 'حذف'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {specialties.map((specialty) => (
                          <Badge key={specialty} variant="secondary" className="text-xs">
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span dir="ltr">{member.user.phone}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-muted-foreground">تعداد نوبت‌ها</span>
                      <Badge variant={member.appointmentCount > 0 ? 'default' : 'secondary'}>
                        {englishToPersian(member.appointmentCount.toString())} نوبت
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">وضعیت</span>
                        <Badge variant={member.isActive ? 'default' : 'secondary'}>
                          {member.isActive ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </div>
                      <Switch
                        checked={member.isActive}
                        disabled={togglingId === member.id}
                        onCheckedChange={() => handleToggleActive(member)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {!isLoading && !error && filteredStaff.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            {staff.length === 0
              ? 'پرسنلی ثبت نشده. اولین پرسنل را اضافه کنید.'
              : 'پرسنلی یافت نشد'}
          </p>
        </Card>
      )}
    </motion.div>
  )
}
