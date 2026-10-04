import { describe, it, expect } from 'vitest'
import { assertMySqlTestDatabase } from './helpers/env'

describe('test database policy', () => {
  it('rejects PostgreSQL / Neon-style URLs', () => {
    expect(() =>
      assertMySqlTestDatabase('postgresql://user:pass@ep-cool-name.us-east-2.aws.neon.tech/neondb')
    ).toThrow(/PostgreSQL|Neon|mysql/i)

    expect(() =>
      assertMySqlTestDatabase('postgres://user:pass@localhost:5432/nail_salon_test')
    ).toThrow(/PostgreSQL|mysql/i)
  })

  it('rejects MySQL URLs that target non-test databases', () => {
    expect(() =>
      assertMySqlTestDatabase('mysql://root:pass@127.0.0.1:3306/nail_salon')
    ).toThrow(/_test/)
  })

  it('accepts dedicated MySQL test or e2e database URLs', () => {
    expect(() =>
      assertMySqlTestDatabase('mysql://root:pass@127.0.0.1:3306/nail_salon_test')
    ).not.toThrow()
    expect(() =>
      assertMySqlTestDatabase('mysql://root:pass@127.0.0.1:3306/nail_salon_e2e')
    ).not.toThrow()
  })
})
