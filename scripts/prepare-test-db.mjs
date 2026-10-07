/**
 * Creates nail_salon_test / nail_salon_e2e (if missing) and runs prisma migrate deploy.
 * Reads DATABASE_URL from .env.test; optional second arg overrides database name.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = resolve(root, '.env.test')

function parseEnv(contents) {
  const vars = {}
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i === -1) continue
    const key = trimmed.slice(0, i).trim()
    let value = trimmed.slice(i + 1).trim()
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

const env = parseEnv(readFileSync(envPath, 'utf8'))
const baseUrl = env.DATABASE_URL
if (!baseUrl?.startsWith('mysql://')) {
  console.error('Set mysql:// DATABASE_URL in .env.test first.')
  process.exit(1)
}

const databases = ['nail_salon_test', 'nail_salon_e2e']

function urlForDb(name) {
  return baseUrl.replace(/\/[^/?]+(\?|$)/, `/${name}$1`)
}

function mysqlAdminUrl() {
  return baseUrl.replace(/\/[^/?]+(\?|$)/, '/mysql$1')
}

for (const db of databases) {
  try {
    execSync(`npx prisma db execute --stdin --url "${mysqlAdminUrl()}"`, {
      cwd: root,
      stdio: ['pipe', 'inherit', 'inherit'],
      input: `CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    })
  } catch {
    console.warn(`Could not CREATE DATABASE ${db} via prisma db execute — ensure it exists manually.`)
  }

  execSync('npx prisma migrate deploy', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: urlForDb(db) },
  })
  console.log(`Migrations applied to ${db}`)

  if (db.endsWith('_e2e')) {
    execSync('npx tsx prisma/seed.ts', {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: urlForDb(db) },
    })
    console.log(`Seeded ${db} for E2E`)
  }
}
