// User types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  organization?: string;
  role: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

// Project types
export interface Project {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
  dataset_count: number;
}

// Dataset types
export interface Dataset {
  id: number;
  name: string;
  description?: string;
  project_id: number;
  file_path: string;
  file_size: number;
  row_count: number;
  column_count: number;
  schema: ColumnSchema[];
  created_at: string;
  updated_at: string;
  evaluation_count: number;
  // Versioning fields
  parent_dataset_id?: number;
  version: number;
  version_tag?: string;
  is_latest: boolean;
}

export interface ColumnSchema {
  name: string;
  type: string;
  unique_count: number;
  missing_count: number;
  missing_percentage: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  most_common?: { value: string; count: number }[];
}

// Metric types
export interface Metric {
  id: number;
  name: string;
  description?: string;
  category: string;
  parameters: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface MetricTemplate {
  id: number;
  name: string;
  description?: string;
  metrics: MetricConfig[];
  created_at: string;
  updated_at: string;
}

export interface MetricConfig {
  metric_id: number;
  parameters: Record<string, any>;
}

// Evaluation types
export interface Evaluation {
  id: number;
  dataset_id: number;
  status: 'pending' | 'processing' | 'running' | 'completed' | 'failed';
  metrics_config: { metrics: MetricConfig[]; options?: Record<string, any> } | MetricConfig[];
  results?: EvaluationResults;
  quality_score?: number;
  progress?: number;
  current_step?: string;
  task_id?: string;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  issue_count: number;
}

export interface EvaluationResults {
  overall: {
    quality_score: number;
    metrics_processed?: string[];
    completeness?: number;
    uniqueness?: number;
    outliers?: Record<string, OutlierInfo>;
    [key: string]: any;
  };
  column_metrics: Record<string, ColumnMetrics>;
}

export interface OutlierInfo {
  count: number;
  indices: number[];
}

// ══════════════════════════════════════════════════════════════════════════════
// IMPORTANTE: ColumnMetrics actualmente representa CARACTERÍSTICAS DEL DATASET
// NO métricas de evaluación de calidad de datos.
//
// Campos de características del dataset (NO métricas):
// - completeness: Porcentaje de valores no nulos (característica descriptiva)
// - uniqueness: Porcentaje de valores únicos (característica descriptiva)
// - outliers: Valores atípicos detectados (característica descriptiva)
//
// En el futuro, esta interfaz se refactorizará para:
// 1. Separar características del dataset en una interfaz dedicada (DatasetCharacteristics)
// 2. Usar ColumnMetrics SOLO para métricas de evaluación de calidad de datos
// 3. Distinguir claramente entre propiedades descriptivas y métricas evaluativas
// ══════════════════════════════════════════════════════════════════════════════
export interface ColumnMetrics {
  completeness: number;
  uniqueness: number;
  n_nulls?: number;
  n_non_nulls?: number;
  n_unique?: number;
  type: string;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  std?: number;
  histogram?: {
    bins: number[];
    counts: number[];
  };
}

export interface Issue {
  id: number;
  evaluation_id: number;
  metric_id?: number;
  severity: 'low' | 'medium' | 'high';
  description: string;
  issue_type?: string;
  affected_columns?: any[];
  affected_rows?: any;
  created_at: string;
}

// Sonar-Lite Architecture Types
export type QualityGateStatus = 'PASSED' | 'FAILED' | 'WARNING';
export type AnalysisStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface AnalysisRun {
  id: number;
  project_id: number;
  dataset_id?: number;
  status: AnalysisStatus;
  quality_gate_status?: QualityGateStatus;
  quality_score?: number;
  critical_issues_count: number;
  total_issues_count: number;
  baseline_analysis_id?: number;
  new_issues_count: number;
  fixed_issues_count: number;
  recurrent_issues_count: number;
  metrics_config?: any;
  results?: any;
  task_id?: string;
  progress: number;
  current_step?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface DataQualityIssue {
  id: number;
  analysis_run_id: number;
  metric_id?: number;
  fingerprint?: string;
  issue_type: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  description: string;
  affected_columns?: any[];
  affected_rows?: any;
  affected_row_count: number;
  is_new: boolean;
  rule_key?: string;
  actual_value?: string;
  expected_value?: string;
  created_at: string;
}

// ── Data Profiling / EDA types ──────────────────────────────────
export interface ProfilingOverview {
  total_rows: number;
  total_columns: number;
  total_cells: number;
  total_missing: number;
  missing_percent: number;
  duplicate_rows: number;
  duplicate_percent: number;
  estimated_size_bytes: number;
}

export interface ProfilingTypeSummary {
  numeric_count: number;
  categorical_count: number;
  numeric_columns: string[];
  categorical_columns: string[];
}

export interface HistogramData {
  bins: number[];
  counts: number[];
}

export interface BoxplotData {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  lower_fence: number;
  upper_fence: number;
  outlier_count: number;
  outliers_sample: number[];
}

export interface BarChartData {
  labels: string[];
  counts: number[];
}

export interface ProfilingColumn {
  name: string;
  dtype: string;
  category: 'numeric' | 'categorical';
  sub_type: 'continuous' | 'discrete' | 'binary' | 'nominal' | 'text';
  n_missing: number;
  n_valid: number;
  missing_percent: number;
  n_unique: number;
  // Numeric stats
  mean?: number | null;
  median?: number | null;
  std?: number | null;
  min?: number | null;
  max?: number | null;
  q1?: number | null;
  q3?: number | null;
  iqr?: number | null;
  skewness?: number | null;
  kurtosis?: number | null;
  histogram?: HistogramData | null;
  boxplot?: BoxplotData | null;
  // Categorical stats
  mode?: string | null;
  bar_chart?: BarChartData | null;
}

export interface CorrelationMatrix {
  columns: string[];
  pearson: number[][];
  spearman: number[][];
}

export interface DataProfilingResult {
  overview: ProfilingOverview;
  type_summary: ProfilingTypeSummary;
  columns: ProfilingColumn[];
  correlation_matrix: CorrelationMatrix | null;
}
