import { useState, useEffect } from 'react'
import _GridLayout from 'react-grid-layout'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayout = _GridLayout as any
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { Plus, Trash2, Share2, Lock, Eye, Edit2, GripHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/Spinner'
import { listDashboards, createDashboard, updateDashboard, deleteDashboard, listCharts } from '@/lib/api'
import type { Dashboard, Chart, DashboardItem } from '@/lib/types'
import { generateId } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useParams, useNavigate, Link } from 'react-router-dom'

function DashboardChart({ item, charts }: { item: DashboardItem; charts: Chart[] }) {
  const chart = charts.find(c => c.id === item.chart_id)
  if (!chart) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">Chart not found</div>
  return (
    <div className="h-full p-3">
      <p className="text-xs font-medium mb-1">{chart.name}</p>
      <p className="text-xs text-[var(--muted-foreground)]">{chart.chart_type} · {chart.dataset_id}</p>
      <div className="h-[80%] flex items-center justify-center bg-[var(--muted)] rounded mt-2 text-xs text-[var(--muted-foreground)]">
        Chart preview
      </div>
    </div>
  )
}

export default function Dashboards() {
  const navigate = useNavigate()
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [charts, setCharts] = useState<Chart[]>([])
  const [selected, setSelected] = useState<Dashboard | null>(null)
  const [editing, setEditing] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [addChartModal, setAddChartModal] = useState(false)
  const [containerWidth, setContainerWidth] = useState(800)

  useEffect(() => {
    listDashboards().then(ds => {
      setDashboards(ds)
      if (ds.length > 0) setSelected(ds[0])
    }).catch(() => {})
    listCharts().then(setCharts).catch(() => {})
  }, [])

  useEffect(() => {
    const update = () => {
      const el = document.getElementById('dashboard-grid')
      if (el) setContainerWidth(el.offsetWidth)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [selected])

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const d = await createDashboard(newName, newDesc)
      setDashboards(prev => [...prev, d])
      setSelected(d)
      setCreateModal(false)
      setNewName('')
      setNewDesc('')
      toast.success('Dashboard created')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Create failed')
    }
  }

  const handleAddChart = (chartId: string) => {
    if (!selected) return
    const item: DashboardItem = {
      id: generateId(), chart_id: chartId, type: 'chart', x: 0, y: 0, w: 6, h: 4,
    }
    const updated = { ...selected, layout: [...selected.layout, item] }
    setSelected(updated)
    setAddChartModal(false)
  }

  const handleLayoutChange = (layout: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
    if (!selected) return
    const updated = {
      ...selected,
      layout: selected.layout.map(item => {
        const l = layout.find(li => li.i === item.id)
        return l ? { ...item, x: l.x, y: l.y, w: l.w, h: l.h } : item
      }),
    }
    setSelected(updated)
  }

  const handleSave = async () => {
    if (!selected) return
    try {
      const updated = await updateDashboard(selected.id, selected)
      setDashboards(prev => prev.map(d => d.id === updated.id ? updated : d))
      setEditing(false)
      toast.success('Dashboard saved')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const handleTogglePublic = async () => {
    if (!selected) return
    try {
      const updated = await updateDashboard(selected.id, { is_public: !selected.is_public })
      setSelected(updated)
      setDashboards(prev => prev.map(d => d.id === updated.id ? updated : d))
      toast.success(updated.is_public ? 'Dashboard is now public' : 'Dashboard is now private')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update')
    }
  }

  const handleDelete = async () => {
    if (!selected || !confirm(`Delete "${selected.name}"?`)) return
    try {
      await deleteDashboard(selected.id)
      const remaining = dashboards.filter(d => d.id !== selected.id)
      setDashboards(remaining)
      setSelected(remaining[0] || null)
      toast.success('Dashboard deleted')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const removeItem = (id: string) => {
    if (!selected) return
    setSelected(s => s ? { ...s, layout: s.layout.filter(i => i.id !== id) } : s)
  }

  return (
    <div className="max-w-full">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-display font-bold">Dashboards</h1>
        <div className="flex gap-2 flex-wrap">
          {selected && (
            <>
              <Button variant="outline" size="sm" onClick={handleTogglePublic}>
                {selected.is_public ? <><Lock size={13} /> Make private</> : <><Share2 size={13} /> Make public</>}
              </Button>
              {selected.is_public && selected.public_slug && (
                <Badge variant="accent">
                  <a href={`/public/dashboard/${selected.public_slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Public link
                  </a>
                </Badge>
              )}
              {editing ? (
                <>
                  <Button size="sm" onClick={handleSave}>Save layout</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                </>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  <Edit2 size={13} /> Edit layout
                </Button>
              )}
              {editing && (
                <Button variant="outline" size="sm" onClick={() => setAddChartModal(true)}>
                  <Plus size={13} /> Add chart
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={handleDelete} title="Delete dashboard">
                <Trash2 size={13} className="text-[var(--destructive)]" />
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => setCreateModal(true)}>
            <Plus size={13} /> New dashboard
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[180px_1fr] gap-4">
        {/* Dashboard list */}
        <div>
          <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-2">My dashboards</p>
          <div className="flex flex-col gap-1">
            {dashboards.map(d => (
              <button key={d.id} onClick={() => { setSelected(d); setEditing(false) }} className={`text-left px-3 py-2 rounded text-sm transition-colors ${selected?.id === d.id ? 'bg-[var(--primary)] text-white' : 'hover:bg-[var(--muted)] text-[var(--muted-foreground)]'}`}>
                <div className="font-medium text-xs truncate">{d.name}</div>
                <div className="text-[10px] opacity-60">{d.layout.length} items {d.is_public && '· public'}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div>
          {!selected ? (
            <EmptyState title="No dashboard selected" description="Create a dashboard or select one" action={<Button size="sm" onClick={() => setCreateModal(true)}><Plus size={13} /> New dashboard</Button>} />
          ) : selected.layout.length === 0 ? (
            <EmptyState
              title="Empty dashboard"
              description={editing ? "Click 'Add chart' to add charts" : "Enter edit mode to add charts"}
              action={
                editing
                  ? <Button size="sm" onClick={() => setAddChartModal(true)}><Plus size={13} /> Add chart</Button>
                  : <Button variant="secondary" size="sm" onClick={() => setEditing(true)}><Edit2 size={13} /> Edit layout</Button>
              }
            />
          ) : (
            <div id="dashboard-grid">
              {/* @ts-ignore - react-grid-layout type mismatch */}
              <GridLayout
                className="layout"
                layout={selected.layout.map(i => ({ i: i.id, x: i.x, y: i.y, w: i.w, h: i.h }))}
                cols={12}
                rowHeight={60}
                width={containerWidth}
                isDraggable={editing}
                isResizable={editing}
                onLayoutChange={handleLayoutChange}
                draggableHandle=".drag-handle"
              >
                {selected.layout.map(item => (
                  <div key={item.id} className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius)] overflow-hidden">
                    {editing && (
                      <div className="flex items-center justify-between px-2 py-1 border-b border-[var(--border)] bg-[var(--muted)]">
                        <GripHorizontal size={13} className="drag-handle text-[var(--muted-foreground)] cursor-grab" />
                        <button onClick={() => removeItem(item.id)} className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                    <DashboardChart item={item} charts={charts} />
                  </div>
                ))}
              </GridLayout>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="New Dashboard" size="sm">
        <div className="flex flex-col gap-3">
          <Input label="Name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Q3 Analysis" autoFocus />
          <Input label="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional" />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Add chart modal */}
      <Modal open={addChartModal} onClose={() => setAddChartModal(false)} title="Add Chart" size="sm">
        <div className="flex flex-col gap-2">
          {charts.length === 0 ? (
            <EmptyState title="No saved charts" description="Go to Visualization and save a chart first" />
          ) : (
            charts.map(c => (
              <button key={c.id} onClick={() => handleAddChart(c.id)} className="flex items-center gap-3 p-3 border border-[var(--border)] rounded hover:border-[var(--primary)] text-left transition-colors">
                <div className="flex-1">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{c.chart_type}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  )
}
