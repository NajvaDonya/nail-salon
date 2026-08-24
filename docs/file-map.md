# File Map — Fair Salon (Nail Salon SaaS)

This document maps the repository structure for **Fair Salon** (فیر سالن): a Persian/RTL SaaS platform for nail and beauty salons with online booking, manager dashboards, and a staff portal.

---

## Project Overview

| Item | Detail |
|------|--------|
| **Product** | Multi-tenant salon management + customer booking |
| **Stack** | Next.js 16 (App Router), React 19, TypeScript, Prisma 6, MySQL |
| **UI** | Tailwind CSS 4, shadcn/ui (Radix), Framer Motion |
| **Auth** | JWT cookie (`fair_session`), bcrypt passwords, SMS OTP |
| **Locale** | Persian (RTL), Jalali calendar, Iranian phone format |

---

## Top-Level Files

```
nail-salon-saa-s/
├── app/                    # Next.js App Router (pages + API routes)
├── components/             # React components (feature + UI)
├── contexts/               # React context providers
├── docs/                   # Project documentation (this folder)
├── hooks/                  # Shared React hooks
├── lib/                    # Server/client utilities and business logic
├── prisma/                 # Database schema, migrations, seed
├── public/                 # Static assets
├── styles/                 # Additional global styles
├── .env                    # Environment variables (not committed)
├── components.json         # shadcn/ui configuration
├── next.config.mjs         # Next.js config
├── package.json            # Dependencies and npm scripts
├── postcss.config.mjs      # PostCSS / Tailwind setup
├── tsconfig.json           # TypeScript configuration
└── README.md               # v0 / Next.js getting started
```

---

## `app/` — Pages & API Routes

### Root & Layout

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout: RTL (`fa`), Vazirmatn font, theme, analytics |
| `app/page.tsx` | Marketing landing page (features, CTA to booking) |
| `app/globals.css` | Tailwind theme variables and global styles |

### Public Pages

| Path | File | Purpose |
|------|------|---------|
| `/auth/login` | `app/auth/login/page.tsx` | Phone + password or OTP login |
| `/salon/[slug]/book` | `app/salon/[slug]/book/page.tsx` | Public multi-step booking flow |

### Manager Dashboard

| Path | File | Purpose |
|------|------|---------|
| `/dashboard` | `app/dashboard/page.tsx` | Overview (stats, charts) |
| `/dashboard/appointments` | `app/dashboard/appointments/page.tsx` | Appointment management |
| `/dashboard/staff` | `app/dashboard/staff/page.tsx` | Staff CRUD |
| `/dashboard/services` | `app/dashboard/services/page.tsx` | Service catalog |
| `/dashboard/reviews` | `app/dashboard/reviews/page.tsx` | Customer reviews |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | Salon settings (live API) |
| — | `app/dashboard/layout.tsx` | Dashboard shell + auth guard |
| — | `app/dashboard/settings/dashboard-settings-route.ts` | Settings route helpers |

### Staff Portal

