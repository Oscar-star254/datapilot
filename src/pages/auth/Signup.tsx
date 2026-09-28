import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LineChart, Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function Signup() {
  const { signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await signUp(email, password)
      setDone(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-[color-mix(in_srgb,var(--success)_15%,transparent)] rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={24} className="text-[var(--success)]" />
          </div>
          <h2 className="text-xl font-display font-bold mb-2">Check your inbox</h2>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">
            We sent a confirmation link to <strong className="text-[var(--foreground)]">{email}</strong>.
            Click it to activate your account.
          </p>
          <Link to="/auth/login" className="text-[var(--primary)] text-sm hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-7 h-7 bg-[var(--primary)] rounded flex items-center justify-center">
            <LineChart size={14} className="text-white" />
          </div>
          <span className="font-display font-bold">DataPilot</span>
        </div>

        <h1 className="text-2xl font-display font-bold mb-1">Create your account</h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-6">Free forever, no credit card required</p>

        <Button variant="secondary" className="w-full mb-4" onClick={signInWithGoogle}>
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-xs text-[var(--muted-foreground)]">or</span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          <Input
            label="Password"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            hint="Must be at least 8 characters"
          />
          <Button type="submit" className="w-full mt-1" loading={loading}>
            Create account
          </Button>
        </form>

        <p className="text-sm text-[var(--muted-foreground)] text-center mt-6">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-[var(--primary)] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
