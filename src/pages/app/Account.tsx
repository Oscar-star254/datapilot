import { useState, useEffect } from 'react'
import { User, HardDrive, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, StatCard } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/contexts/AuthContext'
import { getStorageUsage, deleteAccount } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

export default function Account() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [usage, setUsage] = useState<{ used_bytes: number; file_count: number; limit_bytes: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteModal, setDeleteModal] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    getStorageUsage().then(setUsage).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const handleDeleteAccount = async () => {
    if (confirm !== 'DELETE') { toast.error('Type DELETE to confirm'); return }
    setDeleting(true)
    try {
      await deleteAccount()
      await signOut()
      navigate('/auth/login')
      toast.success('Account deleted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
      setDeleting(false)
    }
  }

  const usedPct = usage ? (usage.used_bytes / usage.limit_bytes) * 100 : 0

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-display font-bold">Account</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Manage your account and data</p>
      </div>

      {/* Profile */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] rounded-full flex items-center justify-center text-white font-bold text-lg">
            {user?.email?.[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{user?.email}</p>
            <p className="text-xs text-[var(--muted-foreground)] font-mono">ID: {user?.id}</p>
            <p className="text-xs text-[var(--muted-foreground)]">Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</p>
          </div>
        </div>
      </Card>

      {/* Storage usage */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Storage Usage</CardTitle>
        </CardHeader>
        {loading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : usage ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Used" value={formatBytes(usage.used_bytes)} icon={<HardDrive size={16} />} />
              <StatCard label="Files" value={usage.file_count} />
              <StatCard label="Limit" value={formatBytes(usage.limit_bytes)} />
            </div>
            <div>
              <div className="flex justify-between text-xs text-[var(--muted-foreground)] mb-1">
                <span>Storage used</span>
                <span>{usedPct.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(usedPct, 100)}%`,
                    background: usedPct > 80 ? 'var(--destructive)' : usedPct > 60 ? 'var(--warning)' : 'var(--primary)',
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">Unable to load usage data</p>
        )}
      </Card>

      {/* Danger zone */}
      <Card className="border-[var(--destructive)]">
        <CardHeader>
          <CardTitle className="text-[var(--destructive)]">Danger Zone</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">Permanently delete your account, all datasets, pipelines, and dashboards. This cannot be undone.</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setDeleteModal(true)}>
            <Trash2 size={13} /> Delete account
          </Button>
        </div>
      </Card>

      <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Delete Account" size="sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 p-3 bg-[color-mix(in_srgb,var(--destructive)_10%,transparent)] border border-[color-mix(in_srgb,var(--destructive)_20%,transparent)] rounded">
            <AlertTriangle size={15} className="text-[var(--destructive)] shrink-0 mt-0.5" />
            <p className="text-sm">This will permanently delete all your data including datasets, pipelines, charts, and dashboards. This action cannot be reversed.</p>
          </div>
          <Input
            label='Type "DELETE" to confirm'
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="DELETE"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setDeleteModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteAccount} loading={deleting} disabled={confirm !== 'DELETE'}>
              Delete my account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