| Path | File | Purpose |
|------|------|---------|
| `/staff` | `app/staff/page.tsx` | Staff home (today's schedule) |
| `/staff/appointments` | `app/staff/appointments/page.tsx` | Staff appointment list |
| — | `app/staff/layout.tsx` | Staff shell + auth guard |

### API Routes — Auth

| Method | Route | File |
|--------|-------|------|
| POST | `/api/auth/login` | `app/api/auth/login/route.ts` |
| POST | `/api/auth/logout` | `app/api/auth/logout/route.ts` |
| GET | `/api/auth/me` | `app/api/auth/me/route.ts` |
| POST | `/api/auth/otp/request` | `app/api/auth/otp/request/route.ts` |
| POST | `/api/auth/otp/verify` | `app/api/auth/otp/verify/route.ts` |

### API Routes — Dashboard (authenticated)

| Method | Route | File |
|--------|-------|------|
| GET | `/api/dashboard/stats` | `app/api/dashboard/stats/route.ts` |
| GET | `/api/dashboard/appointments` | `app/api/dashboard/appointments/route.ts` |
| PATCH | `/api/dashboard/appointments/[id]` | `app/api/dashboard/appointments/[id]/route.ts` |
| GET, POST | `/api/dashboard/staff` | `app/api/dashboard/staff/route.ts` |
| GET, POST | `/api/dashboard/services` | `app/api/dashboard/services/route.ts` |
| GET, POST | `/api/dashboard/reviews` | `app/api/dashboard/reviews/route.ts` |
| GET, PATCH | `/api/dashboard/settings` | `app/api/dashboard/settings/route.ts` |

### API Routes — Public Salon (by slug)

| Method | Route | File |
|--------|-------|------|
| GET | `/api/salons/[slug]/services` | `app/api/salons/[slug]/services/route.ts` |
| GET | `/api/salons/[slug]/staff` | `app/api/salons/[slug]/staff/route.ts` |
| GET | `/api/salons/[slug]/slots` | `app/api/salons/[slug]/slots/route.ts` |
| GET | `/api/salons/[slug]/appointments` | `app/api/salons/[slug]/appointments/route.ts` (POST returns 410 — use checkout) |
| POST | `/api/salons/[slug]/checkout` | `app/api/salons/[slug]/checkout/route.ts` |
| GET | `/api/salons/[slug]/staff/availability` | `app/api/salons/[slug]/staff/availability/route.ts` |
| POST | `/api/customer/appointments/[id]/resume-payment` | `app/api/customer/appointments/[id]/resume-payment/route.ts` |
| POST | `/api/customer/reviews` | `app/api/customer/reviews/route.ts` |

---

## `components/` — UI & Feature Components

### Feature Components

```
components/
├── auth/
│   ├── auth-guard.tsx       # Client-side route protection by role
│   ├── login-form.tsx       # Login / OTP form
│   └── index.ts
├── booking/
│   ├── booking-flow.tsx     # 5-step public booking wizard
│   └── index.ts
├── dashboard/
│   ├── dashboard-layout.tsx # Sidebar nav, header
│   ├── dashboard-overview.tsx
│   └── index.ts
├── staff/
│   ├── staff-layout.tsx     # Staff portal shell
│   └── index.ts
└── theme-provider.tsx       # next-themes wrapper
```

### UI Primitives (`components/ui/`)

shadcn/ui components built on Radix UI. Used across all pages:

| Category | Files |
|----------|-------|
| **Layout** | `card`, `separator`, `scroll-area`, `sidebar`, `sheet`, `drawer`, `resizable` |
| **Forms** | `button`, `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `form`, `field`, `input-otp`, `input-group`, `label`, `calendar` |
| **Feedback** | `alert`, `alert-dialog`, `toast`, `toaster`, `sonner`, `progress`, `spinner`, `skeleton`, `empty` |
| **Navigation** | `tabs`, `breadcrumb`, `navigation-menu`, `menubar`, `dropdown-menu`, `context-menu`, `command`, `pagination` |
| **Display** | `avatar`, `badge`, `table`, `chart`, `carousel`, `accordion`, `collapsible`, `hover-card`, `popover`, `tooltip`, `dialog`, `toggle`, `toggle-group`, `slider`, `kbd`, `item` |
| **Hooks** | `use-mobile.tsx`, `use-toast.ts` |

---

## `lib/` — Core Logic

| File | Responsibility |
|------|----------------|
| `auth.ts` | JWT create/verify, cookie management, `getCurrentUser`, role checks |
| `booking.ts` | Slot calculation, conflict detection, `bookAppointment` |
| `db.ts` | Prisma client singleton (primary DB access) |
| `prisma.ts` | Duplicate Prisma client export |
| `sms.ts` | SMS providers: console (dev), HTTP, Kavenegar |
| `types.ts` | Roles, appointment statuses, permissions, Persian labels |
| `jalali.ts` | Jalali date/time formatting and conversion |
| `utils.ts` | `cn()` classname helper |

---

## `contexts/` & `hooks/`

| Path | Purpose |
|------|---------|
| `contexts/auth-context.tsx` | Client auth state (`AuthProvider`, login/logout) |
| `hooks/use-mobile.ts` | Responsive breakpoint hook |
| `hooks/use-toast.ts` | Toast notification hook |

---

## `prisma/` — Database

| File | Purpose |
|------|---------|
| `schema.prisma` | Data models: Salon, User, StaffProfile, Service, WorkingHours, StaffService |
| `seed.ts` | Demo salon, manager, staff, services, working hours |
| `migrations/` | SQL migration history |

### npm Database Scripts

| Script | Command |
|--------|---------|
| `db:generate` | `prisma generate` |
| `db:push` | `prisma db push` |
| `db:seed` | Seed demo data |
| `db:studio` | Prisma Studio GUI |

---

## `public/` — Static Assets

| File | Purpose |
|------|---------|
| `icon.svg`, `icon-*.png` | App icons |
| `apple-icon.png` | Apple touch icon |
| `placeholder*.jpg/svg/png` | Default images for UI |

---

## Route → Component Flow

```
/                          → app/page.tsx (marketing)
/auth/login                → LoginForm
/salon/[slug]/book         → BookingFlow → salon API routes
/dashboard/*               → DashboardLayout → page components
/staff/*                   → StaffLayout → page components
```

---

## Pages Referenced but Not Yet Implemented

These appear in navigation or auth redirects but have no route files:

- `/dashboard/schedule`
- `/dashboard/analytics`
- `/booking` (customer appointment history — OTP login redirects here)

---

## Known Structural Notes

1. **Schema drift** — API routes and `lib/booking.ts` reference models (`Appointment`, `Review`, `OtpCode`, etc.) not yet defined in `prisma/schema.prisma`.
2. **Mock vs live data** — Most dashboard pages use mock data; settings and public booking are wired to APIs.
3. **Route protection** — `proxy.ts` (Next.js Proxy) protects `/dashboard`, `/staff`, `/account`, and `/auth/login`; layouts also use client-side `AuthGuard`.
4. **Build config** — `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, masking type/schema mismatches.
