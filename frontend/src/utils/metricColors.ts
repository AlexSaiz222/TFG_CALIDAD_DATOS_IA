import type { ElementType } from 'react';
import {
  FileCheck2,
  Fingerprint,
  AlertTriangle,
  Clock,
  GitBranch,
  Scale,
  Braces,
  BarChart3,
} from 'lucide-react';

export const GREEN = '#00B37E';
export const GREEN_HOVER = '#00A070';
export const ORANGE = '#FFB800';
export const RED = '#E5484D';

export interface MetricMeta {
  icon: ElementType;
  color: string;
  bg: string;
  category: string;
}

export const METRIC_META: Record<string, MetricMeta> = {
  completeness:        { icon: FileCheck2,    color: '#1976D2', bg: '#E3F2FD', category: 'Completitud' },
  uniqueness:          { icon: Fingerprint,   color: '#7B2FBE', bg: '#F3E5F5', category: 'Unicidad' },
  outliers:            { icon: AlertTriangle, color: '#E08C00', bg: '#FFF8E1', category: 'Exactitud' },
  timeliness:          { icon: Clock,         color: '#7C3AED', bg: '#EDE9FE', category: 'Temporal' },
  logical_consistency: { icon: GitBranch,     color: '#0D7377', bg: '#E0F2F1', category: 'Consistencia' },
  class_balance:       { icon: Scale,         color: '#2E7D32', bg: '#E8F5E9', category: 'Distribución' },
  syntactic_accuracy:  { icon: Braces,        color: '#C75000', bg: '#FBE9E7', category: 'Exactitud' },
};

export const DEFAULT_METRIC_META: MetricMeta = {
  icon: BarChart3, color: GREEN, bg: 'rgba(0,179,126,0.1)', category: 'Métrica',
};

export function getMetricMeta(name: string): MetricMeta {
  const key = (name || '').toLowerCase().replace(/ /g, '_');
  return METRIC_META[key] ?? DEFAULT_METRIC_META;
}

export function formatParamValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (value === true) return '✓ activado';
  if (value === false) return '✗ desactivado';
  
  if (Array.isArray(value)) {
    if (value.length === 0) return '— (auto)';
    
    // Handle array of objects (e.g., syntactic_accuracy columns or logical_consistency rules)
    if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
      // For syntactic_accuracy columns: [{column, expected_type}, ...]
      if ('column' in value[0] && 'expected_type' in value[0]) {
        return value.map((v: any) => `${v.column} (${v.expected_type})`).join(', ');
      }
      // For logical_consistency rules: [{name, type, ...}, ...]
      if ('name' in value[0] && 'type' in value[0]) {
        return value.map((v: any) => v.name).join(', ');
      }
      // Generic object array: show count
      return `${value.length} elemento${value.length !== 1 ? 's' : ''}`;
    }
    
    // Handle array of primitives (strings, numbers)
    return value.join(', ');
  }
  
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export interface CategoryColors {
  bg: string;
  fg: string;
}

const CATEGORY_COLORS: Record<string, CategoryColors> = {
  data_quality:    { bg: 'rgba(99, 153, 34, 0.1)',   fg: '#639922' }, // verde  — "dato sano"
  data_profiling:  { bg: 'rgba(55, 138, 221, 0.1)',  fg: '#378ADD' }, // azul   — exploración
  data_validation: { bg: 'rgba(127, 119, 221, 0.1)', fg: '#7F77DD' }, // púrpura — reglas/contratos
  statistical:     { bg: 'rgba(186, 117, 23, 0.1)',  fg: '#BA7517' }, // ámbar  — métricas/números
  ml_specific:     { bg: 'rgba(212, 83, 126, 0.1)',  fg: '#D4537E' }, // rosa   — IA/ML diferenciado
  general:         { bg: 'rgba(136, 135, 128, 0.1)', fg: '#888780' }, // gris   — neutro por defecto
};

const FALLBACK: CategoryColors = { bg: 'rgba(158, 158, 158, 0.1)', fg: '#9E9E9E' };

export function categoryColor(category: string): CategoryColors {
  if (!category) return FALLBACK;
  const key = category.toLowerCase().replace(/\s+/g, '_');
  return CATEGORY_COLORS[key] || FALLBACK;
}
