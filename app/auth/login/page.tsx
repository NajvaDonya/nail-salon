'use client'

import { AuthProvider } from '@/contexts/auth-context'
import { LoginForm } from '@/components/auth'
import { motion } from 'framer-motion'

export default function LoginPage() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-secondary/20 to-background">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md relative z-10"
        >
          <LoginForm redirectTo="/dashboard" />
        </motion.div>
      </div>
    </AuthProvider>
  )
}
