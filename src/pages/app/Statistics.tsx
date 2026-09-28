import { useState, useEffect } from 'react'
import { BarChart2, FlaskConical, TrendingUp, RefreshCw, Info } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter } from 'recharts'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Spinner, EmptyState } from '@/components/ui/Spinner'
import { listDatasets, listPipelines, getDescriptiveStats, getCorrelation, runRegression, runHypothesisTest } from '@/lib/api'
import type { Dataset, CleaningPipeline } from '@/lib/types'
import { formatNumber, CHART_COLORS } from '@/lib/utils'
import toast from 'react-hot-toast'

const TABS = ['Descriptive', 'Correlation', 'Regression', 'Hypothesis Tests'] as const
type Tab = typeof TABS[number]

function pValueBadge(p: number) {
  if (p < 0.001) return <Badge variant="success">p &lt; 0.001 ***</Badge>
  if (p < 0.01) return <Badge variant="success">p &lt; 0.01 **</Badge>
  if (p < 0.05) return <Badge variant="success">p &lt; 0.05 *</Badge>
  return <Badge variant="warning">p = {p.toFixed(3)} (not sig.)</Badge>
}

export default function Statistics() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [pipelines, setPipelines] = useState<CleaningPipeline[]>([])
  const [datasetId, setDatasetId] = useState('')
  const [pipelineId, setPipelineId] = useState('')
  const [tab, setTab] = useState<Tab>('Descriptive')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [numCols, setNumCols] = useState<string[]>([])

  // Regression params
  const [targetCol, setTargetCol] = useState('')
  const [featureCols, setFeatureCols] = useState<string[]>([])
  const [regrType, setRegrType] = useState<'linear' | 'multiple' | 'polynomial'>('linear')
  const [corrMethod, setCorrMethod] = useState<'pearson' | 'spearman'>('pearson')

  // Hypothesis params
  const [testType, setTestType] = useState('ttest_ind')
  const [col1, setCol1] = useState('')
  const [col2, setCol2] = useState('')

  useEffect(() => {
    listDatasets().then(ds => {
      const ready = ds.filter(d => d.status === 'ready')
      setDatasets(ready)
      if (ready.length > 0) {
        setDatasetId(ready[0].id)
        const nc = ready[0].profile?.columns.filter(c => c.inferred_type === 'numeric').map(c => c.name) || []
        setNumCols(nc)
        setColumns(ready[0].profile?.columns.map(c => c.name) || [])
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!datasetId) return
    listPipelines(datasetId).then(setPipelines).catch(() => {})
    const ds = datasets.find(d => d.id === datasetId)
    const nc = ds?.profile?.columns.filter(c => c.inferred_type === 'numeric').map(c => c.name) || []
    setNumCols(nc)
    setColumns(ds?.profile?.columns.map(c => c.name) || [])
    setResult(null)
  }, [datasetId, datasets])

  const runAnalysis = async () => {
    if (!datasetId) { toast.error('Select a dataset'); return }
    setLoading(true)
    setResult(null)
    try {
      let res
      if (tab === 'Descriptive') {
        res = await getDescriptiveStats(datasetId, pipelineId || undefined)
      } else if (tab === 'Correlation') {
        res = await getCorrelation(datasetId, corrMethod, pipelineId || undefined)
      } else if (tab === 'Regression') {
        if (!targetCol) { toast.error('Select a target column'); setLoading(false); return }
        res = await runRegression(datasetId, {
          target: targetCol, features: featureCols.length > 0 ? featureCols : numCols.filter(c => c !== targetCol),
          type: regrType, pipeline_id: pipelineId || undefined,
        })
      } else {
        if (!col1) { toast.error('Select at least one column'); setLoading(false); return }
        res = await runHypothesisTest(datasetId, { test: testType, col1, col2: col2 || undefined, pipeline_id: pipelineId || undefined })
      }
      setResult(res.result as Record<string, unknown>)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const renderDescriptive = () => {
    if (!result?.stats) return null
    const stats = result.stats as Record<string, Record<string, number>>
    const cols = Object.keys(stats)
    const metrics = ['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max']
    return (
      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-2 pr-4 text-left text-[var(--muted-foreground)]">Metric</th>
              {cols.map(c => <th key={c} className="pb-2 pr-4 text-right text-[var(--muted-foreground)] truncate max-w-[120px]">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {metrics.map(m => (
              <tr key={m} className="border-b border-[var(--border)] hover:bg-[var(--muted)]">
                <td className="py-1.5 pr-4 font-mono text-xs text-[var(--accent)]">{m}</td>
                {cols.map(c => (
                  <td key={c} className="py-1.5 pr-4 text-right tabular-nums text-xs">
                    {stats[c][m] !== undefined ? formatNumber(stats[c][m]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderCorrelation = () => {
    if (!result?.matrix) return null
    const matrix = result.matrix as Record<string, Record<string, number>>
    const cols = Object.keys(matrix)
    return (
      <div className="overflow-x-auto">
        <table className="w-full data-table">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-2 pr-3 text-left text-[var(--muted-foreground)]"></th>
              {cols.map(c => <th key={c} className="pb-2 pr-3 text-right text-[var(--muted-foreground)] text-[10px] truncate max-w-[80px]">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {cols.map(row => (
              <tr key={row} className="border-b border-[var(--border)]">
                <td className="py-1.5 pr-3 font-mono text-[10px] text-[var(--accent)] whitespace-nowrap">{row}</td>
                {cols.map(col => {
                  const v = matrix[row][col]
                  const abs = Math.abs(v)
                  const bg = v > 0
                    ? `color-mix(in srgb, #3b82f6 ${Math.round(abs * 60)}%, transparent)`
                    : `color-mix(in srgb, #ef4444 ${Math.round(abs * 60)}%, transparent)`
                  return (
                    <td key={col} className="py-1.5 pr-3 text-right tabular-nums text-[11px]" style={{ background: row !== col ? bg : undefined, color: abs > 0.5 ? 'white' : 'inherit' }}>
                      {formatNumber(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderRegression = () => {
    if (!result) return null
    const { r_squared, adj_r_squared, p_value, coefficients, intercept, feature_names, residuals_sample } = result as Record<string, unknown>
    const coefs = (coefficients as number[] | undefined) || []
    const names = (feature_names as string[] | undefined) || []
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[var(--muted)] rounded p-3">
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">R²</p>
            <p className="text-xl font-bold tabular-nums">{formatNumber(r_squared as number)}</p>
          </div>
          <div className="bg-[var(--muted)] rounded p-3">
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">Adj. R²</p>
            <p className="text-xl font-bold tabular-nums">{formatNumber(adj_r_squared as number)}</p>
          </div>
          <div className="bg-[var(--muted)] rounded p-3 flex flex-col justify-between">
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">Model p-value</p>
            <div className="mt-1">{pValueBadge(p_value as number)}</div>
          </div>
        </div>
        <table className="w-full data-table">
          <thead><tr className="border-b border-[var(--border)]">
            <th className="pb-2 pr-4 text-left text-[var(--muted-foreground)]">Feature</th>
            <th className="pb-2 pr-4 text-right text-[var(--muted-foreground)]">Coefficient</th>
          </tr></thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="py-1.5 pr-4 font-mono text-xs text-[var(--muted-foreground)]">intercept</td>
              <td className="py-1.5 pr-4 text-right tabular-nums text-xs">{formatNumber(intercept as number)}</td>
            </tr>
            {names.map((name, i) => (
              <tr key={name} className="border-b border-[var(--border)] hover:bg-[var(--muted)]">
                <td className="py-1.5 pr-4 font-mono text-xs">{name}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums text-xs">{formatNumber(coefs[i])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderHypothesis = () => {
    if (!result) return null
    const { test_name, statistic, p_value, interpretation, df, equal_var } = result as Record<string, unknown>
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--muted)] rounded p-3">
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">Test statistic</p>
            <p className="text-xl font-bold tabular-nums">{formatNumber(statistic as number)}</p>
          </div>
          <div className="bg-[var(--muted)] rounded p-3 flex flex-col justify-between">
            <p className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wide">p-value</p>
            <div className="mt-1">{pValueBadge(p_value as number)}</div>
          </div>
        </div>
        {df !== undefined && <p className="text-xs text-[var(--muted-foreground)] font-mono">Degrees of freedom: {formatNumber(df as number, 1)}</p>}
        <div className="bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] rounded p-3">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-[var(--accent)] shrink-0 mt-0.5" />
            <p className="text-sm">{interpretation as string}</p>
          </div>
        </div>
      </div>
    )
  }

  const colOpts = [{ value: '', label: 'Select column…' }, ...numCols.map(c => ({ value: c, label: c }))]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold">Statistics</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Descriptive stats, correlation, regression, and hypothesis tests</p>
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-5">
        {TABS.map(t => (
          <button key={t} onClick={() => { setTab(t); setResult(null) }} className={`px-4 py-2 text-sm transition-colors ${tab === t ? 'text-[var(--primary)] border-b-2 border-[var(--primary)] font-medium' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Tab-specific params */}
      <Card className="mb-4">
        <div className="flex items-end gap-3 flex-wrap">
          {tab === 'Correlation' && (
            <Select label="Method" value={corrMethod} onChange={e => setCorrMethod(e.target.value as 'pearson' | 'spearman')} options={[
              { value: 'pearson', label: 'Pearson' }, { value: 'spearman', label: 'Spearman' },
            ]} />
          )}
          {tab === 'Regression' && (
            <>
              <Select label="Type" value={regrType} onChange={e => setRegrType(e.target.value as typeof regrType)} options={[
                { value: 'linear', label: 'Simple Linear' }, { value: 'multiple', label: 'Multiple' }, { value: 'polynomial', label: 'Polynomial' },
              ]} />
              <Select label="Target (Y)" value={targetCol} onChange={e => setTargetCol(e.target.value)} options={colOpts} />
              <p className="text-xs text-[var(--muted-foreground)] self-end pb-2">All other numeric columns used as features</p>
            </>
          )}
          {tab === 'Hypothesis Tests' && (
            <>
              <Select label="Test" value={testType} onChange={e => setTestType(e.target.value)} options={[
                { value: 'ttest_ind', label: 'Independent t-test' },
                { value: 'ttest_1samp', label: 'One-sample t-test' },
                { value: 'chi2', label: 'Chi-square' },
                { value: 'anova', label: 'ANOVA' },
                { value: 'shapiro', label: 'Shapiro-Wilk (normality)' },
              ]} />
              <Select label="Column 1" value={col1} onChange={e => setCol1(e.target.value)} options={colOpts} />
              {['ttest_ind', 'chi2'].includes(testType) && (
                <Select label="Column 2" value={col2} onChange={e => setCol2(e.target.value)} options={colOpts} />
              )}
            </>
          )}
          <Button onClick={runAnalysis} loading={loading} className="self-end">
            Run analysis
          </Button>
        </div>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : result ? (
        <Card>
          <CardHeader>
            <CardTitle>{tab} Results</CardTitle>
          </CardHeader>
          {tab === 'Descriptive' && renderDescriptive()}
          {tab === 'Correlation' && renderCorrelation()}
          {tab === 'Regression' && renderRegression()}
          {tab === 'Hypothesis Tests' && renderHypothesis()}
        </Card>
      ) : (
        <EmptyState icon={<FlaskConical size={32} />} title="Run an analysis" description="Configure the parameters above and click Run analysis" />
      )}
    </div>
  )
}
