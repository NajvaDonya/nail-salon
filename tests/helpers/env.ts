import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const helpersDir = dirname(fileURLToPath(import.meta.url))

/** Repo root is two levels up from tests/helpers. */
export const ENV_TEST_FILE = resolve(helpersDir, '..', '..', '.env.test')

export function parseEnvFile(contents: string): Record<string, string> {
  const vars: Record<string, string> = {}

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    if (!key) continue

    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    vars[key] = value
  }

  return vars
}

/**
 * Loads .env.test into process.env without overwriting anything the caller already set,
 * so CI can override DATABASE_URL on the command line.
 */
export function loadTestEnv(): Record<string, string> {
  let contents: string
  try {
    contents = readFileSync(ENV_TEST_FILE, 'utf8')
  } catch {
    throw new Error(
      `Missing test environment file at ${ENV_TEST_FILE}. ` +
        'Create it with DATABASE_URL, JWT_SECRET, SMS_PROVIDER, MOCK_OTP, CRON_SECRET and ' +
        'NEXT_PUBLIC_APP_URL before running integration or e2e tests.'
    )
  }

  const vars = parseEnvFile(contents)
  for (const [key, value] of Object.entries(vars)) {
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }

  return vars
}

const POSTGRES_PROTOCOLS = ['postgres:', 'postgresql:']
const NEON_HOST_PATTERN = /neon\.tech/i

/**
 * Integration and e2e tests must hit the same engine as production (MySQL).
 * Neon is PostgreSQL-only; pointing tests at Neon would not exercise real migrations or locking.
 */
export function assertMySqlTestDatabase(databaseUrl = process.env.DATABASE_URL): void {
  if (!databaseUrl?.trim()) {
    throw new Error(
      'DATABASE_URL is missing. Copy .env.example to .env.test with a mysql:// URL for nail_salon_test. ' +
        'See docs/testing.md.'
    )
  }

  const trimmed = databaseUrl.trim()
  const lower = trimmed.toLowerCase()

  if (POSTGRES_PROTOCOLS.some((protocol) => lower.startsWith(protocol))) {
    throw new Error(
      'PostgreSQL / Neon cannot be used for tests in this repo: Prisma provider is mysql and migrations are MySQL DDL. ' +
        'Use mysql://USER:PASSWORD@HOST:PORT/nail_salon_test instead. See docs/testing.md.'
    )
  }

  if (NEON_HOST_PATTERN.test(trimmed)) {
    throw new Error(
      'Neon hosts serve PostgreSQL only. Use a dedicated MySQL database for tests (e.g. nail_salon_test). ' +
        'See docs/testing.md.'
    )
  }

  if (!lower.startsWith('mysql://')) {
    throw new Error(
      `Test DATABASE_URL must use mysql:// (got "${trimmed.split(':')[0]}:"). See docs/testing.md.`
    )
  }

  const pathMatch = trimmed.match(/\/([^/?]+)(?:\?|$)/)
  const databaseName = pathMatch?.[1] ?? ''
  const isDedicatedTestDb = /_(test|e2e)$/i.test(databaseName)
  if (!isDedicatedTestDb) {
    throw new Error(
      `Refusing to run tests against database "${databaseName}". ` +
        'Use a dedicated MySQL schema whose name ends with _test or _e2e (e.g. nail_salon_test).'
    )
  }
}
