import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  WarningAmber as WarningAmberIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import { datasetsAPI } from '../../services/api';
import { Dataset } from '../../types';

// ─── paleta ───────────────────────────────────────────────────────────────
const GREEN  = '#00B37E';
const RED    = '#E5484D';
const ORANGE = '#FFB800';
const GRAY   = '#888888';

// ─── tipos ────────────────────────────────────────────────────────────────
interface ComparisonData {
  dataset_a: Dataset & { latestAnalysis?: any };
  dataset_b: Dataset & { latestAnalysis?: any };
  comparison: {
    rows_diff: number;
    columns_diff: number;
    quality_score_diff: number | null;
    issues_diff: number;
    new_issues: any[];
    resolved_issues: any[];
    common_issues: any[];
    added_columns?: string[];
    removed_columns?: string[];
  };
}

// ─── helpers ──────────────────────────────────────────────────────────────
function gateColor(status: string | null | undefined): string {
  switch (status) {
    case 'PASSED':  return GREEN;
    case 'FAILED':  return RED;
    case 'WARNING': return ORANGE;
    default:        return GRAY;
  }
}

function GateIcon({ status, size = 18 }: { status?: string | null; size?: number }) {
  const sx = { fontSize: size };
  switch (status) {
    case 'PASSED':  return <CheckCircleIcon sx={{ ...sx, color: GREEN }} />;
    case 'FAILED':  return <ErrorIcon       sx={{ ...sx, color: RED   }} />;
    case 'WARNING': return <WarningIcon     sx={{ ...sx, color: ORANGE}} />;
    default:        return null;
  }
}

function severityColor(s: string): string {
  switch (s?.toLowerCase()) {
    // Backend values (critical/major/minor/info)
    case 'critical':             return RED;
    case 'major': case 'high':   return RED;
    case 'minor': case 'medium': return ORANGE;
    case 'info':  case 'low':    return GREEN;
    default:                     return GRAY;
  }
}

function fmtDiff(n: number | null, suffix = '', invertSign = false): string {
  if (n === null) return '—';
  const v = invertSign ? -n : n;
  return `${v > 0 ? '+' : ''}${v}${suffix}`;
}

function diffColor(n: number | null, lowerIsBetter = false): string {
  if (n === null || n === 0) return GRAY;
  const improved = lowerIsBetter ? n < 0 : n > 0;
  return improved ? GREEN : RED;
}

