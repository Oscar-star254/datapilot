import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Play, Save, RefreshCw, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select, Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Spinner, EmptyState } from '@/components/ui/Spinner'
import { listDatasets, listPipelines, createPipeline, updatePipeline, deletePipeline } from '@/lib/api'
import type { Dataset, CleaningPipeline, CleaningStep, CleaningStepType } from '@/lib/types'
import { generateId } from '@/lib/utils'
import toast from 'react-hot-toast'

const STEP_TYPES: { value: CleaningStepType; label: string; description: string }[] = [
  { value: 'drop_duplicates', label: 'Drop duplicates', description: 'Remove duplicate rows' },
  { value: 'fill_missing', label: 'Fill missing values', description: 'Fill NaN with mean/median/mode/constant' },
  { value: 'drop_missing', label: 'Drop missing rows', description: 'Remove rows with missing values' },
  { value: 'rename_column', label: 'Rename column', description: 'Rename a column' },
  { value: 'drop_column', label: 'Drop column', description: 'Remove a column' },
  { value: 'convert_type', label: 'Convert type', description: 'Change column data type' },
  { value: 'remove_outliers', label: 'Remove outliers', description: 'IQR or Z-score method' },
  { value: 'normalize', label: 'Normalize', description: 'Min-max or Z-score normalization' },
  { value: 'one_hot_encode', label: 'One-hot encode', description: 'Encode categorical column' },
  { value: 'filter_rows', label: 'Filter rows', description: 'Keep rows matching condition' },
  { value: 'sort_rows', label: 'Sort rows', description: 'Sort by one or more columns' },
]

