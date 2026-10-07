/**
 * Seeds nail_salon_e2e (or DATABASE_URL target) for Playwright: salon, payment settings, manager staff bookable.
 */
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

if (!process.env.DATABASE_URL?.includes('_e2e') && !process.env.ALLOW_E2E_SEED_ANY_DB) {
  console.error(
    'Refusing to seed: DATABASE_URL must point to a *_e2e database (e.g. nail_salon_e2e). ' +
      'Set ALLOW_E2E_SEED_ANY_DB=1 to override.'
  )
  process.exit(1)
}

execSync('npx tsx prisma/seed.ts', {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

console.log('E2E seed completed (via prisma/seed.ts on', process.env.DATABASE_URL, ')')
