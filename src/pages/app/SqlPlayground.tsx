import { useState, useEffect, useRef } from 'react'
import { Play, AlertCircle, Clock, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner, EmptyState } from '@/components/ui/Spinner'
import { listDatasets, listPipelines, runQuery } from '@/lib/api'
import type { Dataset, CleaningPipeline } from '@/lib/types'
import { formatNumber } from '@/lib/utils'
import toast from 'react-hot-toast'

const EXAMPLE_QUERIES = [
  'SELECT * FROM data LIMIT 10',
  'SELECT COUNT(*) as count FROM data',
  'SELECT column1, AVG(column2) as avg_val FROM data GROUP BY column1 ORDER BY avg_val DESC LIMIT 20',
  'SELECT * FROM data WHERE column1 IS NOT NULL ORDER BY column2 DESC LIMIT 50',
]

export default function SqlPlayground() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [pipelines, setPipelines] = useState<CleaningPipeline[]>([])
  const [datasetId, setDatasetId] = useState('')
  const [pipelineId, setPipelineId] = useState('')
  const [sql, setSql] = useState('SELECT * FROM data LIMIT 100')
  const [result, setResult] = useState<{ columns: string[]; rows: unknown[][]; row_count: number; duration_ms: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    listDatasets().then(ds => {
      const ready = ds.filter(d => d.status === 'ready')
      setDatasets(ready)
      if (ready.length > 0) setDatasetId(ready[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!datasetId) return
    listPipelines(datasetId).then(setPipelines).catch(() => {})
  }, [datasetId])

  const handleRun = async () => {
    if (!datasetId) { toast.error('Select a dataset'); return }
    if (!sql.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const r = await runQuery(datasetId, sql, pipelineId || undefined)
      setResult(r)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Query failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleRun()
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold">SQL Playground</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Query your data with DuckDB SQL (read-only, 10s timeout). Table name: <code className="font-mono text-[var(--accent)] text-xs">data</code></p>
        </div>
        <div className="flex gap-2">
          <select value={datasetId} onChange={e => setDatasetId(e.target.value)} className="text-sm bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--foreground)]">
            <option value="">Select dataset…</option>
            {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {pipelines.length > 0 && (
            <select value={pipelineId} onChange={e => setPipelineId(e.target.value)} className="text-sm bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--foreground)]">
              <option value="">Raw data</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Editor */}
      <Card className="mb-3 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--muted)]">
          <span className="text-xs font-mono text-[var(--muted-foreground)]">SQL Editor · Ctrl+Enter to run</span>
          <Button size="sm" onClick={handleRun} loading={loading}>
            <Play size={13} /> Run
          </Button>
        </div>
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={e => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full p-4 bg-transparent font-mono text-sm text-[var(--foreground)] resize-none focus:outline-none"
          rows={8}
          placeholder="SELECT * FROM data LIMIT 100"
          spellCheck={false}
        />
      </Card>

      {/* Example queries */}
      <div className="flex gap-2 flex-wrap mb-4">
        <span className="text-xs text-[var(--muted-foreground)] self-center">Examples:</span>
        {EXAMPLE_QUERIES.map((q, i) => (
          <button key={i} onClick={() => setSql(q)} className="text-xs font-mono bg-[var(--muted)] hover:bg-[var(--secondary)] px-2 py-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors truncate max-w-[200px]">
            {q}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : error ? (
        <Card className="border-[var(--destructive)]">
          <div className="flex items-start gap-2">
            <AlertCircle size={15} className="text-[var(--destructive)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[var(--destructive)]">Query error</p>
              <pre className="text-xs font-mono mt-1 text-[var(--muted-foreground)] whitespace-pre-wrap">{error}</pre>
            </div>
          </div>
        </Card>
      ) : result ? (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-[var(--muted)] border-b border-[var(--border)]">
            <span className="text-xs font-mono text-[var(--muted-foreground)]">
              {formatNumber(result.row_count, 0)} rows returned
            </span>
            <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] font-mono">
              <Clock size={11} /> {result.duration_ms}ms
            </div>
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full data-table">
              <thead className="sticky top-0 bg-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  {result.columns.map(c => (
                    <th key={c} className="px-3 py-2 text-left text-[var(--muted-foreground)] whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--muted)]">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-1.5 whitespace-nowrap text-xs">
                        {cell === null ? <span className="text-[var(--muted-foreground)] italic">null</span> : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState icon={<Table2 size={32} />} title="No results yet" description="Write a SQL query and press Run (Ctrl+Enter)" />
      )}
    </div>
  )
}
