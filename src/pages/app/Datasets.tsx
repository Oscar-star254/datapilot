import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Database, Trash2, Edit2, RefreshCw, ChevronRight, BarChart2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, StatCard } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Spinner, EmptyState } from '@/components/ui/Spinner'
import { formatBytes, formatNumber, inferFileType, truncate } from '@/lib/utils'
import { listDatasets, uploadDataset, deleteDataset, renameDataset, getTaskStatus } from '@/lib/api'
import type { Dataset } from '@/lib/types'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

function ProfileModal({ dataset, onClose }: { dataset: Dataset; onClose: () => void }) {
  const profile = dataset.profile
  if (!profile) return null
  return (
    <Modal open title={`Profile: ${dataset.name}`} onClose={onClose} size="xl">
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="Rows" value={formatNumber(profile.row_count, 0)} />
        <StatCard label="Duplicates" value={formatNumber(profile.duplicate_count, 0)} />
        <StatCard label="Missing cells" value={formatNumber(profile.missing_total, 0)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr className="text-left border-b border-[var(--border)]">
              {['Column', 'Type', 'Missing', 'Unique', 'Sample values'].map(h => (
                <th key={h} className="pb-2 pr-4 text-[var(--muted-foreground)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profile.columns.map(col => (
              <tr key={col.name} className="border-b border-[var(--border)] hover:bg-[var(--muted)]">
                <td className="py-2 pr-4 font-mono text-[var(--foreground)] text-xs">{col.name}</td>
                <td className="py-2 pr-4">
                  <Badge variant={col.inferred_type === 'numeric' ? 'accent' : col.inferred_type === 'datetime' ? 'success' : 'default'}>
                    {col.inferred_type}
                  </Badge>
                </td>
                <td className="py-2 pr-4 text-xs">
                  <span className={col.missing_pct > 0.1 ? 'text-[var(--warning)]' : 'text-[var(--muted-foreground)]'}>
                    {(col.missing_pct * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="py-2 pr-4 text-xs text-[var(--muted-foreground)]">{formatNumber(col.unique_count, 0)}</td>
                <td className="py-2 text-xs text-[var(--muted-foreground)] font-mono max-w-[200px] truncate">
                  {col.sample_values.slice(0, 3).map(v => String(v ?? 'null')).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}

export default function Datasets() {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [renaming, setRenaming] = useState<Dataset | null>(null)
  const [newName, setNewName] = useState('')
  const [profiling, setProfiling] = useState<Dataset | null>(null)
  const [pollingId, setPollingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await listDatasets()
      setDatasets(data)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load datasets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Poll task status for uploading datasets
  useEffect(() => {
    if (!pollingId) return
    const interval = setInterval(async () => {
      try {
        const status = await getTaskStatus(pollingId)
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval)
          setPollingId(null)
          setUploading(false)
          if (status.status === 'completed') {
            toast.success('Dataset uploaded and profiled')
            load()
          } else {
            toast.error(status.error || 'Upload failed')
          }
        } else {
          setUploadProgress(status.progress)
        }
      } catch { clearInterval(interval) }
    }, 1500)
    return () => clearInterval(interval)
  }, [pollingId, load])

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0]
    if (!file) return
    if (file.size > 25 * 1024 * 1024) { toast.error('File too large (max 25 MB)'); return }
    const fileType = inferFileType(file.name)
    if (!fileType) { toast.error('Unsupported format. Use CSV, XLSX, or JSON'); return }
    setUploading(true)
    setUploadProgress(0)
    try {
      const { task_id } = await uploadDataset(file, file.name.replace(/\.[^.]+$/, ''))
      setPollingId(task_id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
      setUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/json': ['.json'] },
    multiple: false,
    disabled: uploading,
  })

  const handleDelete = async (ds: Dataset) => {
    if (!confirm(`Delete "${ds.name}"? This cannot be undone.`)) return
    try {
      await deleteDataset(ds.id)
      setDatasets(prev => prev.filter(d => d.id !== ds.id))
      toast.success('Dataset deleted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const handleRename = async () => {
    if (!renaming || !newName.trim()) return
    try {
      const updated = await renameDataset(renaming.id, newName.trim())
      setDatasets(prev => prev.map(d => d.id === updated.id ? updated : d))
      setRenaming(null)
      toast.success('Renamed')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Rename failed')
    }
  }

  const statusBadge = (status: Dataset['status']) => {
    if (status === 'ready') return <Badge variant="success">Ready</Badge>
    if (status === 'profiling') return <Badge variant="warning">Profiling…</Badge>
    if (status === 'uploading') return <Badge variant="warning">Uploading…</Badge>
    return <Badge variant="destructive">Error</Badge>
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold">Datasets</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Upload and manage your data files</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-[var(--radius-lg)] p-8 text-center cursor-pointer transition-colors mb-6 ${
          isDragActive ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]' : 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--muted)]'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-sm text-[var(--muted-foreground)]">Processing… {uploadProgress}%</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-[var(--muted)] rounded-full flex items-center justify-center mb-1">
              <Upload size={18} className="text-[var(--muted-foreground)]" />
            </div>
            <p className="text-sm font-medium">{isDragActive ? 'Drop to upload' : 'Drag & drop or click to upload'}</p>
            <p className="text-xs text-[var(--muted-foreground)]">CSV, XLSX, JSON · Max 25 MB</p>
          </div>
        )}
      </div>

      {/* Dataset list */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : datasets.length === 0 ? (
        <EmptyState
          icon={<Database size={32} />}
          title="No datasets yet"
          description="Upload a CSV, XLSX, or JSON file to get started."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {datasets.map(ds => (
            <Card key={ds.id} className="flex items-center gap-4">
              <div className="w-9 h-9 bg-[var(--muted)] rounded-md flex items-center justify-center shrink-0">
                <Database size={16} className="text-[var(--accent)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{ds.name}</span>
                  {statusBadge(ds.status)}
                </div>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-xs text-[var(--muted-foreground)] font-mono">{ds.file_type.toUpperCase()}</span>
                  <span className="text-xs text-[var(--muted-foreground)] font-mono">{formatBytes(ds.file_size)}</span>
                  {ds.row_count > 0 && <span className="text-xs text-[var(--muted-foreground)] font-mono">{formatNumber(ds.row_count, 0)} rows × {ds.column_count} cols</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {ds.profile && (
                  <Button variant="ghost" size="sm" onClick={() => setProfiling(ds)}>
                    <BarChart2 size={13} /> Profile
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => { setRenaming(ds); setNewName(ds.name) }} title="Rename">
                  <Edit2 size={13} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(ds)} title="Delete">
                  <Trash2 size={13} className="text-[var(--destructive)]" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => navigate(`/app/viewer?dataset=${ds.id}`)} title="Open in viewer">
                  <ChevronRight size={14} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Rename modal */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename dataset" size="sm">
        <div className="flex flex-col gap-4">
          <Input label="Name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename()} autoFocus />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button onClick={handleRename}>Rename</Button>
          </div>
        </div>
      </Modal>

      {/* Profile modal */}
      {profiling && <ProfileModal dataset={profiling} onClose={() => setProfiling(null)} />}
    </div>
  )
}
