import { TFunction } from 'i18next';

interface AffectedColumnEntry {
  column?: string;
  null_rate?: number;
  variability?: number;
  unique_values?: number;
  column_type?: string;
  threshold_used?: number;
  age_days?: number;
  staleness_threshold_days?: number;
  parse_success_rate?: number;
  dominant_class?: string;
  dominant_proportion?: number;
  minority_class?: string;
  minority_proportion?: number;
  expected_type?: string;
  invalid_count?: number;
  conformance_rate?: number;
  detected_types?: Array<{ type: string; match_rate: number }>;
  outlier_count?: number;
  outlier_proportion?: number;
  duplicate_count?: number;
  uniqueness?: number;
  [key: string]: any;
}

interface IssueData {
  issue_type?: string;
  description?: string;
  affected_columns?: AffectedColumnEntry[] | null;
  affected_rows?: { count?: number; sample?: any[] } | null;
  actual_value?: string;
  affected_row_count?: number;
  affected_rows_pct?: number;
  [key: string]: any;
}

/**
 * Returns a localized description for an issue using structured fields.
 * Falls back to the raw `description` string (stored in Spanish) if no
 * matching template is found.
 */
export function getLocalizedIssueDescription(issue: IssueData, t: TFunction): string {
  const { issue_type, affected_columns, affected_rows, actual_value, description } = issue;
  const cols: AffectedColumnEntry[] = Array.isArray(affected_columns) ? affected_columns : [];
  const col0 = cols[0] || {};
  const colName = col0.column || '';

  switch (issue_type) {
    case 'completeness': {
      if (cols.length === 1 && colName) {
        const val =
          actual_value ||
          (col0.null_rate != null
            ? `${((1 - col0.null_rate) * 100).toFixed(2)}%`
            : '');
        return t('datasets.issueDescriptions.completeness_column', { column: colName, value: val });
      }
      const val = actual_value || '';
      return t('datasets.issueDescriptions.completeness_dataset', { value: val });
    }

    case 'low_variability': {
      const val =
        actual_value ||
        (col0.variability != null ? `${(col0.variability * 100).toFixed(2)}%` : '');
      const colType = col0.column_type || '';
      return t('datasets.issueDescriptions.low_variability', {
        column: colName,
        colType,
        value: val,
      });
    }

    case 'duplicate_rows': {
      const count = affected_rows?.count ?? issue.affected_row_count ?? 0;
      const val = actual_value || '';
      return t('datasets.issueDescriptions.duplicate_rows', { count, value: val });
    }

    case 'non_unique_identifier': {
      const count = col0.duplicate_count ?? affected_rows?.count ?? issue.affected_row_count ?? 0;
      const val =
        actual_value ||
        (col0.uniqueness != null ? `${(col0.uniqueness * 100).toFixed(2)}%` : '');
      return t('datasets.issueDescriptions.non_unique_identifier', {
        column: colName,
        count,
        value: val,
      });
    }

    case 'currentness': {
      if (col0.age_days != null) {
        const ageDays = col0.age_days;
        const staleness = col0.staleness_threshold_days ?? '—';
        return t('datasets.issueDescriptions.currentness_stale', {
          column: colName,
          ageDays,
          staleness,
        });
      }
      if (col0.parse_success_rate != null) {
        const val =
          actual_value || `${(col0.parse_success_rate * 100).toFixed(1)}%`;
        return t('datasets.issueDescriptions.currentness_parse', { column: colName, value: val });
      }
      break;
    }

    case 'class_balance': {
      if (col0.dominant_class != null) {
        const cls = col0.dominant_class;
        const val =
          actual_value ||
          (col0.dominant_proportion != null
            ? `${(col0.dominant_proportion * 100).toFixed(1)}%`
            : '');
        return t('datasets.issueDescriptions.class_balance_dominant', {
          column: colName,
          cls,
          value: val,
        });
      }
      if (col0.minority_class != null) {
        const cls = col0.minority_class;
        const val =
          actual_value ||
          (col0.minority_proportion != null
            ? `${(col0.minority_proportion * 100).toFixed(2)}%`
            : '');
        return t('datasets.issueDescriptions.class_balance_minority', {
          column: colName,
          cls,
          value: val,
        });
      }
      break;
    }

    case 'syntactic_accuracy': {
      const count =
        col0.invalid_count ?? affected_rows?.count ?? issue.affected_row_count ?? 0;
      const expectedType = col0.expected_type || '';
      const val =
        actual_value ||
        (col0.conformance_rate != null
          ? `${(col0.conformance_rate * 100).toFixed(2)}%`
          : '');
      return t('datasets.issueDescriptions.syntactic_accuracy', {
        column: colName,
        count,
        expectedType,
        value: val,
      });
    }

    case 'mixed_format': {
      return t('datasets.issueDescriptions.mixed_format', { column: colName });
    }

    case 'outliers': {
      const count =
        col0.outlier_count ?? affected_rows?.count ?? issue.affected_row_count ?? 0;
      const val =
        actual_value ||
        (col0.outlier_proportion != null
          ? `${(col0.outlier_proportion * 100).toFixed(1)}%`
          : '');
      return t('datasets.issueDescriptions.outliers', { column: colName, count, value: val });
    }

    case 'logical_consistency': {
      if (cols.length === 0) {
        return t('datasets.issueDescriptions.logical_consistency_blocked');
      }
      const count = affected_rows?.count ?? issue.affected_row_count ?? 0;
      const val = actual_value || '';
      return t('datasets.issueDescriptions.logical_consistency_violation', { count, value: val });
    }

    default:
      break;
  }

  return description || '';
}
