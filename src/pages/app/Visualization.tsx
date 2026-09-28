import { useState, useEffect, useRef } from 'react'
import { Download, Save, BarChart2, Plus } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, ScatterChart, Scatter,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select, Input } from '@/components/ui/Input'
import { Spinner, EmptyState } from '@/components/ui/Spinner'
import { listDatasets, listPipelines, getChartData, listCharts, saveChart } from '@/lib/api'
import type { Dataset, CleaningPipeline, Chart, ChartType, ChartConfig } from '@/lib/types'
import { CHART_COLORS, truncate } from '@/lib/utils'
import toast from 'react-hot-toast'

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Bar' }, { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' }, { value: 'scatter', label: 'Scatter' },
  { value: 'histogram', label: 'Histogram' }, { value: 'pie', label: 'Pie' },
  { value: 'box', label: 'Box Plot' }, { value: 'heatmap', label: 'Heatmap' },
]

const AGG_OPTS = [
  { value: 'sum', label: 'Sum' }, { value: 'mean', label: 'Mean' },
  { value: 'count', label: 'Count' }, { value: 'min', label: 'Min' }, { value: 'max', label: 'Max' },
]

function ChartPreview({ type, data, config, columns }: { type: ChartType; data: Record<string, unknown>[]; config: ChartConfig; columns: string[] }) {
  if (!data || data.length === 0) return <EmptyState title="No data" description="Configure and build the chart" />
  const xKey = config.x_column || columns[0] || 'x'
  const yKey = config.y_column || columns[1] || 'y'

  const chartProps = {
    data,
    margin: { top: 10, right: 20, left: 0, bottom: 20 },
  }

  const commonAxisStyle = {
    tick: { fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'JetBrains Mono' },
    axisLine: { stroke: 'var(--border)' },
    tickLine: { stroke: 'var(--border)' },
  }

  const tooltipStyle = {
    contentStyle: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: 12 },
    labelStyle: { color: 'var(--foreground)' },
    itemStyle: { color: 'var(--foreground)' },
  }

  const h = 320

  switch (type) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={h}>
          <BarChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={xKey} {...commonAxisStyle} />
            <YAxis {...commonAxisStyle} />
            <Tooltip {...tooltipStyle} />
            {config.show_legend && <Legend />}
            <Bar dataKey={yKey} fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={h}>
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey={xKey} {...commonAxisStyle} />
            <YAxis {...commonAxisStyle} />
            <Tooltip {...tooltipStyle} />
            {config.show_legend && <Legend />}
            <Line dataKey={yKey} stroke={CHART_COLORS[0]} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )
    case 'area':
      return (
        <ResponsiveContainer width="100%" height={h}>
          <AreaChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey={xKey} {...commonAxisStyle} />
            <YAxis {...commonAxisStyle} />
            <Tooltip {...tooltipStyle} />
            <Area dataKey={yKey} stroke={CHART_COLORS[0]} fill={`${CHART_COLORS[0]}33`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      )
    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height={h}>
          <ScatterChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey={xKey} {...commonAxisStyle} name={xKey} />
            <YAxis dataKey={yKey} {...commonAxisStyle} name={yKey} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} {...tooltipStyle} />
            <Scatter data={data} fill={CHART_COLORS[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      )
    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={h}>
          <PieChart>
            <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={120} label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      )
    case 'histogram': {
      const bins = config.bins || 20
      const vals = data.map(d => Number(d[xKey])).filter(v => isFinite(v))
      if (vals.length === 0) return <EmptyState title="No numeric data" description="Select a numeric column" />
      const min = Math.min(...vals), max = Math.max(...vals)
      const binSize = (max - min) / bins
      const histData = Array.from({ length: bins }, (_, i) => {
        const lo = min + i * binSize, hi = lo + binSize
        return { bin: lo.toFixed(1), count: vals.filter(v => v >= lo && v < hi).length }
      })
      return (
        <ResponsiveContainer width="100%" height={h}>
          <BarChart data={histData} margin={chartProps.margin}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="bin" {...commonAxisStyle} />
            <YAxis {...commonAxisStyle} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="count" fill={CHART_COLORS[0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    }
    case 'heatmap': {
      const xVals = [...new Set(data.map(d => String(d[xKey])))]
      const yVals = [...new Set(data.map(d => String(d[config.y_column || columns[1] || 'y'])))]
      return (
        <div className="overflow-auto" style={{ height: h }}>
          <div className="text-xs text-[var(--muted-foreground)] mb-2">Heatmap of {xKey} vs {config.y_column}</div>
          <table className="data-table">
            <thead><tr>
              <th></th>
              {xVals.slice(0, 20).map(v => <th key={v} className="text-[var(--muted-foreground)] px-1 py-0.5">{truncate(v, 8)}</th>)}
            </tr></thead>
            <tbody>
              {yVals.slice(0, 20).map(yv => (
                <tr key={yv}>
                  <td className="text-[var(--muted-foreground)] pr-2">{truncate(yv, 8)}</td>
                  {xVals.slice(0, 20).map(xv => {
                    const val = data.find(d => String(d[xKey]) === xv && String(d[config.y_column || columns[1] || 'y']) === yv)
                    const n = val ? Number(val[config.y_columns?.[0] || 'value']) : 0
                    return <td key={xv} style={{ background: `rgba(59,130,246,${Math.min(Math.abs(n) / 10, 1)})`, width: 32, height: 24 }} className="text-center text-[10px]">{n !== 0 ? n.toFixed(1) : ''}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    default:
      return <EmptyState title="Chart type" description="Select a chart type" />
  }
}

export default function Visualization() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [pipelines, setPipelines] = useState<CleaningPipeline[]>([])
  const [savedCharts, setSavedCharts] = useState<Chart[]>([])
  const [datasetId, setDatasetId] = useState('')
  const [pipelineId, setPipelineId] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [config, setConfig] = useState<ChartConfig>({ show_legend: true, show_grid: true, aggregation: 'sum' })
  const [chartData, setChartData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [chartName, setChartName] = useState('')
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listDatasets().then(ds => {
      const ready = ds.filter(d => d.status === 'ready')
      setDatasets(ready)
      if (ready.length > 0) {
        setDatasetId(ready[0].id)
        setColumns(ready[0].profile?.columns.map(c => c.name) || [])
      }
    }).catch(() => {})
    listCharts().then(setSavedCharts).catch(() => {})
  }, [])

  useEffect(() => {
    if (!datasetId) return
    listPipelines(datasetId).then(setPipelines).catch(() => {})
    const ds = datasets.find(d => d.id === datasetId)
    setColumns(ds?.profile?.columns.map(c => c.name) || [])
    setChartData([])
  }, [datasetId, datasets])

  const buildChart = async () => {
    if (!datasetId || !config.x_column) { toast.error('Select dataset and X column'); return }
    setLoading(true)
    try {
      const res = await getChartData(datasetId, { ...config, chart_type: chartType }, pipelineId || undefined)
      setChartData(res.data)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to get chart data')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!chartName || !datasetId) { toast.error('Enter a chart name'); return }
    try {
      const chart = await saveChart({ name: chartName, dataset_id: datasetId, pipeline_id: pipelineId || undefined, chart_type: chartType, config })
      setSavedCharts(prev => [...prev, chart])
      toast.success('Chart saved')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const handleExportPNG = async () => {
    if (!chartRef.current) return
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(chartRef.current, { backgroundColor: null })
      const link = document.createElement('a')
      link.download = `${chartName || 'chart'}.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch { toast.error('Export failed') }
  }

  const colOpts = [{ value: '', label: 'Select column…' }, ...columns.map(c => ({ value: c, label: c }))]

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold">Visualization</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Build and save interactive charts</p>
        </div>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-4">
        {/* Config panel */}
        <Card className="flex flex-col gap-4 self-start">
          <CardTitle>Chart Config</CardTitle>

          <div className="flex flex-col gap-3">
            <select value={datasetId} onChange={e => setDatasetId(e.target.value)} className="text-sm bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--foreground)] w-full">
              <option value="">Select dataset…</option>
              {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {pipelines.length > 0 && (
              <select value={pipelineId} onChange={e => setPipelineId(e.target.value)} className="text-sm bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--foreground)] w-full">
                <option value="">Raw data</option>
                {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {CHART_TYPES.map(t => (
              <button key={t.value} onClick={() => setChartType(t.value)} className={`py-1.5 px-2 text-xs rounded border transition-colors ${chartType === t.value ? 'border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]' : 'border-[var(--border)] hover:border-[var(--muted-foreground)] text-[var(--muted-foreground)]'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <Select label="X Column" value={config.x_column || ''} onChange={e => setConfig(c => ({ ...c, x_column: e.target.value }))} options={colOpts} />
          <Select label="Y Column" value={config.y_column || ''} onChange={e => setConfig(c => ({ ...c, y_column: e.target.value }))} options={colOpts} />
          <Select label="Group by" value={config.group_by || ''} onChange={e => setConfig(c => ({ ...c, group_by: e.target.value || undefined }))} options={[{ value: '', label: 'None' }, ...columns.map(c => ({ value: c, label: c }))]} />
          <Select label="Aggregation" value={config.aggregation || 'sum'} onChange={e => setConfig(c => ({ ...c, aggregation: e.target.value as ChartConfig['aggregation'] }))} options={AGG_OPTS} />
          <Input label="Chart title" value={config.title || ''} onChange={e => setConfig(c => ({ ...c, title: e.target.value }))} placeholder="Optional title" />

          <Button onClick={buildChart} loading={loading} className="w-full">
            <BarChart2 size={14} /> Build chart
          </Button>

          {chartData.length > 0 && (
            <div className="border-t border-[var(--border)] pt-3 flex flex-col gap-2">
              <Input label="Chart name" value={chartName} onChange={e => setChartName(e.target.value)} placeholder="My chart" />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handleSave} className="flex-1">
                  <Save size={13} /> Save
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPNG}>
                  <Download size={13} /> PNG
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Chart area */}
        <div className="flex flex-col gap-4">
          <Card>
            {config.title && <h3 className="text-sm font-semibold mb-3">{config.title}</h3>}
            <div ref={chartRef}>
              {loading ? (
                <div className="flex justify-center py-16"><Spinner size="lg" /></div>
              ) : (
                <ChartPreview type={chartType} data={chartData} config={config} columns={columns} />
              )}
            </div>
          </Card>

          {savedCharts.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Saved Charts</CardTitle></CardHeader>
              <div className="grid grid-cols-2 gap-2">
                {savedCharts.map(c => (
                  <div key={c.id} className="border border-[var(--border)] rounded p-2.5 text-xs">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-[var(--muted-foreground)]">{c.chart_type}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
