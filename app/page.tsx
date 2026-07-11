'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Scissors,
  Calendar,
  Users,
  Star,
  Shield,
  Smartphone,
  BarChart3,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react'

const features = [
  {
    icon: Calendar,
    title: 'رزرو آنلاین',
    description: 'نوبت‌دهی هوشمند با محاسبه خودکار زمان‌های آزاد',
  },
  {
    icon: Users,
    title: 'مدیریت پرسنل',
    description: 'تعریف ساعات کاری، مرخصی و تخصص هر کارمند',
  },
  {
    icon: Star,
    title: 'نظرات و امتیازات',
    description: 'دریافت بازخورد مشتریان و بهبود کیفیت خدمات',
  },
  {
    icon: BarChart3,
    title: 'گزارشات جامع',
    description: 'آنالیز درآمد، نوبت‌ها و عملکرد پرسنل',
  },
  {
    icon: Smartphone,
    title: 'اعلان پیامکی',
    description: 'یادآوری خودکار نوبت به مشتریان',
  },
  {
    icon: Shield,
    title: 'امنیت بالا',
    description: 'رمزنگاری اطلاعات و احراز هویت دو مرحله‌ای',
  },
]

const benefits = [
  'افزایش ۴۰٪ رضایت مشتریان',
  'کاهش ۶۰٪ نوبت‌های فراموش شده',
  'صرفه‌جویی ۱۰ ساعت در هفته',
  'گزارش‌گیری لحظه‌ای',
]

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-1/4 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        </div>

        {/* Navigation */}
        <nav className="relative z-10 container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Scissors className="w-5 h-5 text-primary" />
              </div>
              <span className="font-bold text-xl">فیر سالن</span>
            </Link>
            <div className="flex items-center gap-4">
              <Button variant="ghost" asChild>
                <Link href="/auth/login">ورود</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/login">شروع رایگان</Link>
              </Button>
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-4 py-20 lg:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl lg:text-6xl font-bold leading-tight text-balance">
                سامانه جامع
                <span className="text-primary"> مدیریت سالن </span>
                زیبایی
              </h1>
              <p className="mt-6 text-xl text-muted-foreground text-pretty">
                نوبت‌دهی آنلاین، مدیریت پرسنل، خدمات و نظرات مشتریان
                همه در یک پلتفرم یکپارچه
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button size="lg" asChild className="min-w-48">
                <Link href="/auth/login">
                  شروع رایگان
                  <ArrowLeft className="w-4 h-4 mr-2" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="min-w-48">
                <Link href="#features">مشاهده امکانات</Link>
              </Button>
            </motion.div>

            {/* Benefits */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-16 flex flex-wrap items-center justify-center gap-6"
            >
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <span>{benefit}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold">امکانات کامل برای سالن شما</h2>
            <p className="mt-4 text-muted-foreground">
              همه ابزارهایی که برای مدیریت حرفه‌ای سالن نیاز دارید
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="glass h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="glass overflow-hidden">
            <CardContent className="p-8 lg:p-12">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="max-w-lg">
                  <h2 className="text-3xl font-bold">آماده شروع هستید؟</h2>
                  <p className="mt-4 text-muted-foreground">
                    همین حالا سالن خود را ثبت کنید و از امکانات فیر سالن بهره‌مند شوید.
                    ۱۴ روز استفاده رایگان!
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" asChild>
                    <Link href="/auth/login">
                      ثبت‌نام رایگان
                      <ArrowLeft className="w-4 h-4 mr-2" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="#">تماس با ما</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-primary" />
              <span className="font-bold">فیر سالن</span>
            </div>
            <p className="text-sm text-muted-foreground">
              تمامی حقوق محفوظ است © ۱۴۰۳
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
