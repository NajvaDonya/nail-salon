'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { persianToEnglish } from '@/lib/jalali'
import { formatCustomerName, type CustomerSummary } from '@/lib/customer'

const MIN_SEARCH_LENGTH = 2

export interface CustomerPickerValue {
  customerId: string | null
  customerName: string
  customerPhone: string
}

interface CustomerPickerProps {
  value: CustomerPickerValue
  onChange: (value: CustomerPickerValue) => void
  idPrefix?: string
}

async function searchCustomers(query: string): Promise<CustomerSummary[]> {
  const res = await fetch(`/api/dashboard/customers?q=${encodeURIComponent(query)}`, {
    credentials: 'include',
    cache: 'no-store',
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || 'خطا در جستجو')
  }
  return data.customers ?? []
}

export function CustomerPicker({
  value,
  onChange,
  idPrefix = 'customer',
}: CustomerPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<CustomerSummary[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  const isExistingCustomer = value.customerId !== null
  const isNewCustomer = value.customerId === null && value.customerName.trim().length > 0
  const trimmedSearch = search.trim()
  const canSearch = trimmedSearch.length >= MIN_SEARCH_LENGTH

  useEffect(() => {
    if (!open || !canSearch) {
      setResults([])
      setIsSearching(false)
      setSearchError('')
      return
    }

    setIsSearching(true)
    setSearchError('')

    const timer = setTimeout(async () => {
      try {
        const customers = await searchCustomers(trimmedSearch)
        setResults(customers)
      } catch (error) {
        setResults([])
        setSearchError(error instanceof Error ? error.message : 'خطا در جستجو')
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [open, trimmedSearch, canSearch])

  const selectExisting = (customer: CustomerSummary) => {
    onChange({
      customerId: customer.id,
      customerName: formatCustomerName(customer),
      customerPhone: customer.phone,
    })
    setOpen(false)
    setSearch('')
    setResults([])
  }

  const selectNewFromSearch = (name: string) => {
    onChange({
      customerId: null,
      customerName: name.trim(),
      customerPhone: '',
    })
    setOpen(false)
    setSearch('')
    setResults([])
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen && isNewCustomer) {
      setSearch(value.customerName)
    }
    if (!nextOpen) {
      setSearch('')
      setResults([])
      setSearchError('')
      setIsSearching(false)
    }
  }

  const triggerLabel = () => {
    if (isExistingCustomer) {
      return (
        <span className="truncate">
          {value.customerName} — {value.customerPhone}
        </span>
      )
    }

    if (isNewCustomer) {
      return (
        <span className="truncate">
          {value.customerName}
          {value.customerPhone ? (
            <span className="text-muted-foreground mr-2" dir="ltr">
              {' '}
              — {value.customerPhone}
            </span>
          ) : (
            <span className="text-muted-foreground mr-2"> — مشتری جدید</span>
          )}
        </span>
      )
    }

    return (
      <span className="flex items-center gap-2 text-muted-foreground">
        <UserPlus className="w-4 h-4" />
        جستجو با نام مشتری...
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>مشتری *</Label>
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
            >
              {triggerLabel()}
              <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="نام مشتری را وارد کنید..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                {!canSearch && (
                  <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                    برای جستجو حداقل {MIN_SEARCH_LENGTH} حرف وارد کنید
                  </p>
                )}

                {canSearch && isSearching && (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    در حال جستجو...
                  </div>
                )}

                {canSearch && !isSearching && searchError && (
                  <p className="px-3 py-4 text-sm text-destructive text-center">{searchError}</p>
                )}

                {canSearch && !isSearching && !searchError && results.length === 0 && (
                  <>
                    <CommandEmpty>مشتری یافت نشد</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value={`new-${trimmedSearch}`}
                        onSelect={() => selectNewFromSearch(trimmedSearch)}
                      >
                        <UserPlus className="w-4 h-4 ml-2" />
                        ثبت «{trimmedSearch}» به عنوان مشتری جدید
                        <Check
                          className={cn(
                            'mr-auto h-4 w-4',
                            isNewCustomer && value.customerName === trimmedSearch
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}

                {canSearch && !isSearching && results.length > 0 && (
                  <>
                    <CommandGroup>
                      <CommandItem
                        value={`new-${trimmedSearch}`}
                        onSelect={() => selectNewFromSearch(trimmedSearch)}
                      >
                        <UserPlus className="w-4 h-4 ml-2" />
                        ثبت «{trimmedSearch}» به عنوان مشتری جدید
                        <Check
                          className={cn(
                            'mr-auto h-4 w-4',
                            isNewCustomer && value.customerName === trimmedSearch
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup heading="نتایج جستجو">
                      {results.map((customer) => {
                        const label = formatCustomerName(customer)
                        return (
                          <CommandItem
                            key={customer.id}
                            value={customer.id}
                            onSelect={() => selectExisting(customer)}
                          >
                            <span className="flex-1 truncate">
                              {label}
                              <span className="text-muted-foreground text-xs mr-2" dir="ltr">
                                {customer.phone}
                              </span>
                            </span>
                            <Check
                              className={cn(
                                'h-4 w-4',
                                value.customerId === customer.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {isNewCustomer && (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-phone`}>شماره موبایل *</Label>
          <Input
            id={`${idPrefix}-phone`}
            type="tel"
            dir="ltr"
            placeholder="۰۹۱۲۳۴۵۶۷۸۹"
            value={value.customerPhone}
            onChange={(e) =>
              onChange({
                ...value,
                customerPhone: persianToEnglish(e.target.value).replace(/\D/g, '').slice(0, 11),
              })
            }
            required
          />
        </div>
      )}
    </div>
  )
}
