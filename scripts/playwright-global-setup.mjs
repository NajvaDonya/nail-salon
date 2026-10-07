import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export default async function globalSetup() {
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

  try {
    const fileEnv = parseEnv(readFileSync(envPath, 'utf8'))
    for (const [k, v] of Object.entries(fileEnv)) {
      process.env[k] ??= v
    }
  } catch {
    console.warn('playwright-global-setup: .env.test missing, using process.env only')
  }

  const dbUrl = process.env.DATABASE_URL ?? ''
  if (!/_e2e$/i.test(dbUrl.split('/').pop()?.split('?')[0] ?? '')) {
    process.env.DATABASE_URL = dbUrl.replace(/\/([^/?]+)(\?|$)/, '/nail_salon_e2e$2')
  }

  execSync('npx prisma db push --skip-generate', {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  execSync('npx tsx prisma/seed.ts', {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
}
