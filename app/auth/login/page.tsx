import { getPrimarySalonName } from '@/lib/salon'
import { LoginScreen } from './login-screen'

export default async function LoginPage() {
  const salonName = await getPrimarySalonName()
  return <LoginScreen salonName={salonName} />
}
