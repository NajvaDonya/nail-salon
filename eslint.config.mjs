// eslint-config-next@16 ships a flat config array (Linter.Config[]) directly, so no FlatCompat.
// `core-web-vitals` already spreads Next's recommended config before adding the vitals rules.
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'prisma/migrations/**',
      'tsconfig.tsbuildinfo',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  ...nextCoreWebVitals,
]

export default config