function StepParams({ step, columns, onChange }: {
  step: CleaningStep
  columns: string[]
  onChange: (params: Record<string, unknown>) => void
}) {
  const colOpts = [{ value: '', label: 'Select column…' }, ...columns.map(c => ({ value: c, label: c }))]

  switch (step.type) {
    case 'fill_missing':
      return (
        <div className="flex gap-2 flex-wrap">
          <Select label="Column" value={String(step.params.column || '')} onChange={e => onChange({ ...step.params, column: e.target.value })} options={colOpts} />
          <Select label="Method" value={String(step.params.method || 'mean')} onChange={e => onChange({ ...step.params, method: e.target.value })} options={[
            { value: 'mean', label: 'Mean' }, { value: 'median', label: 'Median' },
            { value: 'mode', label: 'Mode' }, { value: 'constant', label: 'Constant' }, { value: 'forward_fill', label: 'Forward fill' }, { value: 'backward_fill', label: 'Backward fill' },
          ]} />
          {step.params.method === 'constant' && (
            <Input label="Value" value={String(step.params.value || '')} onChange={e => onChange({ ...step.params, value: e.target.value })} />
          )}
        </div>
      )
    case 'drop_missing':
      return (
        <Select label="Columns" value={String(step.params.subset || '')} onChange={e => onChange({ ...step.params, subset: e.target.value || undefined })} options={[{ value: '', label: 'All columns' }, ...columns.map(c => ({ value: c, label: c }))]} />
      )
    case 'rename_column':
      return (
        <div className="flex gap-2">
          <Select label="Column" value={String(step.params.column || '')} onChange={e => onChange({ ...step.params, column: e.target.value })} options={colOpts} />
          <Input label="New name" value={String(step.params.new_name || '')} onChange={e => onChange({ ...step.params, new_name: e.target.value })} />
        </div>
      )
    case 'drop_column':
      return <Select label="Column" value={String(step.params.column || '')} onChange={e => onChange({ ...step.params, column: e.target.value })} options={colOpts} />
    case 'convert_type':
      return (
        <div className="flex gap-2">
          <Select label="Column" value={String(step.params.column || '')} onChange={e => onChange({ ...step.params, column: e.target.value })} options={colOpts} />
          <Select label="Target type" value={String(step.params.dtype || 'float')} onChange={e => onChange({ ...step.params, dtype: e.target.value })} options={[
            { value: 'float', label: 'Float' }, { value: 'int', label: 'Integer' }, { value: 'str', label: 'String' }, { value: 'datetime', label: 'Datetime' }, { value: 'bool', label: 'Boolean' },
          ]} />
        </div>
      )
    case 'remove_outliers':
      return (
        <div className="flex gap-2 flex-wrap">
          <Select label="Column" value={String(step.params.column || '')} onChange={e => onChange({ ...step.params, column: e.target.value })} options={colOpts} />
          <Select label="Method" value={String(step.params.method || 'iqr')} onChange={e => onChange({ ...step.params, method: e.target.value })} options={[
            { value: 'iqr', label: 'IQR (1.5×)' }, { value: 'zscore', label: 'Z-score (3σ)' },
          ]} />
        </div>
      )
    case 'normalize':
      return (
        <div className="flex gap-2">
          <Select label="Column" value={String(step.params.column || '')} onChange={e => onChange({ ...step.params, column: e.target.value })} options={colOpts} />
          <Select label="Method" value={String(step.params.method || 'minmax')} onChange={e => onChange({ ...step.params, method: e.target.value })} options={[
            { value: 'minmax', label: 'Min-Max [0,1]' }, { value: 'zscore', label: 'Z-score standardize' },
          ]} />
        </div>
      )
    case 'one_hot_encode':
      return <Select label="Column" value={String(step.params.column || '')} onChange={e => onChange({ ...step.params, column: e.target.value })} options={colOpts} />
    case 'filter_rows':
      return (
        <div className="flex gap-2 flex-wrap">
          <Select label="Column" value={String(step.params.column || '')} onChange={e => onChange({ ...step.params, column: e.target.value })} options={colOpts} />
          <Select label="Operator" value={String(step.params.operator || 'eq')} onChange={e => onChange({ ...step.params, operator: e.target.value })} options={[
            { value: 'eq', label: '=' }, { value: 'neq', label: '≠' }, { value: 'gt', label: '>' }, { value: 'gte', label: '≥' }, { value: 'lt', label: '<' }, { value: 'lte', label: '≤' },
          ]} />
          <Input label="Value" value={String(step.params.value || '')} onChange={e => onChange({ ...step.params, value: e.target.value })} />
        </div>
      )
    case 'sort_rows':
      return (
        <div className="flex gap-2">
          <Select label="Column" value={String(step.params.column || '')} onChange={e => onChange({ ...step.params, column: e.target.value })} options={colOpts} />
          <Select label="Direction" value={String(step.params.ascending !== false ? 'asc' : 'desc')} onChange={e => onChange({ ...step.params, ascending: e.target.value === 'asc' })} options={[
            { value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' },
          ]} />
        </div>
      )
    default:
      return <p className="text-xs text-[var(--muted-foreground)]">No parameters required.</p>
  }
}

export default function Cleaning() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [pipelines, setPipelines] = useState<CleaningPipeline[]>([])
  const [datasetId, setDatasetId] = useState('')
  const [selectedPipeline, setSelectedPipeline] = useState<CleaningPipeline | null>(null)
  const [columns, setColumns] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addStep, setAddStep] = useState(false)
  const [newStepType, setNewStepType] = useState<CleaningStepType>('drop_duplicates')

  useEffect(() => {
    listDatasets().then(ds => {
      const ready = ds.filter(d => d.status === 'ready')
      setDatasets(ready)
      if (ready.length > 0) setDatasetId(ready[0].id)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!datasetId) return
    const ds = datasets.find(d => d.id === datasetId)
    if (ds?.profile) setColumns(ds.profile.columns.map(c => c.name))
    listPipelines(datasetId).then(ps => {
      setPipelines(ps)
      if (ps.length > 0 && !selectedPipeline) setSelectedPipeline(ps[0])
      else setSelectedPipeline(null)
    }).catch(() => {})
  }, [datasetId, datasets])

  const handleCreatePipeline = async () => {
    if (!datasetId) return
    const name = `Pipeline ${pipelines.length + 1}`
    try {
      const p = await createPipeline(datasetId, name)
      setPipelines(prev => [...prev, p])
      setSelectedPipeline(p)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create pipeline')
    }
  }

  const handleSave = async () => {
    if (!selectedPipeline) return
    setSaving(true)
    try {
      const updated = await updatePipeline(selectedPipeline.id, selectedPipeline.steps)
      setPipelines(prev => prev.map(p => p.id === updated.id ? updated : p))
      setSelectedPipeline(updated)
      toast.success('Pipeline saved')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const addNewStep = () => {
    if (!selectedPipeline) return
    const step: CleaningStep = { id: generateId(), type: newStepType, params: {} }
    setSelectedPipeline(p => p ? { ...p, steps: [...p.steps, step] } : p)
    setAddStep(false)
  }

  const updateStep = (id: string, params: Record<string, unknown>) => {
    setSelectedPipeline(p => p ? { ...p, steps: p.steps.map(s => s.id === id ? { ...s, params } : s) } : p)
  }

  const removeStep = (id: string) => {
    setSelectedPipeline(p => p ? { ...p, steps: p.steps.filter(s => s.id !== id) } : p)
  }

  const moveStep = (id: string, dir: 'up' | 'down') => {
    setSelectedPipeline(p => {
      if (!p) return p
      const idx = p.steps.findIndex(s => s.id === id)
      if (dir === 'up' && idx === 0) return p
      if (dir === 'down' && idx === p.steps.length - 1) return p
      const steps = [...p.steps]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      ;[steps[idx], steps[swap]] = [steps[swap], steps[idx]]
      return { ...p, steps }
    })
  }

  const handleDeletePipeline = async () => {
    if (!selectedPipeline || !confirm(`Delete pipeline "${selectedPipeline.name}"?`)) return
    try {
      await deletePipeline(selectedPipeline.id)
      const remaining = pipelines.filter(p => p.id !== selectedPipeline.id)
      setPipelines(remaining)
      setSelectedPipeline(remaining[0] || null)
      toast.success('Pipeline deleted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-bold">Data Cleaning</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Build versioned, replayable cleaning pipelines</p>
        </div>
        <div className="flex gap-2">
          <select
            value={datasetId}
            onChange={e => setDatasetId(e.target.value)}
            className="text-sm bg-[var(--secondary)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--foreground)]"
          >
            <option value="">Select dataset…</option>
            {datasets.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-4">
        {/* Pipeline list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">Pipelines</span>
            <Button variant="ghost" size="icon" onClick={handleCreatePipeline} disabled={!datasetId} title="New pipeline">
              <Plus size={13} />
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            {pipelines.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPipeline(p)}
                className={`text-left px-3 py-2 rounded text-sm transition-colors ${selectedPipeline?.id === p.id ? 'bg-[var(--primary)] text-white' : 'hover:bg-[var(--muted)] text-[var(--muted-foreground)]'}`}
              >
                <div className="font-medium truncate text-xs">{p.name}</div>
                <div className="text-[10px] opacity-60">{p.steps.length} steps</div>
              </button>
            ))}
            {pipelines.length === 0 && datasetId && (
              <button onClick={handleCreatePipeline} className="text-left px-3 py-2 rounded text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)] border border-dashed border-[var(--border)] hover:border-[var(--primary)]">
                + New pipeline
              </button>
            )}
          </div>
        </div>

        {/* Pipeline editor */}
        {selectedPipeline ? (
          <Card>
            <CardHeader>
              <CardTitle>{selectedPipeline.name}</CardTitle>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => setAddStep(true)}>
                  <Plus size={13} /> Add step
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSave} loading={saving}>
                  <Save size={13} /> Save
                </Button>
                <Button variant="ghost" size="icon" onClick={handleDeletePipeline} title="Delete pipeline">
                  <Trash2 size={13} className="text-[var(--destructive)]" />
                </Button>
              </div>
            </CardHeader>

            {selectedPipeline.steps.length === 0 ? (
              <EmptyState
                title="No steps yet"
                description="Add cleaning steps to build your pipeline"
                action={<Button size="sm" onClick={() => setAddStep(true)}><Plus size={13} /> Add step</Button>}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {selectedPipeline.steps.map((step, i) => {
                  const typeInfo = STEP_TYPES.find(t => t.value === step.type)
                  return (
                    <div key={step.id} className="border border-[var(--border)] rounded-[var(--radius)] p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-5 h-5 bg-[var(--muted)] rounded text-[10px] font-mono text-[var(--muted-foreground)] flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="text-sm font-medium flex-1">{typeInfo?.label}</span>
                        <Badge variant="outline">{step.type}</Badge>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" onClick={() => moveStep(step.id, 'up')} disabled={i === 0}>
                            <ChevronUp size={12} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => moveStep(step.id, 'down')} disabled={i === selectedPipeline.steps.length - 1}>
                            <ChevronDown size={12} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => removeStep(step.id)}>
                            <Trash2 size={12} className="text-[var(--destructive)]" />
                          </Button>
                        </div>
                      </div>
                      <div className="pl-7">
                        <StepParams step={step} columns={columns} onChange={params => updateStep(step.id, params)} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        ) : (
          <EmptyState
            icon={<Undo2 size={32} />}
            title="No pipeline selected"
            description="Select a dataset and create a pipeline to begin"
          />
        )}
      </div>

      {/* Add step modal */}
      <Modal open={addStep} onClose={() => setAddStep(false)} title="Add Step" size="sm">
        <div className="flex flex-col gap-3">
          <Select
            label="Step type"
            value={newStepType}
            onChange={e => setNewStepType(e.target.value as CleaningStepType)}
            options={STEP_TYPES.map(t => ({ value: t.value, label: t.label }))}
          />
          {STEP_TYPES.find(t => t.value === newStepType) && (
            <p className="text-xs text-[var(--muted-foreground)]">{STEP_TYPES.find(t => t.value === newStepType)?.description}</p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setAddStep(false)}>Cancel</Button>
            <Button onClick={addNewStep}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
