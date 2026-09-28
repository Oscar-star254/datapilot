import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Filter, X, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Spinner, EmptyState } from '@/components/ui/Spinner'
import { listDatasets, getDataPage, listPipelines, exportData } from '@/lib/api'
import type { Dataset, CleaningPipeline, ColumnFilter, PaginatedResponse } from '@/lib/types'
import { formatNumber, downloadBlob } from '@/lib/utils'
import toast from 'react-hot-toast'

const PAGE_SIZES = [25, 50, 100, 250]

const FILTER_OPS = [
  { value: 'eq', label: '= equals' },
  { value: 'neq', label: '≠ not equals' },
  { value: 'gt', label: '> greater than' },
  { value: 'gte', label: '≥ greater or equal' },
  { value: 'lt', label: '< less than' },
  { value: 'lte', label: '≤ less or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'is_null', label: 'is empty' },
  { value: 'not_null', label: 'is not empty' },
]

export default function DataViewer() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [pipelines, setPipelines] = useState<CleaningPipeline[]>([])
  const [datasetId, setDatasetId] = useState(searchParams.get('dataset') || '')
  const [pipelineId, setPipelineId] = useState('')
  const [data, setData] = useState<PaginatedResponse<Record<string, unknown>> | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filters, setFilters] = useState<ColumnFilter[]>([])
  const [filterModal, setFilterModal] = useState(false)
  const [newFilter, setNewFilter] = useState<ColumnFilter>({ column: '', operator: 'eq', value: '' })

  useEffect(() => {
    listDatasets().then(ds => {
      setDatasets(ds.filter(d => d.status === 'ready'))
      if (!datasetId && ds.length > 0) setDatasetId(ds[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!datasetId) return
    listPipelines(datasetId).then(setPipelines).catch(() => {})
    setPage(1)
  }, [datasetId])

  const fetchData = useCallback(async () => {
    if (!datasetId) return
    setLoading(true)
    try {
      const result = await getDataPage({
        dataset_id: datasetId,
        pipeline_id: pipelineId || undefined,
        page,
        page_size: pageSize,
        sort_column: sortCol || undefined,
        sort_direction: sortCol ? sortDir : undefined,
        filters: filters.length > 0 ? filters : undefined,
      })
      setData(result)
      if (result.data.length > 0) setColumns(Object.keys(result.data[0]))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [datasetId, pipelineId, page, pageSize, sortCol, sortDir, filters])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
    setPage(1)
  }

  const handleExport = async (format: 'csv' | 'xlsx' | 'json') => {
    try {
      const res = await exportData(datasetId, format, pipelineId || undefined)
      const blob = await res.blob()
      const ds = datasets.find(d => d.id === datasetId)
      downloadBlob(blob, `${ds?.name || 'export'}.${format}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    }
  }

  const renderCell = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'number') return formatNumber(value)
    return String(value)
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ChevronsUpDown size={11} className="opacity-30" />
    return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
  }

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-display font-bold">Data Viewer</h1>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={datasetId}
            onChange={e => { setDatasetId(e.target.value); setSearchParams({ dataset: e.target.value }); setPage(1) }}
            className="text-sm bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--foreground)]"
          >
            <option value="">Select dataset…</option>
            {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          {pipelines.length > 0 && (
            <select
              value={pipelineId}
              onChange={e => { setPipelineId(e.target.value); setPage(1) }}
              className="text-sm bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--foreground)]"
            >
              <option value="">Raw data</option>
              {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="text-sm bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--foreground)]"
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s} rows</option>)}
          </select>

          <Button variant="outline" size="sm" onClick={() => setFilterModal(true)}>
            <Filter size={13} /> Filters {filters.length > 0 && `(${filters.length})`}
          </Button>

          <div className="relative group">
            <Button variant="outline" size="sm">
              <Download size={13} /> Export
            </Button>
            <div className="absolute right-0 top-full mt-1 bg-[var(--card)] border border-[var(--border)] rounded shadow-lg z-10 hidden group-hover:block min-w-[100px]">
              {(['csv', 'xlsx', 'json'] as const).map(f => (
                <button key={f} onClick={() => handleExport(f)} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--muted)] uppercase font-mono">
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active filters */}
      {filters.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {filters.map((f, i) => (
            <div key={i} className="inline-flex items-center gap-1.5 bg-[var(--muted)] rounded px-2 py-1 text-xs font-mono">
              <span className="text-[var(--accent)]">{f.column}</span>
              <span className="text-[var(--muted-foreground)]">{f.operator}</span>
              {f.value !== undefined && <span>{String(f.value)}</span>}
              <button onClick={() => setFilters(fs => fs.filter((_, j) => j !== i))} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] ml-0.5">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : !data || data.data.length === 0 ? (
          <EmptyState title="No data" description={datasetId ? 'No rows match your filters' : 'Select a dataset to view'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                  <th className="w-10 text-center px-3 py-2 text-[var(--muted-foreground)]">#</th>
                  {columns.map(col => (
                    <th key={col} className="px-3 py-2 text-left whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort(col)}>
                      <div className="flex items-center gap-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                        {col} <SortIcon col={col} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((row, i) => (
                  <tr key={i} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                    <td className="px-3 py-1.5 text-center text-[var(--muted-foreground)] text-[11px] tabular-nums">
                      {(page - 1) * pageSize + i + 1}
                    </td>
                    {columns.map(col => (
                      <td key={col} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis" title={String(row[col] ?? '')}>
                        {row[col] === null || row[col] === undefined ? (
                          <span className="text-[var(--muted-foreground)] italic">null</span>
                        ) : (
                          renderCell(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border)] bg-[var(--muted)]">
            <span className="text-xs text-[var(--muted-foreground)] font-mono">
              {formatNumber((page - 1) * pageSize + 1, 0)}–{formatNumber(Math.min(page * pageSize, data.total), 0)} of {formatNumber(data.total, 0)} rows
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" disabled={page === 1} onClick={() => setPage(1)}>«</Button>
              <Button variant="ghost" size="icon" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs px-2 font-mono">{page} / {data.total_pages}</span>
              <Button variant="ghost" size="icon" disabled={page === data.total_pages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={14} />
              </Button>
              <Button variant="ghost" size="icon" disabled={page === data.total_pages} onClick={() => setPage(data.total_pages)}>»</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Filter modal */}
      <Modal open={filterModal} onClose={() => setFilterModal(false)} title="Add Filter" size="sm">
        <div className="flex flex-col gap-3">
          <Select
            label="Column"
            value={newFilter.column}
            onChange={e => setNewFilter(f => ({ ...f, column: e.target.value }))}
            options={[{ value: '', label: 'Select column…' }, ...columns.map(c => ({ value: c, label: c }))]}
          />
          <Select
            label="Operator"
            value={newFilter.operator}
            onChange={e => setNewFilter(f => ({ ...f, operator: e.target.value as ColumnFilter['operator'] }))}
            options={FILTER_OPS}
          />
          {!['is_null', 'not_null'].includes(newFilter.operator) && (
            <Input
              label="Value"
              value={String(newFilter.value ?? '')}
              onChange={e => setNewFilter(f => ({ ...f, value: e.target.value }))}
              placeholder="Filter value"
            />
          )}
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" onClick={() => setFilterModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!newFilter.column) { toast.error('Select a column'); return }
                setFilters(f => [...f, newFilter])
                setNewFilter({ column: '', operator: 'eq', value: '' })
                setFilterModal(false)
                setPage(1)
              }}
            >
              Add filter
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
