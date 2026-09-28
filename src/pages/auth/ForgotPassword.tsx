import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, ArrowLeft, Check } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
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

        {sent ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-[color-mix(in_srgb,var(--success)_15%,transparent)] rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-[var(--success)]" />
            </div>
            <h2 className="text-xl font-display font-bold mb-2">Email sent</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-6">
              We sent a password reset link to <strong className="text-[var(--foreground)]">{email}</strong>.
            </p>
            <Link to="/auth/login" className="inline-flex items-center gap-1 text-[var(--primary)] text-sm hover:underline">
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-display font-bold mb-1">Reset password</h1>
            <p className="text-sm text-[var(--muted-foreground)] mb-6">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input label="Email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
              <Button type="submit" className="w-full" loading={loading}>
                Send reset link
              </Button>
            </form>
            <div className="mt-6 text-center">
              <Link to="/auth/login" className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