/** Extrae el primer número flotante de strings como "88.06%", "0.154", "12 rows" */
function parseNumericValue(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/**
 * Calcula el chip de delta para issues persistentes.
 * - Usa actual_value de ambas versiones si son parseables.
 * - Fallback: usa row_count_delta.
 * - Color: rojo si empeoró (más filas afectadas), verde si mejoró, gris si igual/desconocido.
 */
function buildPersistentDelta(
  prevActual: string | null | undefined,
  currActual: string | null | undefined,
  rowCountDelta: number | null | undefined,
): { text: string; color: string } | null {
  const prev = parseNumericValue(prevActual);
  const curr = parseNumericValue(currActual);
  const isPercent = (s?: string | null) => typeof s === 'string' && s.includes('%');

  if (prev !== null && curr !== null && prev !== curr) {
    const delta = curr - prev;
    const sign  = delta > 0 ? '+' : '';
    const unit  = isPercent(prevActual) || isPercent(currActual) ? 'pp' : '';
    const text  = `${sign}${delta.toFixed(2)}${unit}`;
    // Direction: for row-count-based issues, more rows = worse.
    // For percentage metrics (completeness, etc.) higher is generally better.
    // We use row_count_delta as the ground truth for color when available.
    let color: string;
    if (rowCountDelta != null) {
      color = rowCountDelta > 0 ? RED : rowCountDelta < 0 ? GREEN : GRAY;
    } else {
      // Heuristic: for % values, higher = better (completeness, uniqueness…)
      color = isPercent(prevActual) || isPercent(currActual)
        ? (delta < 0 ? RED : GREEN)
        : GRAY;
    }
    return { text, color };
  }

  // Fallback to row count delta when no parseable actual_value change
  if (rowCountDelta != null && rowCountDelta !== 0) {
    const sign = rowCountDelta > 0 ? '+' : '';
    return {
      text:  `${sign}${rowCountDelta} filas`,
      color: rowCountDelta > 0 ? RED : GREEN,
    };
  }

  return null;
}

// ─── sub-componentes ──────────────────────────────────────────────────────

/** Columna de versión (izq o der) */
const VersionColumn: React.FC<{
  ds: Dataset & { latestAnalysis?: any };
  label: string;
  side: 'left' | 'right';
  datasetId: string | string[] | undefined;
}> = ({ ds, label, side, datasetId }) => {
  const router = useRouter();
  const score    = ds.latestAnalysis?.quality_score ?? null;
  const status   = ds.latestAnalysis?.quality_gate_status ?? null;
  const issues   = ds.latestAnalysis?.total_issues_count ?? null;
  const color    = gateColor(status);
  const vLabel   = ds.version_tag || `v${ds.version}`;

  return (
    <Box sx={{
      flex: 1,
      p: 3,
      borderRight: side === 'left' ? '1px solid #F0F0F0' : 'none',
      borderLeft:  side === 'right' ? '1px solid #F0F0F0' : 'none',
    }}>
      {/* Role label */}
      <Typography sx={{
        fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: '#BBBBBB', mb: 1,
      }}>
        {label}
      </Typography>

      {/* Version chip + Latest badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{
          px: 1.25, py: 0.3,
          borderRadius: '6px',
          backgroundColor: `${color}12`,
          border: `1px solid ${color}35`,
        }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color }}>
            {vLabel}
          </Typography>
        </Box>
        {ds.is_latest && (
          <Box sx={{
            px: 1, py: 0.2,
            borderRadius: '4px',
            backgroundColor: 'rgba(25,118,210,0.08)',
            border: '1px solid rgba(25,118,210,0.2)',
          }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#1976d2' }}>
              LATEST
            </Typography>
          </Box>
        )}
      </Box>

      {/* Dataset name */}
      <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#1A1A1A', mb: 2.5, lineHeight: 1.3 }}>
        {ds.name}
      </Typography>

      {/* Score */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <GateIcon status={status} size={20} />
        <Typography sx={{
          fontSize: '2rem', fontWeight: 700, lineHeight: 1,
          color: score !== null ? color : '#CCC',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {score !== null ? `${Number(score).toFixed(1)}%` : '—'}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.72rem', color: GRAY, mb: 2.5 }}>
        Quality Score
        {status && (
          <Box component="span" sx={{
            ml: 1, px: 0.75, py: 0.1,
            borderRadius: '4px',
            backgroundColor: `${color}12`,
            color, fontWeight: 700, fontSize: '0.65rem',
          }}>
            {status}
          </Box>
        )}
      </Typography>

      {/* Metadata row */}
      <Box sx={{
        display: 'flex', gap: 2.5,
        pt: 2, borderTop: '1px solid #F5F5F5',
      }}>
        <Stat label="Filas"     value={(ds.row_count ?? 0).toLocaleString()} />
        <Stat label="Columnas"  value={String(ds.column_count ?? '—')} />
        {issues !== null && (
          <Stat label="Issues" value={String(issues)} valueColor={issues > 0 ? RED : GREEN} />
        )}
      </Box>

      {/* Navigate button */}
      <Box sx={{ mt: 2.5 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => router.push(`/datasets/${datasetId}`)}
          sx={{
            fontSize: '0.75rem', textTransform: 'none', fontWeight: 500,
            borderColor: '#E0E0E0', color: '#555',
            '&:hover': { borderColor: '#BBBBBB', backgroundColor: '#FAFAFA' },
          }}
        >
          Ver {vLabel}
        </Button>
      </Box>
    </Box>
  );
};

const Stat: React.FC<{ label: string; value: string; valueColor?: string }> = ({
  label, value, valueColor,
}) => (
  <Box>
    <Typography sx={{ fontSize: '0.65rem', color: '#BBBBBB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, color: valueColor || '#333' }}>
      {value}
    </Typography>
  </Box>
);

/** Columna central de deltas */
const DeltaColumn: React.FC<{
  scoreDiff: number | null;
  issuesDiff: number;
  rowsDiff: number;
  colsDiff: number;
}> = ({ scoreDiff, issuesDiff, rowsDiff, colsDiff }) => {
  const deltaItems = [
    {
      label: 'Calidad',
      sublabel: 'Score de calidad',
      value: fmtDiff(scoreDiff, '%'),
      color: diffColor(scoreDiff),
      tooltip: scoreDiff === null ? 'Sin datos' : scoreDiff > 0
        ? `Mejoró ${scoreDiff}%`
        : scoreDiff < 0
        ? `Empeoró ${Math.abs(scoreDiff)}%`
        : 'Sin cambios',
    },
    {
      label: 'Issues',
      sublabel: 'Problemas detectados',
      value: issuesDiff === 0 ? '0' : issuesDiff > 0 ? `+${issuesDiff} más` : `${Math.abs(issuesDiff)} menos`,
      color: diffColor(issuesDiff, true),
      tooltip: issuesDiff === 0
        ? 'Sin cambios en issues'
        : issuesDiff > 0
        ? `Aparecieron ${issuesDiff} issues nuevos`
        : `Se resolvieron ${Math.abs(issuesDiff)} issues`,
    },
    {
      label: 'Filas',
      sublabel: 'Registros',
      value: rowsDiff === 0 ? '0' : rowsDiff > 0 ? `+${rowsDiff}` : `${rowsDiff}`,
      color: '#AAAAAA',
      tooltip: rowsDiff === 0 ? 'Mismas filas' : rowsDiff > 0 ? `${rowsDiff} filas añadidas` : `${Math.abs(rowsDiff)} filas eliminadas`,
    },
    {
      label: 'Columnas',
      sublabel: 'Campos',
      value: colsDiff === 0 ? '0' : colsDiff > 0 ? `+${colsDiff}` : `${colsDiff}`,
      color: '#AAAAAA',
      tooltip: colsDiff === 0 ? 'Mismas columnas' : colsDiff > 0 ? `${colsDiff} columnas añadidas` : `${Math.abs(colsDiff)} columnas eliminadas`,
    },
  ];

  return (
    <Box sx={{
      width: 130, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      px: 1.5, gap: 1.75,
    }}>
      {/* Arrow */}
      <Box sx={{
        width: 36, height: 36,
        borderRadius: '50%',
        backgroundColor: '#F5F5F5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ArrowForwardIcon sx={{ fontSize: 18, color: '#BBBBBB' }} />
      </Box>

      {/* Delta pills */}
      {deltaItems.map(({ label, sublabel, value, color, tooltip }) => (
        <Tooltip key={label} title={tooltip} placement="right" arrow>
          <Box sx={{ textAlign: 'center', cursor: 'default' }}>
            <Typography sx={{ fontSize: '0.58rem', color: '#BBBBBB', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.1 }}>
              {label}
            </Typography>
            <Typography sx={{
              fontSize: '0.85rem', fontWeight: 700, color,
              fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
            }}>
              {value}
            </Typography>
            <Typography sx={{ fontSize: '0.56rem', color: '#CCCCCC', mt: 0.1 }}>
              {sublabel}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
};

/** Fila de issue en la lista */
const IssueRow: React.FC<{ issue: any; resolved?: boolean }> = ({ issue, resolved = false }) => {
  const color = severityColor(issue.severity);
  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', gap: 1.25,
      py: 1, borderBottom: '1px solid #F8F8F8',
      '&:last-child': { borderBottom: 'none' },
    }}>
      <Tooltip title={issue.severity} placement="top">
        <Box sx={{
          width: 7, height: 7, borderRadius: '50%',
          backgroundColor: color,
          mt: '5px', flexShrink: 0,
        }} />
      </Tooltip>
      <Typography sx={{
        fontSize: '0.8rem',
        color: resolved ? '#AAAAAA' : '#333',
        textDecoration: resolved ? 'line-through' : 'none',
        lineHeight: 1.45,
      }}>
        {issue.description}
      </Typography>
    </Box>
  );
};

/** Fila de issue persistente con chip de delta entre versiones */
const PersistentIssueRow: React.FC<{ issue: any }> = ({ issue }) => {
  const color = severityColor(issue.severity);
  const delta = buildPersistentDelta(
    issue.previous_actual_value,
    issue.actual_value,
    issue.row_count_delta,
  );
  const tooltipTitle = issue.previous_actual_value
    ? `Versión anterior: ${issue.previous_actual_value}`
    : issue.previous_affected_row_count != null
    ? `Versión anterior: ${issue.previous_affected_row_count} filas afectadas`
    : '';

  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: 1.25, py: 1, borderBottom: '1px solid #F8F8F8',
      '&:last-child': { borderBottom: 'none' },
    }}>
      {/* Severity dot + description */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, flex: 1, minWidth: 0 }}>
        <Tooltip title={issue.severity} placement="top">
          <Box sx={{
            width: 7, height: 7, borderRadius: '50%',
            backgroundColor: color,
            mt: '5px', flexShrink: 0,
          }} />
        </Tooltip>
        <Typography sx={{ fontSize: '0.8rem', color: '#333', lineHeight: 1.45 }}>
          {issue.description}
        </Typography>
      </Box>
      {/* Delta chip */}
      {delta && (
        <Tooltip title={tooltipTitle} placement="top" arrow>
          <Box sx={{
            px: 1, py: 0.2,
            borderRadius: '5px',
            backgroundColor: `${delta.color}12`,
            border: `1px solid ${delta.color}35`,
            flexShrink: 0,
            cursor: 'default',
          }}>
            <Typography sx={{
              fontSize: '0.68rem', fontWeight: 700,
              color: delta.color,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}>
              {delta.text}
            </Typography>
          </Box>
        </Tooltip>
      )}
    </Box>
  );
};

// ─── página principal ─────────────────────────────────────────────────────
const DatasetCompare = () => {
  const router = useRouter();
  const { a, b, projectId } = router.query;

  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [data, setData]                     = useState<ComparisonData | null>(null);

  useEffect(() => {
    if (!a || !b || !projectId) return;
    setLoading(true);
    datasetsAPI
      .compareDatasetVersions(Number(projectId), Number(a), Number(b))
      .then(res => {
        setData(res?.data?.data || res?.data || null);
        setError(null);
      })
      .catch(() => setError('No se pudo cargar la comparación de versiones'))
      .finally(() => setLoading(false));
  }, [a, b, projectId]);

  if (loading) {
    return (
      <MainLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress size={28} sx={{ color: GREEN }} />
        </Box>
      </MainLayout>
    );
  }

  if (error || !data) {
    return (
      <MainLayout>
        <Box sx={{ p: 3, maxWidth: 480 }}>
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error || 'No se encontraron datos de comparación'}
          </Alert>
          <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()}
            sx={{ textTransform: 'none', color: GRAY }}>
            Volver
          </Button>
        </Box>
      </MainLayout>
    );
  }

  const { dataset_a, dataset_b, comparison } = data;
  const hasColumnChanges =
    (comparison.added_columns?.length ?? 0) > 0 ||
    (comparison.removed_columns?.length ?? 0) > 0;
  const resolvedCount = comparison.resolved_issues?.length ?? 0;
  const newCount      = comparison.new_issues?.length ?? 0;
  const commonCount   = comparison.common_issues?.length ?? 0;

  return (
    <MainLayout>
      <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>

        {/* ── Version comparison card ── */}
        <Box sx={{
          display: 'flex',
          border: '1px solid #EEEEEE',
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: '#fff',
          mb: 3,
        }}>
          <VersionColumn ds={dataset_a} label="Versión anterior" side="left"  datasetId={a} />
          <DeltaColumn
            scoreDiff={comparison.quality_score_diff}
            issuesDiff={comparison.issues_diff}
            rowsDiff={comparison.rows_diff}
            colsDiff={comparison.columns_diff}
          />
          <VersionColumn ds={dataset_b} label="Versión actual"   side="right" datasetId={b} />
        </Box>

        {/* ── Column diff (if any) ── */}
        {hasColumnChanges && (
          <Box sx={{
            display: 'flex', gap: 3,
            border: '1px solid #EEEEEE',
            borderRadius: 2, p: 2.5, mb: 3,
            backgroundColor: '#fff',
          }}>
            {comparison.added_columns && comparison.added_columns.length > 0 && (
              <Box sx={{ flex: 1 }}>
                <Typography sx={{
                  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.07em', color: GREEN, mb: 1.25,
                }}>
                  + {comparison.added_columns.length} columna{comparison.added_columns.length !== 1 ? 's' : ''} añadida{comparison.added_columns.length !== 1 ? 's' : ''}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {comparison.added_columns.map(col => (
                    <Box key={col} sx={{
                      px: 1.1, py: 0.3,
                      borderRadius: '5px',
                      border: `1px solid ${GREEN}35`,
                      backgroundColor: `${GREEN}08`,
                    }}>
                      <Typography sx={{ fontSize: '0.76rem', fontWeight: 500, color: GREEN }}>
                        {col}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
            {hasColumnChanges && comparison.added_columns?.length && comparison.removed_columns?.length ? (
              <Box sx={{ width: '1px', backgroundColor: '#F0F0F0', flexShrink: 0 }} />
            ) : null}
            {comparison.removed_columns && comparison.removed_columns.length > 0 && (
              <Box sx={{ flex: 1 }}>
                <Typography sx={{
                  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.07em', color: RED, mb: 1.25,
                }}>
                  − {comparison.removed_columns.length} columna{comparison.removed_columns.length !== 1 ? 's' : ''} eliminada{comparison.removed_columns.length !== 1 ? 's' : ''}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {comparison.removed_columns.map(col => (
                    <Box key={col} sx={{
                      px: 1.1, py: 0.3,
                      borderRadius: '5px',
                      border: `1px solid ${RED}35`,
                      backgroundColor: `${RED}08`,
                    }}>
                      <Typography sx={{ fontSize: '0.76rem', fontWeight: 500, color: RED }}>
                        {col}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* ── Issues diff ── */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
        }}>
          {/* Resueltos */}
          <Box sx={{
            border: '1px solid #EEEEEE',
            borderRadius: 2,
            overflow: 'hidden',
            backgroundColor: '#fff',
          }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 2.5, py: 1.75,
              borderBottom: resolvedCount > 0 ? '1px solid #F5F5F5' : 'none',
              backgroundColor: resolvedCount > 0 ? `${GREEN}06` : '#FAFAFA',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon sx={{ fontSize: 16, color: resolvedCount > 0 ? GREEN : '#CCC' }} />
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A1A1A' }}>
                  Issues resueltos
                </Typography>
              </Box>
              <Box sx={{
                px: 1, py: 0.15,
                borderRadius: '10px',
                backgroundColor: resolvedCount > 0 ? `${GREEN}15` : '#F0F0F0',
              }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: resolvedCount > 0 ? GREEN : '#AAAAAA' }}>
                  {resolvedCount}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ px: 2.5, py: resolvedCount > 0 ? 1.5 : 3, maxHeight: 320, overflowY: 'auto' }}>
              {resolvedCount > 0 ? (
                comparison.resolved_issues.map((issue: any, i: number) => (
                  <IssueRow key={i} issue={issue} resolved />
                ))
              ) : (
                <Typography sx={{ textAlign: 'center', color: '#CCCCCC', fontSize: '0.82rem' }}>
                  Sin issues resueltos
                </Typography>
              )}
            </Box>
          </Box>

          {/* Nuevos */}
          <Box sx={{
            border: '1px solid #EEEEEE',
            borderRadius: 2,
            overflow: 'hidden',
            backgroundColor: '#fff',
          }}>
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 2.5, py: 1.75,
              borderBottom: newCount > 0 ? '1px solid #F5F5F5' : 'none',
              backgroundColor: newCount > 0 ? `${RED}05` : '#FAFAFA',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ErrorIcon sx={{ fontSize: 16, color: newCount > 0 ? RED : '#CCC' }} />
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A1A1A' }}>
                  Issues nuevos
                </Typography>
              </Box>
              <Box sx={{
                px: 1, py: 0.15,
                borderRadius: '10px',
                backgroundColor: newCount > 0 ? `${RED}15` : '#F0F0F0',
              }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: newCount > 0 ? RED : '#AAAAAA' }}>
                  {newCount}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ px: 2.5, py: newCount > 0 ? 1.5 : 3, maxHeight: 320, overflowY: 'auto' }}>
              {newCount > 0 ? (
                comparison.new_issues.map((issue: any, i: number) => (
                  <IssueRow key={i} issue={issue} />
                ))
              ) : (
                <Typography sx={{ textAlign: 'center', color: '#CCCCCC', fontSize: '0.82rem' }}>
                  Sin issues nuevos
                </Typography>
              )}
            </Box>
          </Box>
        </Box>

        {/* ── Issues comunes ── */}
        <Box sx={{
          mt: 2,
          border: '1px solid #EEEEEE',
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: '#fff',
        }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2.5, py: 1.75,
            borderBottom: commonCount > 0 ? '1px solid #F5F5F5' : 'none',
            backgroundColor: commonCount > 0 ? `${ORANGE}06` : '#FAFAFA',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WarningAmberIcon sx={{ fontSize: 16, color: commonCount > 0 ? ORANGE : '#CCC' }} />
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A1A1A' }}>
                Issues persistentes
              </Typography>
            </Box>
            <Box sx={{
              px: 1, py: 0.15,
              borderRadius: '10px',
              backgroundColor: commonCount > 0 ? `${ORANGE}18` : '#F0F0F0',
            }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: commonCount > 0 ? ORANGE : '#AAAAAA' }}>
                {commonCount}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ px: 2.5, py: commonCount > 0 ? 1.5 : 3, maxHeight: 320, overflowY: 'auto' }}>
            {commonCount > 0 ? (
              comparison.common_issues.map((issue: any, i: number) => (
                <PersistentIssueRow key={i} issue={issue} />
              ))
            ) : (
              <Typography sx={{ textAlign: 'center', color: '#CCCCCC', fontSize: '0.82rem' }}>
                Sin issues persistentes
              </Typography>
            )}
          </Box>
        </Box>

      </Box>
    </MainLayout>
  );
};

export default DatasetCompare;
