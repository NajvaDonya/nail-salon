import { assertMySqlTestDatabase, loadTestEnv } from './env'

// Runs before every integration test file is imported, so DATABASE_URL is in place
// by the time a test pulls in the Prisma client.
loadTestEnv()
assertMySqlTestDatabase()

// Mock next/headers once for every integration file (real JWT + DB auth checks).
import './auth'
