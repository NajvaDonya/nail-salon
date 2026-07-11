# Business Logic — Fair Salon (Nail Salon SaaS)

This document describes the domain model, user roles, core workflows, and business rules for **Fair Salon** (فیر سالن).

---

## What This Product Does

Fair Salon is a **multi-tenant SaaS** for Iranian nail and beauty salons. Each salon is a tenant identified by a unique URL slug (e.g. `/salon/nail-art-studio/book`).

The platform serves three audiences:

| Audience | Primary interface | Goal |
|----------|-------------------|------|
| **Customers** | Public booking page | Book appointments without an account (phone OTP optional) |
| **Salon managers** | `/dashboard` | Run the business: staff, services, appointments, reviews, settings |
| **Staff** | `/staff` | View and update their own appointments |

There is **no payment or subscription billing** module. Revenue is tracked implicitly through appointment prices aggregated in dashboard stats.

---

## Domain Model

### Core Entities (defined in Prisma schema)

```
Salon
  ├── has many User (managers, staff linked via salonId)
  ├── has many Service
  └── identified by unique slug (tenant key)

User
  ├── role: MANAGER | STAFF | CUSTOMER
  ├── belongs to optional Salon (salonId)
  └── may have StaffProfile (bio, specialties)

Service
  ├── belongs to Salon
  ├── duration (minutes), price (IRR), category
  └── can be active/inactive

WorkingHours
  └── per staffId + dayOfWeek: startTime, endTime

StaffService
  └── many-to-many: which staff can perform which services
```

### Entities Expected by Application Code (not yet in schema)

The booking engine and API layer also assume these models exist:

| Entity | Business purpose |
|--------|------------------|
| **Appointment** | Scheduled visit: customer, staff, services, date/time, status, tracking code, total price |
| **AppointmentService** | Line items linking an appointment to one or more services |
| **Review** | Post-appointment rating and comment from customer |
| **OtpCode** | Temporary SMS verification codes |
| **Vacation / StaffVacation** | Salon closure or individual staff time off |
| **WorkingHour** (salon-level) | Default salon opening hours (distinct from per-staff WorkingHours) |

