import { defineConfig } from 'vitest/config'
import path from 'path'

const alias = {
  '@': path.resolve(__dirname, '.'),
}

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          // Pure unit tests: no database, no setup file, fully parallel.
          name: 'unit',
          environment: 'node',
          include: ['tests/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          // Integration tests share one database, so they run one file at a time.
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['tests/helpers/setup-integration.ts'],
          pool: 'forks',
          // Project-scoped equivalent of `fileParallelism: false` (that flag is root-only in
          // Vitest 3): one fork, one file at a time, so no two files touch the DB at once.
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
  },
})
