# Testing and database policy

## Neon و MySQL

**Neon فقط PostgreSQL است** — سرویس MySQL روی Neon وجود ندارد. اگر حتماً می‌خواهید از Neon استفاده کنید، باید **کل پروژه** (Prisma `provider`، همه migrationهای MySQL، قفل `FOR UPDATE`) به PostgreSQL مهاجرت کند؛ این کار جدا از «ساخت دیتابیس تست» است.

برای تست همین کد فعلی:

| هدف | راه |
|-----|-----|
| MySQL مثل production | Docker زیر، یا MySQL محلی / PlanetScale / Railway MySQL |
| فقط Neon | مهاجرت کامل به Postgres — بعد `DATABASE_URL` از کنسول Neon |

## MySQL only (Neon is not supported for tests)

This app uses **Prisma with `provider = "mysql"`** and hand-written **MySQL migrations** under `prisma/migrations/`. Booking concurrency relies on MySQL row locks (`SELECT ... FOR UPDATE` in `lib/appointment-conflict.ts`).

**Neon** provides **PostgreSQL**. You cannot run `prisma migrate deploy` from this repo against Neon without migrating the entire application to PostgreSQL (schema, migrations, and locking behavior).

Do **not** point integration or e2e tests at:

- `postgres://` or `postgresql://` URLs
- Neon connection strings (`*.neon.tech`)

Use a **dedicated MySQL database** whose name ends with `_test` or `_e2e`, for example `nail_salon_test` (integration) or `nail_salon_e2e` (Playwright).

## Local test setup

### Docker MySQL (پیشنهادی)

```bash
docker compose -f docker-compose.test.yml up -d
cp .env.test.example .env.test
npm run db:test:prepare
npm run test:integration
```

پورت **3307** روی host به MySQL داخل کانتینر وصل است؛ رمز root در compose: `test_root_password`.

### MySQL دستی

1. Create an empty MySQL database, e.g. `CREATE DATABASE nail_salon_test;`
2. Copy `.env.example` to `.env.test` and set:

   ```env
   DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3306/nail_salon_test"
   JWT_SECRET="test-jwt-secret-at-least-32-characters-long-for-tests"
   SMS_PROVIDER="console"
   MOCK_OTP="true"
   CRON_SECRET="test-cron-secret"
   NEXT_PUBLIC_APP_URL="http://localhost:3100"
   ```

3. Apply migrations to the test database only:

   ```bash
   npm run db:test:prepare
   ```

   Or manually: `set DATABASE_URL=mysql://.../nail_salon_test` then `npx prisma migrate deploy`.

4. Run tests:

   ```bash
   npm run test:unit          # no database
   npm run test:integration   # API + Prisma against nail_salon_test
   npm run test:e2e           # Playwright (uses .env.test for the dev server)
   npm run test:all           # unit + integration
   ```

Integration suites live under `tests/integration/` (stages 3–16). UI/responsive specs are under `e2e/` (stages 17–18).

`tests/helpers/env.ts` enforces `mysql://` and a `_test` database name before integration tests run.

## Production vs test

- **Production / dev app**: your normal `DATABASE_URL` (e.g. `.env`) — never run integration tests against this URL.
- **Tests**: `.env.test` only. The suite truncates tables between cases.

## If you need Neon in production

That requires a **full PostgreSQL migration** (new baseline migrations, enum and lock review), not a test-only Neon URL while the app stays on MySQL.
