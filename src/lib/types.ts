export interface User {
  id: string
  email: string
  created_at: string
}

export interface Dataset {
  id: string
  user_id: string
  name: string
  original_filename: string
  file_path: string
  file_size: number
  file_type: 'csv' | 'xlsx' | 'json'
  row_count: number
  column_count: number
  status: 'uploading' | 'profiling' | 'ready' | 'error'
  profile: DataProfile | null
  created_at: string
  updated_at: string
}

export interface DataProfile {
  columns: ColumnProfile[]
  row_count: number
  duplicate_count: number
  missing_total: number
}

export interface ColumnProfile {
  name: string
  dtype: string
  inferred_type: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text'
  missing_count: number
  missing_pct: number
  unique_count: number
  sample_values: (string | number | null)[]
  stats?: {
    min?: number
    max?: number
    mean?: number
    median?: number
    std?: number
    q25?: number
    q75?: number
  }
  top_values?: { value: string; count: number }[]
}

export interface CleaningStep {
  id: string
  type: CleaningStepType
  params: Record<string, unknown>
  applied_at?: string
}

export type CleaningStepType =
  | 'drop_duplicates'
  | 'fill_missing'
  | 'drop_missing'
  | 'rename_column'
  | 'drop_column'
  | 'convert_type'
  | 'remove_outliers'
  | 'normalize'
  | 'one_hot_encode'
  | 'filter_rows'
  | 'sort_rows'

export interface CleaningPipeline {
  id: string
  dataset_id: string
  user_id: string
  name: string
  steps: CleaningStep[]
  created_at: string
  updated_at: string
}

export interface Chart {
  id: string
  user_id: string
  dataset_id: string
  pipeline_id: string | null
  name: string
  chart_type: ChartType
  config: ChartConfig
  created_at: string
  updated_at: string
}

export type ChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'scatter'
  | 'histogram'
  | 'box'
  | 'pie'
  | 'heatmap'
  | 'correlation_matrix'

export interface ChartConfig {
  x_column?: string
  y_column?: string
  y_columns?: string[]
  group_by?: string
  aggregation?: 'sum' | 'mean' | 'count' | 'min' | 'max'
  color?: string
  title?: string
  x_label?: string
  y_label?: string
  bins?: number
  show_legend?: boolean
  show_grid?: boolean
}

export interface Dashboard {
  id: string
  user_id: string
  name: string
  description: string
  layout: DashboardItem[]
  is_public: boolean
  public_slug: string | null
  created_at: string
  updated_at: string
}

export interface DashboardItem {
  id: string
  chart_id?: string
  kpi_config?: KPIConfig
  type: 'chart' | 'kpi' | 'text'
  x: number
  y: number
  w: number
  h: number
}

export interface KPIConfig {
  label: string
  dataset_id: string
  column: string
  aggregation: 'sum' | 'mean' | 'count' | 'min' | 'max'
  format?: 'number' | 'percent' | 'currency'
  prefix?: string
  suffix?: string
}

export interface AnalysisResult {
  id: string
  dataset_id: string
  type: 'descriptive' | 'correlation' | 'regression' | 'hypothesis'
  config: Record<string, unknown>
  result: Record<string, unknown>
  created_at: string
}

export interface TaskStatus {
  task_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  message: string
  result?: Record<string, unknown>
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ViewerParams {
  dataset_id: string
  pipeline_id?: string
  page: number
  page_size: number
  sort_column?: string
  sort_direction?: 'asc' | 'desc'
  filters?: ColumnFilter[]
}

export interface ColumnFilter {
  column: string
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'is_null' | 'not_null'
  value?: string | number
}

export interface StorageUsage {
  used_bytes: number
  file_count: number
  limit_bytes: number
}
