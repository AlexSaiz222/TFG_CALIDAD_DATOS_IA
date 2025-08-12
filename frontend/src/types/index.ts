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
  status: 'pending' | 'running' | 'completed' | 'failed';
  metrics_config: MetricConfig[];
  results?: EvaluationResults;
  quality_score?: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  issue_count: number;
}

export interface EvaluationResults {
  overall: {
    completeness: number;
    uniqueness: number;
    quality_score: number;
  };
  column_metrics: Record<string, ColumnMetrics>;
}

export interface ColumnMetrics {
  completeness: number;
  uniqueness: number;
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
  affected_columns?: any[];
  affected_rows?: any;
  created_at: string;
}
