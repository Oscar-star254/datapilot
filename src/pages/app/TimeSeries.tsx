import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select, Input } from '@/components/ui/Input'
import { Spinner, EmptyState } from '@/components/ui/Spinner'
import { listDatasets, listPipelines, getChartData } from '@/lib/api'
import type { Dataset, CleaningPipeline } from '@/lib/types'
import { CHART_COLORS, formatNumber } from '@/lib/utils'
import toast from 'react-hot-toast'

const RESAMPLE_OPTS = [
  { value: '', label: 'None' }, { value: 'D', label: 'Daily' }, { value: 'W', label: 'Weekly' },
  { value: 'ME', label: 'Monthly' }, { value: 'QE', label: 'Quarterly' }, { value: 'YE', label: 'Yearly' },
]
const MA_OPTS = [
  { value: '', label: 'None' }, { value: '7', label: '7-day MA' }, { value: '14', label: '14-day MA' },
  { value: '30', label: '30-day MA' }, { value: '90', label: '90-day MA' },
]

export default function TimeSeries() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [pipelines, setPipelines] = useState<CleaningPipeline[]>([])
  const [datasetId, setDatasetId] = useState('')
  const [pipelineId, setPipelineId] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [dateCol, setDateCol] = useState('')
  const [valueCol, setValueCol] = useState('')
  const [resample, setResample] = useState('')
  const [movingAvg, setMovingAvg] = useState('')
  const [forecastPeriods, setForecastPeriods] = useState(0)
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listDatasets().then(ds => {
      const ready = ds.filter(d => d.status === 'ready')
      setDatasets(ready)
      if (ready.length > 0) {
        setDatasetId(ready[0].id)
        const cols = ready[0].profile?.columns.map(c => c.name) || []
        setColumns(cols)
        const dateC = ready[0].profile?.columns.find(c => c.inferred_type === 'datetime')?.name
        const numC = ready[0].profile?.columns.find(c => c.inferred_type === 'numeric')?.name
        if (dateC) setDateCol(dateC)
        if (numC) setValueCol(numC)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!datasetId) return
    listPipelines(datasetId).then(setPipelines).catch(() => {})
    const ds = datasets.find(d => d.id === datasetId)
    setColumns(ds?.profile?.columns.map(c => c.name) || [])
  }, [datasetId, datasets])

  const run = async () => {
    if (!datasetId || !dateCol || !valueCol) { toast.error('Select dataset, date, and value columns'); return }
    setLoading(true)
    try {
      const res = await getChartData(datasetId, {
        x_column: dateCol, y_column: valueCol,
        resample: resample || undefined,
        moving_avg: movingAvg ? Number(movingAvg) : undefined,
        forecast_periods: forecastPeriods > 0 ? forecastPeriods : undefined,
        chart_type: 'line',
      }, pipelineId || undefined)
      setData(res.data)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const colOpts = [{ value: '', label: 'Select…' }, ...columns.map(c => ({ value: c, label: c }))]
  const forecastStart = data.findIndex(d => d.__forecast === true)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold">Time Series</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Resampling, moving averages, trend, and simple forecasting</p>
        </div>
      </div>

      <Card className="mb-4">
        <div className="flex items-end gap-3 flex-wrap">
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
          <Select label="Date column" value={dateCol} onChange={e => setDateCol(e.target.value)} options={colOpts} />
          <Select label="Value column" value={valueCol} onChange={e => setValueCol(e.target.value)} options={colOpts} />
          <Select label="Resample" value={resample} onChange={e => setResample(e.target.value)} options={RESAMPLE_OPTS} />
          <Select label="Moving avg." value={movingAvg} onChange={e => setMovingAvg(e.target.value)} options={MA_OPTS} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Forecast periods</label>
            <input type="number" min={0} max={365} value={forecastPeriods} onChange={e => setForecastPeriods(Number(e.target.value))} className="w-24 px-3 py-2 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded text-[var(--foreground)]" />
          </div>
          <Button onClick={run} loading={loading} className="self-end">Analyze</Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : data.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Time Series: {valueCol} over {dateCol}</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey={dateCol} tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: 12 }} />
              {forecastStart > -1 && <ReferenceLine x={data[forecastStart]?.[dateCol] as string} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: 'Forecast start', fill: 'var(--warning)', fontSize: 11 }} />}
              <Line dataKey={valueCol} stroke={CHART_COLORS[0]} dot={false} strokeWidth={2} />
              {movingAvg && <Line dataKey={`ma_${movingAvg}`} stroke={CHART_COLORS[1]} dot={false} strokeWidth={1.5} strokeDasharray="5 3" name={`${movingAvg}-period MA`} />}
              {forecastPeriods > 0 && <Line dataKey={`${valueCol}_forecast`} stroke={CHART_COLORS[2]} dot={false} strokeWidth={1.5} strokeDasharray="5 3" name="Forecast" />}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      ) : (
        <EmptyState title="No analysis run" description="Select columns and click Analyze" />
      )}
    </div>
  )
}