> **Important:** The schema and application code are currently out of sync. See [Schema Drift](#schema-drift) at the end of this document.

---

## User Roles & Permissions

Roles are defined in `lib/types.ts` as `UserRole`:

| Role | Description | Key permissions |
|------|-------------|-----------------|
| `SUPER_ADMIN` | Platform operator | Full access (`*`) |
| `MANAGER` | Salon owner/admin | Full salon management: staff, services, appointments, reviews, settings, analytics |
| `STAFF` | Nail artist / technician | Own appointments, schedule, reviews |
| `CUSTOMER` | End client | Book, view/cancel own appointments, leave reviews |

Permissions are declared in `ROLE_PERMISSIONS` (e.g. `appointment:read`, `staff:create`, `review:reply`) and checked in API handlers via helpers in `lib/auth.ts`.

### Multi-Tenancy Rules

- **Tenant = Salon**, scoped by `salonId` on users and by `slug` in public URLs.
- Managers and staff belong to exactly one salon (`User.salonId`).
- Customers are global users (no salonId); they book at any salon's public page.
- API handlers filter data by the authenticated user's `salonId` or by salon slug for public routes.
- There is no subdomain-based tenancy — isolation is enforced in application code, not database RLS.

---

## Authentication

Two login paths exist at `/auth/login`:

### 1. Password Login (Managers & Staff)

1. User submits Iranian mobile number (`09XXXXXXXXX`) + password.
2. Server verifies bcrypt hash against `User.passwordHash`.
3. JWT issued with `{ userId, phone, role, salonId }`.
4. Token stored in HTTP-only cookie `fair_session` (7-day expiry).
5. Redirect: MANAGER → `/dashboard`, STAFF → `/staff`.

### 2. OTP Login (Customers)

1. User requests OTP → `POST /api/auth/otp/request`.
2. Server generates code, stores in `OtpCode`, sends via SMS (`lib/sms.ts`).
3. Rate limiting prevents abuse.
4. User verifies → `POST /api/auth/otp/verify`.
5. If phone is new, a `CUSTOMER` user is auto-created.
6. JWT cookie set; redirect to `/booking` (not yet implemented).

### Session Management

- `GET /api/auth/me` — returns current user from JWT + DB lookup.
- `POST /api/auth/logout` — clears session cookie.
- Client-side `AuthGuard` wraps dashboard/staff layouts (no Next.js middleware).

---

## Core Business Workflows

### Workflow 1: Customer Online Booking

**Entry:** `/salon/[slug]/book`  
**Component:** `components/booking/booking-flow.tsx`

```
Step 1: Select service(s)
    ↓ GET /api/salons/[slug]/services
Step 2: Select staff member
    ↓ GET /api/salons/[slug]/staff?serviceIds=...
Step 3: Select date (Jalali calendar)
    ↓
Step 4: Select time slot
    ↓ GET /api/salons/[slug]/slots?staffId&date&duration
Step 5: Enter name + phone, confirm
    ↓ POST /api/salons/[slug]/appointments
Confirmation + tracking code + SMS
```

**Business rules:**

- Only **active** services are shown.
- Staff list is filtered to those who can perform the selected service(s) via `StaffService`.
- Slots are computed by the booking engine (see below).
- On submit: find or create customer by phone, create appointment, generate tracking code, send confirmation SMS.

---

### Workflow 2: Smart Slot Calculation

**Module:** `lib/booking.ts`

The booking engine computes available time slots for a given salon, service, staff member, and date.

**Algorithm (simplified):**

1. **Reject if salon or staff is on vacation** for the requested date.
2. **Load working hours** for the staff member on that day of week.
3. **Load service duration** + salon buffer time from settings.
4. **Generate candidate slots** in 30-minute increments within working hours.
5. **Remove slots that overlap** existing appointments with status `PENDING`, `CONFIRMED`, or `IN_PROGRESS`.
6. **Return available slots**; if no staff specified, merge availability across all qualified staff.

**Conflict detection:** Two intervals overlap if `startA < endB && endA > startB`.

---

### Workflow 3: Appointment Lifecycle

Appointment statuses (`lib/types.ts`):

| Status | Persian label | Meaning |
|--------|---------------|---------|
| `PENDING` | در انتظار تایید | Newly booked, awaiting confirmation |
| `CONFIRMED` | تایید شده | Salon confirmed the appointment |
| `IN_PROGRESS` | در حال انجام | Service is being performed |
| `COMPLETED` | انجام شده | Finished successfully |
| `CANCELLED` | لغو شده | Cancelled by customer or salon |
| `NO_SHOW` | عدم مراجعه | Customer did not arrive |

**Typical flow:**

```
PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
              ↓              ↓
          CANCELLED      CANCELLED / NO_SHOW
```

- Managers can update any appointment via `PATCH /api/dashboard/appointments/[id]`.
- Staff can update their own appointments (scoped by staffId).
- Completed appointments may receive a customer review.

---

### Workflow 4: Manager Dashboard Operations

| Area | Operations | API |
|------|------------|-----|
| **Overview** | KPIs: today's appointments, revenue, staff count, avg rating | `GET /api/dashboard/stats` |
| **Appointments** | List, filter, change status | `GET/PATCH /api/dashboard/appointments` |
| **Staff** | Add staff, assign services, set working hours | `GET/POST /api/dashboard/staff` |
| **Services** | CRUD service catalog (name, duration, price, category) | `GET/POST /api/dashboard/services` |
| **Reviews** | View customer feedback, reply | `GET/POST /api/dashboard/reviews` |
| **Settings** | Salon info, hours, booking rules, SMS reminders | `GET/PATCH /api/dashboard/settings` |

> Most dashboard **UI pages currently use mock data**. The settings page and API layer are the most complete integrations.

---

### Workflow 5: Staff Portal

Staff log in with phone + password and land on `/staff`.

| Feature | Purpose |
|---------|---------|
| Today's schedule | Appointments assigned to this staff member |
| Status updates | Mark appointments IN_PROGRESS, COMPLETED, NO_SHOW |
| Stats | Count of today's/completed appointments |

Staff data is scoped to the authenticated user's staff profile. UI currently uses mock data.

---

### Workflow 6: SMS Notifications

**Module:** `lib/sms.ts`

| Event | Template purpose |
|-------|------------------|
| OTP request | Send verification code |
| Appointment created | Confirmation with date, time, tracking code |
| Reminder (planned) | Day-before or hour-before reminder |

**Providers** (configured via env):

- `console` — logs to terminal (development)
- `http` — generic HTTP webhook
- `kavenegar` — Kavenegar SMS API (production, Iran)

Reminder sending is defined in settings but **no cron/scheduler** is implemented yet.

---

### Workflow 7: Reviews

After a completed appointment, customers can leave a rating and comment.

- Managers view and reply to reviews in the dashboard.
- Average rating feeds into staff profiles and dashboard stats.
- Reviews are salon-scoped.

---

## Business Rules Summary

| Rule | Detail |
|------|--------|
| **Phone format** | Iranian mobile: `09XXXXXXXXX` (11 digits) |
| **Currency** | Prices stored as integers (IRR, no decimal) |
| **Calendar** | Jalali (Persian) in UI; stored as Gregorian `Date` in DB |
| **Slot granularity** | 30-minute increments |
| **Service duration** | Drives slot length + end time calculation |
| **Buffer time** | Configurable gap between appointments (from salon settings) |
| **Tracking code** | Unique code generated per appointment for customer reference |
| **Tenant isolation** | All salon data filtered by `salonId` or slug |
| **Active flags** | Services and users can be deactivated without deletion |

---

## Seed Data (Local Development)

Running `npm run db:seed` creates:

| Entity | Value |
|--------|-------|
| Salon | `nail-art-studio` → `/salon/nail-art-studio/book` |
| Manager | Phone `09121111111`, password `manager123` |
| Staff | Phone `09122222222`, password `staff123` |
| Services | 5 nail services (manicure, pedicure, design, gel, lacquer) |
| Working hours | Sat–Thu 09:00–18:00 for staff |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Fair Salon                           │
├──────────────┬──────────────────────┬─────────────────────────┤
│   Customer   │      Manager         │        Staff            │
│  /salon/     │    /dashboard        │       /staff            │
│  [slug]/book │                      │                         │
└──────┬───────┴──────────┬───────────┴──────────┬──────────────┘
       │                  │                        │
       ▼                  ▼                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                       │
│  /api/salons/[slug]/*  │  /api/dashboard/*  │  /api/auth/* │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│ lib/booking │        │  lib/auth   │        │  lib/sms    │
│ Slot engine │        │ JWT + RBAC  │        │ Kavenegar   │
└──────┬──────┘        └──────┬──────┘        └─────────────┘
       │                      │
       └──────────┬───────────┘
                  ▼
         ┌─────────────────┐
         │  Prisma + MySQL │
         │  (Salon tenant) │
         └─────────────────┘
```

---

## Schema Drift

The application is **ahead of the database schema**. Code references models and fields that do not exist in `prisma/schema.prisma`:

| Gap | Impact |
|-----|--------|
| No `Appointment` model | Booking and dashboard appointment APIs cannot persist data |
| No `Review`, `OtpCode` models | Reviews and OTP auth cannot work end-to-end |
| No `Vacation` models | Vacation blocking in slot engine will fail |
| API uses `prisma.staff` vs schema's `StaffProfile` | Staff API mismatch |
| Some routes expect `Salon.ownerId` | Manager–salon ownership link missing |
| OTP creates users without required `name`/`passwordHash` | Customer auto-registration will fail validation |

`next.config.mjs` sets `typescript.ignoreBuildErrors: true`, which hides these mismatches at build time. Aligning the Prisma schema with the API layer is the highest-priority technical task for a functional deployment.

---

## What's Not Built Yet

- Customer appointment history (`/booking`)
- Dashboard schedule and analytics pages
- Payment processing or invoicing
- SaaS subscription billing for salon tenants
- SMS reminder cron/scheduler
- Next.js middleware for server-side route protection
- Full wiring of dashboard UI to live APIs (most pages use mock data)
