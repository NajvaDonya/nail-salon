import { loadTestEnv } from './env'

// Side-effect module: import it before anything that reads DATABASE_URL / JWT_SECRET.
loadTestEnv()
