'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/auth-context'
import {
  LayoutDashboard,
  Users,
  Scissors,
  Calendar,
  Star,
  Settings,
  BarChart3,
  Menu,
  X,
  LogOut,
  User,
  Clock,
  ChevronDown,
  ClipboardList,
} from 'lucide-react'

const managerNavItems = [
  { href: '/dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { href: '/dashboard/appointments', label: 'نوبت‌ها', icon: Calendar },
  { href: '/dashboard/staff', label: 'پرسنل', icon: Users },
  { href: '/dashboard/services', label: 'خدمات', icon: Scissors },
  { href: '/dashboard/visit-types', label: 'نوع مراجعه', icon: ClipboardList },
  { href: '/dashboard/schedule', label: 'ساعات سالن', icon: Clock },
  { href: '/dashboard/reviews', label: 'نظرات', icon: Star },
  { href: '/dashboard/analytics', label: 'گزارشات', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'تنظیمات', icon: Settings },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-50 flex items-center justify-between px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        <Link href="/dashboard" className="flex items-center gap-2">
          <Scissors className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg">{user?.salon?.name || 'فیر سالن'}</span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.avatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {user ? getInitials(user.firstName, user.lastName) : 'U'}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              {user?.firstName} {user?.lastName}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <User className="w-4 h-4 ml-2" />
                پروفایل
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logout()} className="text-destructive">
              <LogOut className="w-4 h-4 ml-2" />
              خروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 z-50"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed top-0 right-0 bottom-0 w-72 bg-sidebar z-50 border-l border-sidebar-border"
            >
              <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
                <div className="flex items-center gap-2">
                  <Scissors className="w-6 h-6 text-primary" />
                  <span className="font-bold">{user?.salon?.name || 'فیر سالن'}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <nav className="p-4 space-y-1">
                {managerNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      pathname === item.href
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed top-0 right-0 bottom-0 w-64 bg-sidebar border-l border-sidebar-border flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Scissors className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-sm">{user?.salon?.name || 'فیر سالن'}</h1>
              <p className="text-xs text-muted-foreground">پنل مدیریت</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {managerNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                pathname === item.href
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={user?.avatar || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {user ? getInitials(user.firstName, user.lastName) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-right">
                  <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground">
                    {user?.role === 'MANAGER' ? 'مدیر' : 'ادمین'}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile">
                  <User className="w-4 h-4 ml-2" />
                  پروفایل
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} className="text-destructive">
                <LogOut className="w-4 h-4 ml-2" />
                خروج از حساب
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:mr-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
