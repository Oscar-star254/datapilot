import { getAuthToken } from './supabase'
import type { Dataset, CleaningPipeline, Chart, Dashboard, PaginatedResponse, ViewerParams, TaskStatus, AnalysisResult } from './types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `API error ${res.status}`)
  }
  return res.json()
}

async function fetchApiForm<T>(path: string, formData: FormData): Promise<T> {
  const token = await getAuthToken()
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `API error ${res.status}`)
  }
  return res.json()
}

// Health
export const checkHealth = () => fetchApi<{ status: string }>('/health')

// Datasets
export const listDatasets = () => fetchApi<Dataset[]>('/datasets')

export const uploadDataset = (file: File, name: string) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('name', name)
  return fetchApiForm<{ task_id: string; dataset_id: string }>('/datasets/upload', fd)
}

export const getDataset = (id: string) => fetchApi<Dataset>(`/datasets/${id}`)
export const renameDataset = (id: string, name: string) => fetchApi<Dataset>(`/datasets/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) })
export const deleteDataset = (id: string) => fetchApi<void>(`/datasets/${id}`, { method: 'DELETE' })
export const getTaskStatus = (taskId: string) => fetchApi<TaskStatus>(`/tasks/${taskId}`)

// Data Viewer
export const getDataPage = (params: ViewerParams) => {
  const qs = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.page_size),
    ...(params.sort_column ? { sort_column: params.sort_column } : {}),
    ...(params.sort_direction ? { sort_direction: params.sort_direction } : {}),
    ...(params.pipeline_id ? { pipeline_id: params.pipeline_id } : {}),
    ...(params.filters ? { filters: JSON.stringify(params.filters) } : {}),
  })
  return fetchApi<PaginatedResponse<Record<string, unknown>>>(`/datasets/${params.dataset_id}/data?${qs}`)
}

// Cleaning
export const listPipelines = (datasetId: string) => fetchApi<CleaningPipeline[]>(`/datasets/${datasetId}/pipelines`)
export const createPipeline = (datasetId: string, name: string) => fetchApi<CleaningPipeline>(`/datasets/${datasetId}/pipelines`, { method: 'POST', body: JSON.stringify({ name }) })
export const updatePipeline = (pipelineId: string, steps: CleaningPipeline['steps']) => fetchApi<CleaningPipeline>(`/pipelines/${pipelineId}`, { method: 'PUT', body: JSON.stringify({ steps }) })
export const deletePipeline = (pipelineId: string) => fetchApi<void>(`/pipelines/${pipelineId}`, { method: 'DELETE' })
export const previewStep = (datasetId: string, pipelineId: string | null, step: object) =>
  fetchApi<{ preview: Record<string, unknown>[]; affected_rows: number }>(`/datasets/${datasetId}/preview-step`, { method: 'POST', body: JSON.stringify({ pipeline_id: pipelineId, step }) })

// Statistics
export const getDescriptiveStats = (datasetId: string, pipelineId?: string) =>
  fetchApi<AnalysisResult>(`/datasets/${datasetId}/stats/descriptive${pipelineId ? `?pipeline_id=${pipelineId}` : ''}`)

export const getCorrelation = (datasetId: string, method: 'pearson' | 'spearman', pipelineId?: string) =>
  fetchApi<AnalysisResult>(`/datasets/${datasetId}/stats/correlation?method=${method}${pipelineId ? `&pipeline_id=${pipelineId}` : ''}`)

export const runRegression = (datasetId: string, config: object) =>
  fetchApi<AnalysisResult>(`/datasets/${datasetId}/stats/regression`, { method: 'POST', body: JSON.stringify(config) })

export const runHypothesisTest = (datasetId: string, config: object) =>
  fetchApi<AnalysisResult>(`/datasets/${datasetId}/stats/hypothesis`, { method: 'POST', body: JSON.stringify(config) })

// Visualization
export const getChartData = (datasetId: string, config: object, pipelineId?: string) =>
  fetchApi<{ data: Record<string, unknown>[]; columns: string[] }>(`/datasets/${datasetId}/chart-data`, { method: 'POST', body: JSON.stringify({ ...config, pipeline_id: pipelineId }) })

export const listCharts = () => fetchApi<Chart[]>('/charts')
export const saveChart = (chart: Partial<Chart>) => fetchApi<Chart>('/charts', { method: 'POST', body: JSON.stringify(chart) })
export const updateChart = (id: string, chart: Partial<Chart>) => fetchApi<Chart>(`/charts/${id}`, { method: 'PUT', body: JSON.stringify(chart) })
export const deleteChart = (id: string) => fetchApi<void>(`/charts/${id}`, { method: 'DELETE' })

// Dashboards
export const listDashboards = () => fetchApi<Dashboard[]>('/dashboards')
export const createDashboard = (name: string, description: string) => fetchApi<Dashboard>('/dashboards', { method: 'POST', body: JSON.stringify({ name, description }) })
export const updateDashboard = (id: string, data: Partial<Dashboard>) => fetchApi<Dashboard>(`/dashboards/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteDashboard = (id: string) => fetchApi<void>(`/dashboards/${id}`, { method: 'DELETE' })
export const getPublicDashboard = (slug: string) => fetchApi<Dashboard>(`/public/dashboards/${slug}`)

// SQL Playground
export const runQuery = (datasetId: string, sql: string, pipelineId?: string) =>
  fetchApi<{ columns: string[]; rows: unknown[][]; row_count: number; duration_ms: number }>(`/datasets/${datasetId}/query`, { method: 'POST', body: JSON.stringify({ sql, pipeline_id: pipelineId }) })

// Export
export const exportData = (datasetId: string, format: 'csv' | 'xlsx' | 'json', pipelineId?: string) => {
  return fetch(`${API_BASE}/datasets/${datasetId}/export?format=${format}${pipelineId ? `&pipeline_id=${pipelineId}` : ''}`, {
    headers: {} as Record<string, string>,
  }).then(async r => {
    const token = await getAuthToken()
    return fetch(`${API_BASE}/datasets/${datasetId}/export?format=${format}${pipelineId ? `&pipeline_id=${pipelineId}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  })
}

export const exportReport = (datasetId: string) =>
  fetch(`${API_BASE}/datasets/${datasetId}/report`, {
    headers: {} as Record<string, string>,
  })

// Account
export const getStorageUsage = () => fetchApi<{ used_bytes: number; file_count: number; limit_bytes: number }>('/account/storage')
export const deleteAccount = () => fetchApi<void>('/account', { method: 'DELETE' })
