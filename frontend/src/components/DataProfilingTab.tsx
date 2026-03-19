import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Scatter } from 'react-chartjs-2';
import {
  Box,
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Storage as StorageIcon,
  BarChart as BarChartIcon,
  BubbleChart as BubbleChartIcon,
  GridOn as GridOnIcon,
  Warning as WarningIcon,
  ViewColumn as ViewColumnIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { datasetsAPI } from '../services/api';
import type { DataProfilingResult, ProfilingColumn, ColumnMetrics } from '../types';
import MetricDetailsTabs from './evaluations/MetricDetailsTabs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

interface DataProfilingTabProps {
  datasetId: number;
}

// ── Shared style constants ──────────────────────────────────────
const sectionPaper = {
  elevation: 0,
  sx: { p: 3, mb: 3, borderRadius: 2, border: '1px solid #EEEEEE' },
} as const;

const sectionHeader = (icon: React.ReactNode, title: string, subtitle?: string) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
    {icon}
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{title}</Typography>
      {subtitle && (
        <Typography variant="caption" sx={{ color: '#888' }}>{subtitle}</Typography>
      )}
    </Box>
  </Box>
);

// ── Helpers ─────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getSubTypeLabel(sub: string): string {
  const map: Record<string, string> = {
    continuous: 'Continua',
    discrete: 'Discreta',
    binary: 'Binaria',
    nominal: 'Nominal',
    text: 'Texto',
  };
  return map[sub] || sub;
}

function getCategoryColor(cat: string): string {
  return cat === 'numeric' ? '#1976d2' : '#7b1fa2';
}

function getCompletenessColor(val: number): string {
  if (val >= 98) return '#00B37E';
  if (val >= 90) return '#FFB800';
  return '#E5484D';
}

// Diverging colour scale for correlation: -1 → blue, 0 → white, 1 → red
function correlationColor(v: number): { bg: string; text: string } {
  const abs = Math.abs(v);
  if (abs < 0.05) return { bg: '#FAFAFA', text: '#999' };

  if (v > 0) {
    const r = Math.round(220 - abs * 180);
    const g = Math.round(235 - abs * 180);
    return { bg: `rgb(${255 - Math.round(abs * 50)}, ${r}, ${r})`, text: abs > 0.5 ? '#fff' : '#333' };
  }
  const b = Math.round(220 - abs * 180);
  return { bg: `rgb(${b}, ${b}, ${255 - Math.round(abs * 50)})`, text: abs > 0.5 ? '#fff' : '#333' };
}

function formatStat(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// ── Main Component ──────────────────────────────────────────────
const DataProfilingTab: React.FC<DataProfilingTabProps> = ({ datasetId }) => {
  const [profiling, setProfiling] = useState<DataProfilingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scatter-plot selectors
  const [scatterX, setScatterX] = useState<string>('');
  const [scatterY, setScatterY] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const fetchProfiling = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await datasetsAPI.getDatasetProfiling(datasetId);
        if (!cancelled) {
          const data = res.data?.data ?? res.data;
          setProfiling(data as DataProfilingResult);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Error al cargar el profiling del dataset.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchProfiling();
    return () => { cancelled = true; };
  }, [datasetId]);

  // Set default scatter axes once data arrives
  useEffect(() => {
    if (profiling && profiling.type_summary.numeric_columns.length >= 2) {
      const nums = profiling.type_summary.numeric_columns;
      setScatterX(nums[0]);
      setScatterY(nums[1]);
    }
  }, [profiling]);

  // ── Transform profiling data → evaluation component format ────
  const { evalColumnMetrics, evalOverallMetrics } = useMemo(() => {
    if (!profiling) return { evalColumnMetrics: {} as Record<string, ColumnMetrics>, evalOverallMetrics: {} as Record<string, any> };

    const cm: Record<string, ColumnMetrics> = {};
    const outliers: Record<string, any> = {};

    for (const col of profiling.columns) {
      cm[col.name] = {
        completeness: col.n_valid > 0 || col.n_missing > 0 ? (col.n_valid / (col.n_valid + col.n_missing)) : 1,
        uniqueness: col.n_valid > 0 ? col.n_unique / col.n_valid : 1,
        n_nulls: col.n_missing,
        n_non_nulls: col.n_valid,
        n_unique: col.n_unique,
        type: col.dtype,
        min: col.min ?? undefined,
        max: col.max ?? undefined,
        mean: col.mean ?? undefined,
        median: col.median ?? undefined,
        std: col.std ?? undefined,
        histogram: col.histogram ?? undefined,
      };

      if (col.category === 'numeric' && col.boxplot && col.boxplot.outlier_count > 0) {
        outliers[col.name] = {
          count: col.boxplot.outlier_count,
          total_values: col.n_valid,
          proportion: col.n_valid > 0 ? col.boxplot.outlier_count / col.n_valid : 0,
          q1: col.q1,
          q3: col.q3,
          median: col.median,
          iqr: col.iqr,
          mean: col.mean,
          lower_bound: col.boxplot.lower_fence,
          upper_bound: col.boxplot.upper_fence,
          series_min: col.min,
          series_max: col.max,
          sample_values: col.boxplot.outliers_sample,
        };
      }
    }

    const ov = profiling.overview;
    const overallCompleteness = ov.total_cells > 0 ? (ov.total_cells - ov.total_missing) / ov.total_cells : 1;
    const overallUniqueness = ov.total_rows > 0 ? (ov.total_rows - ov.duplicate_rows) / ov.total_rows : 1;

    return {
      evalColumnMetrics: cm,
      evalOverallMetrics: {
        completeness: overallCompleteness,
        uniqueness: overallUniqueness,
        ...(Object.keys(outliers).length > 0 ? { outliers } : {}),
      } as Record<string, any>,
    };
  }, [profiling]);

  // ── Render states ─────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
        <CircularProgress sx={{ color: '#00B37E' }} />
        <Typography variant="body2" sx={{ color: '#666' }}>
          Generando análisis exploratorio…
        </Typography>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;
  }

  if (!profiling) {
    return <Alert severity="info" sx={{ mt: 2 }}>No hay datos de profiling disponibles.</Alert>;
  }

  const { overview, type_summary, columns, correlation_matrix } = profiling;

  // ── Helper: executive metric card ─────────────────────────────
  const MetricCard = ({ title, value, badge, insight }: {
    title: string;
    value: string;
    badge: { label: string; bg: string; color: string };
    insight: string;
  }) => (
    <Paper
      elevation={0}
      onClick={() => {
        const el = document.getElementById('profiling-metric-details');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
      sx={{
        p: 3, border: '1px solid #EEEEEE', borderRadius: 2, cursor: 'pointer',
        transition: 'all 0.2s', '&:hover': { borderColor: '#1976d2', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', fontSize: '0.875rem' }}>{title}</Typography>
        <Chip label={badge.label} size="small" sx={{ backgroundColor: badge.bg, color: badge.color, fontWeight: 500, fontSize: '0.7rem', height: 20 }} />
      </Box>
      <Typography variant="h3" sx={{ fontWeight: 700, color: badge.color, mb: 1.5, lineHeight: 1 }}>{value}</Typography>
      <Typography variant="body2" sx={{ color: '#555', mb: 2, fontSize: '0.875rem', minHeight: '2.5em' }}>{insight}</Typography>
      <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 500, fontSize: '0.75rem' }}>Ver detalle →</Typography>
    </Paper>
  );

  // ── Executive metrics data ────────────────────────────────────
  const compVal = evalOverallMetrics.completeness ?? 1;
  const compPct = (compVal * 100).toFixed(1);
  const nullColumns = Object.values(evalColumnMetrics).filter((c: any) => (c.n_nulls || 0) > 0).length;
  const totalColumns = Object.keys(evalColumnMetrics).length;
  const compBadge = compVal >= 0.98 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
    : compVal >= 0.90 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
    : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' };

  const uniqVal = evalOverallMetrics.uniqueness ?? 1;
  const uniqPct = (uniqVal * 100).toFixed(1);
  const uniqBadge = overview.duplicate_rows === 0 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
    : overview.duplicate_rows <= 2 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
    : { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' };

  const outlierData = evalOverallMetrics.outliers || {};
  const totalOutliers = Object.values(outlierData).reduce((sum: number, col: any) => sum + (col?.count || 0), 0);
  const totalOutlierValues = Object.values(outlierData).reduce((sum: number, col: any) => sum + (col?.total_values || 0), 0);
  const outlierProportion = totalOutlierValues > 0 ? totalOutliers / totalOutlierValues : 0;
  const outlierCols = Object.entries(outlierData).filter(([_, col]: [string, any]) => col?.count > 0).length;
  const outBadge = outlierProportion >= 0.05 ? { label: 'Crítico', bg: 'rgba(229, 72, 77, 0.1)', color: '#E5484D' }
    : outlierProportion >= 0.02 ? { label: 'Requiere atención', bg: 'rgba(255, 184, 0, 0.1)', color: '#FFB800' }
    : totalOutliers === 0 ? { label: 'Excelente', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' }
    : { label: 'Aceptable', bg: 'rgba(0, 179, 126, 0.1)', color: '#00B37E' };

  const numericPct = overview.total_columns > 0 ? Math.round((type_summary.numeric_count / overview.total_columns) * 100) : 0;
  const categoricalPct = 100 - numericPct;

  // ── Final render ──────────────────────────────────────────────
  return (
    <Box>
      {/* ════════════════════════════════════════════════════════════
          SECTION 1 – Overview + Metrics Summary
          ════════════════════════════════════════════════════════════ */}
      <Paper {...sectionPaper}>
        {sectionHeader(<StorageIcon sx={{ color: '#00B37E' }} />, 'Visión General del Dataset')}

        {/* Volumetry row */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Filas', value: overview.total_rows.toLocaleString(), icon: '📊' },
            { label: 'Columnas', value: String(overview.total_columns), icon: '📋' },
            { label: 'Tamaño', value: formatBytes(overview.estimated_size_bytes), icon: '💾' },
            { label: 'Celdas', value: overview.total_cells.toLocaleString(), icon: '🔢' },
          ].map(({ label, value }) => (
            <Grid item xs={6} sm={3} key={label}>
              <Box sx={{
                p: 2, textAlign: 'center', bgcolor: '#FAFAFA', borderRadius: 2,
                border: '1px solid #F0F0F0',
              }}>
                <Typography variant="caption" sx={{ color: '#888', fontWeight: 500, display: 'block', mb: 0.5 }}>{label}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#333' }}>{value}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Metrics Summary subtitle */}
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#333', display: 'flex', alignItems: 'center', gap: 1 }}>
          Metrics Summary
        </Typography>

        {/* Executive metric cards */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <MetricCard
              title="Completeness"
              value={`${compPct}%`}
              badge={compBadge}
              insight={nullColumns > 0 ? `${nullColumns} de ${totalColumns} columnas tienen valores nulos` : 'Todas las columnas están completas'}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MetricCard
              title="Uniqueness"
              value={`${uniqPct}%`}
              badge={uniqBadge}
              insight={overview.duplicate_rows > 0
                ? `${overview.duplicate_rows.toLocaleString()} fila${overview.duplicate_rows !== 1 ? 's' : ''} completamente duplicada${overview.duplicate_rows !== 1 ? 's' : ''}`
                : 'Sin filas duplicadas detectadas'}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MetricCard
              title="Outliers"
              value={String(totalOutliers)}
              badge={outBadge}
              insight={totalOutliers === 0
                ? 'Sin valores atípicos detectados'
                : `${outlierCols} columna${outlierCols !== 1 ? 's' : ''} afectada${outlierCols !== 1 ? 's' : ''} (${(outlierProportion * 100).toFixed(1)}% del total)`}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* ════════════════════════════════════════════════════════════
          SECTION 2 – Metric Details (reuses evaluation components)
          ════════════════════════════════════════════════════════════ */}
      <Paper id="profiling-metric-details" elevation={0} sx={{ mb: 3, borderRadius: 2, border: '1px solid #EEEEEE', scrollMarginTop: '80px' }}>
        <MetricDetailsTabs
          overallMetrics={evalOverallMetrics}
          columnMetrics={evalColumnMetrics}
        />
      </Paper>

      {/* ════════════════════════════════════════════════════════════
          SECTION 3 – Type Summary
          ════════════════════════════════════════════════════════════ */}
      <Paper {...sectionPaper}>
        {sectionHeader(
          <ViewColumnIcon sx={{ color: '#1976d2' }} />,
          'Tipos de Datos',
          `${overview.total_columns} columnas · ${type_summary.numeric_count} numéricas · ${type_summary.categorical_count} categóricas`
        )}

        {/* Type proportion bar */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
            <Box sx={{ width: `${numericPct}%`, bgcolor: '#1976d2', transition: 'width 0.3s' }} />
            <Box sx={{ width: `${categoricalPct}%`, bgcolor: '#7b1fa2', transition: 'width 0.3s' }} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#1976d2' }} />
              <Typography variant="caption" sx={{ color: '#666' }}>Numéricas {numericPct}%</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#7b1fa2' }} />
              <Typography variant="caption" sx={{ color: '#666' }}>Categóricas {categoricalPct}%</Typography>
            </Box>
          </Box>
        </Box>

        {/* Column type table */}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#F5F5F5' }}>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Columna</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Tipo</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Subtipo</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Únicos</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 120 }}>Completitud</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {columns.map((col) => {
                const compPctCol = 100 - col.missing_percent;
                return (
                  <TableRow key={col.name} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{col.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={col.category === 'numeric' ? 'NUM' : 'CAT'}
                        size="small"
                        sx={{
                          fontWeight: 700, fontSize: '0.65rem', minWidth: 38, height: 22,
                          bgcolor: getCategoryColor(col.category) + '18',
                          color: getCategoryColor(col.category),
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: '#666' }}>{getSubTypeLabel(col.sub_type)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#555' }}>
                        {col.n_unique.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 50 }}>
                          <LinearProgress
                            variant="determinate"
                            value={compPctCol}
                            sx={{
                              height: 6, borderRadius: 3, backgroundColor: '#EEEEEE',
                              '& .MuiLinearProgress-bar': { backgroundColor: getCompletenessColor(compPctCol), borderRadius: 3 },
                            }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: getCompletenessColor(compPctCol), minWidth: 36, textAlign: 'right' }}>
                          {compPctCol.toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ════════════════════════════════════════════════════════════
          SECTION 4 – Per-column Analysis
          ════════════════════════════════════════════════════════════ */}
      <Paper {...sectionPaper}>
        {sectionHeader(
          <BarChartIcon sx={{ color: '#00B37E' }} />,
          'Análisis por Columna',
          'Estadísticas descriptivas y distribuciones'
        )}

        {columns.map((col) => (
          <Accordion
            key={col.name}
            disableGutters
            elevation={0}
            sx={{
              border: '1px solid #E8E8E8',
              borderRadius: '8px !important',
              mb: 1.5,
              '&::before': { display: 'none' },
              overflow: 'hidden',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, py: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                <Chip
                  label={col.category === 'numeric' ? 'NUM' : 'CAT'}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: '0.65rem', minWidth: 38, height: 22,
                    bgcolor: getCategoryColor(col.category) + '18',
                    color: getCategoryColor(col.category),
                  }}
                />
                <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>{col.name}</Typography>
                <Chip label={getSubTypeLabel(col.sub_type)} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 22, borderColor: '#DDD' }} />
                {col.missing_percent > 0 ? (
                  <Tooltip title={`${col.missing_percent}% valores nulos`}>
                    <Chip
                      label={`${col.missing_percent.toFixed(1)}% nulls`}
                      size="small"
                      sx={{
                        height: 22, fontSize: '0.65rem', fontWeight: 500,
                        bgcolor: col.missing_percent > 10 ? 'rgba(229,72,77,0.08)' : col.missing_percent > 3 ? 'rgba(255,184,0,0.08)' : 'rgba(0,179,126,0.08)',
                        color: col.missing_percent > 10 ? '#E5484D' : col.missing_percent > 3 ? '#FFB800' : '#00B37E',
                      }}
                    />
                  </Tooltip>
                ) : (
                  <CheckCircleIcon sx={{ color: '#00B37E', fontSize: 16 }} />
                )}
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ px: 2.5, pb: 3, pt: 0 }}>
              {/* Completeness bar */}
              <Box sx={{ mb: 2.5, p: 1.5, bgcolor: '#FAFAFA', borderRadius: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#555' }}>Completitud</Typography>
                  <Typography variant="caption" sx={{ color: '#888' }}>
                    {col.n_valid.toLocaleString()} válidos · {col.n_missing.toLocaleString()} nulos
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={100 - col.missing_percent}
                      sx={{
                        height: 6, borderRadius: 3, bgcolor: '#E0E0E0',
                        '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: getCompletenessColor(100 - col.missing_percent) },
                      }}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: getCompletenessColor(100 - col.missing_percent), minWidth: 40, textAlign: 'right' }}>
                    {(100 - col.missing_percent).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>

              {col.category === 'numeric' ? (
                <>
                  {/* Stat cards grid */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 1.5, mb: 2.5 }}>
                    {[
                      { label: 'Media', value: col.mean, color: '#333' },
                      { label: 'Mediana', value: col.median, color: '#1B5E20' },
                      { label: 'Desv. Est.', value: col.std, color: '#333' },
                      { label: 'Mínimo', value: col.min, color: '#555' },
                      { label: 'Máximo', value: col.max, color: '#555' },
                      { label: 'Q1', value: col.q1, color: '#2E7D32' },
                      { label: 'Q3', value: col.q3, color: '#2E7D32' },
                      { label: 'IQR', value: col.iqr, color: '#1976d2' },
                    ].map(({ label, value, color }) => (
                      <Box key={label} sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 1, border: '1px solid #EEEEEE' }}>
                        <Typography variant="caption" sx={{ color: '#888', display: 'block', fontSize: '0.65rem' }}>{label}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', color, fontSize: '0.8rem' }}>
                          {formatStat(value)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* Charts row */}
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      {col.histogram && col.histogram.bins.length > 0 ? (
                        <Box sx={{ p: 2, border: '1px solid #EEEEEE', borderRadius: 2, bgcolor: '#fff' }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#555', display: 'block', mb: 1 }}>
                            Distribución (Histograma)
                          </Typography>
                          <Box sx={{ height: 200 }}>
                            <Bar
                              data={{
                                labels: col.histogram.bins.map(b => b.toFixed(1)),
                                datasets: [{
                                  data: col.histogram.counts,
                                  backgroundColor: 'rgba(25, 118, 210, 0.55)',
                                  borderColor: 'rgba(25, 118, 210, 0.8)',
                                  borderWidth: 1,
                                  borderRadius: 2,
                                }],
                              }}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
                                scales: {
                                  x: { display: true, grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 9 }, color: '#999' } },
                                  y: { display: true, beginAtZero: true, grid: { color: '#F0F0F0' }, ticks: { font: { size: 9 }, color: '#999' } },
                                },
                              }}
                            />
                          </Box>
                        </Box>
                      ) : (
                        <Box sx={{ p: 3, border: '1px dashed #E0E0E0', borderRadius: 2, textAlign: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#999' }}>Sin datos para histograma</Typography>
                        </Box>
                      )}
                    </Grid>

                    <Grid item xs={12} md={6}>
                      {col.boxplot ? (
                        <Box sx={{ p: 2, border: '1px solid #EEEEEE', borderRadius: 2, bgcolor: '#fff' }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#555', display: 'block', mb: 1 }}>
                            Boxplot
                          </Typography>
                          <MiniBoxplot boxplot={col.boxplot} />
                        </Box>
                      ) : (
                        <Box sx={{ p: 3, border: '1px dashed #E0E0E0', borderRadius: 2, textAlign: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#999' }}>Sin datos para boxplot</Typography>
                        </Box>
                      )}
                    </Grid>
                  </Grid>
                </>
              ) : (
                /* ── Categorical column ── */
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                      <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 1, border: '1px solid #EEEEEE' }}>
                        <Typography variant="caption" sx={{ color: '#888', display: 'block', fontSize: '0.65rem' }}>Valores únicos</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', color: '#333' }}>
                          {col.n_unique.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: 1, border: '1px solid #EEEEEE' }}>
                        <Typography variant="caption" sx={{ color: '#888', display: 'block', fontSize: '0.65rem' }}>Moda</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#7b1fa2', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                          {col.mode || '—'}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={8}>
                    {col.bar_chart && col.bar_chart.labels.length > 0 ? (
                      <Box sx={{ p: 2, border: '1px solid #EEEEEE', borderRadius: 2, bgcolor: '#fff' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#555', display: 'block', mb: 1 }}>
                          Distribución de Categorías (Top {Math.min(20, col.bar_chart.labels.length)})
                        </Typography>
                        <Box sx={{ height: 220 }}>
                          <Bar
                            data={{
                              labels: col.bar_chart.labels,
                              datasets: [{
                                data: col.bar_chart.counts,
                                backgroundColor: 'rgba(123, 31, 162, 0.5)',
                                borderColor: 'rgba(123, 31, 162, 0.8)',
                                borderWidth: 1,
                                borderRadius: 2,
                              }],
                            }}
                            options={{
                              indexAxis: col.bar_chart.labels.length > 8 ? 'y' as const : 'x' as const,
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: { legend: { display: false } },
                              scales: {
                                x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#999' } },
                                y: { grid: { color: '#F0F0F0' }, ticks: { font: { size: 10 }, color: '#999' }, beginAtZero: true },
                              },
                            }}
                          />
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ p: 3, border: '1px dashed #E0E0E0', borderRadius: 2, textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: '#999' }}>Sin datos para gráfico</Typography>
                      </Box>
                    )}
                  </Grid>
                </Grid>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </Paper>

      {/* ════════════════════════════════════════════════════════════
          SECTION 5 – Correlation Matrix
          ════════════════════════════════════════════════════════════ */}
      {correlation_matrix && (
        <Paper {...sectionPaper}>
          {sectionHeader(
            <GridOnIcon sx={{ color: '#d32f2f' }} />,
            'Matriz de Correlación',
            `${correlation_matrix.columns.length} variables numéricas · Coeficiente de Pearson`
          )}

          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 12, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: 6, textAlign: 'left' }}></th>
                  {correlation_matrix.columns.map(c => (
                    <th key={c} style={{
                      padding: '8px 6px', fontWeight: 600, fontSize: '0.7rem', color: '#555',
                      maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textAlign: 'center',
                    }}>
                      <Tooltip title={c}><span>{c.length > 8 ? c.slice(0, 8) + '…' : c}</span></Tooltip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlation_matrix.values.map((row, i) => (
                  <tr key={i}>
                    <td style={{
                      padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap',
                      fontSize: '0.75rem', color: '#555',
                    }}>
                      <Tooltip title={correlation_matrix!.columns[i]}>
                        <span>{correlation_matrix!.columns[i].length > 12 ? correlation_matrix!.columns[i].slice(0, 12) + '…' : correlation_matrix!.columns[i]}</span>
                      </Tooltip>
                    </td>
                    {row.map((v, j) => {
                      const { bg, text } = correlationColor(v);
                      return (
                        <td
                          key={j}
                          style={{
                            padding: '7px 6px',
                            textAlign: 'center',
                            fontWeight: i === j ? 700 : 500,
                            fontSize: i === j ? '0.8rem' : '0.75rem',
                            color: i === j ? '#333' : text,
                            backgroundColor: i === j ? '#F5F5F5' : bg,
                            borderRadius: 4,
                            fontFamily: 'monospace',
                          }}
                        >
                          <Tooltip title={`${correlation_matrix!.columns[i]} ↔ ${correlation_matrix!.columns[j]}: ${v.toFixed(4)}`}>
                            <span>{i === j ? '1.00' : v.toFixed(2)}</span>
                          </Tooltip>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>

          {/* Color legend */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 2 }}>
            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 600 }}>−1</Typography>
            <Box sx={{
              width: 200, height: 10, borderRadius: 5,
              background: 'linear-gradient(to right, #4466CC, #8899DD, #FAFAFA, #DD9988, #CC6644)',
            }} />
            <Typography variant="caption" sx={{ color: '#d32f2f', fontWeight: 600 }}>+1</Typography>
          </Box>
        </Paper>
      )}

      {/* ════════════════════════════════════════════════════════════
          SECTION 6 – Scatter Plot
          ════════════════════════════════════════════════════════════ */}
      {type_summary.numeric_columns.length >= 2 && (
        <Paper {...sectionPaper}>
          {sectionHeader(
            <BubbleChartIcon sx={{ color: '#00B37E' }} />,
            'Gráfico de Dispersión',
            'Selecciona dos variables numéricas para visualizar su relación'
          )}

          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Eje X</InputLabel>
              <Select value={scatterX} label="Eje X" onChange={(e) => setScatterX(e.target.value)}>
                {type_summary.numeric_columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Eje Y</InputLabel>
              <Select value={scatterY} label="Eje Y" onChange={(e) => setScatterY(e.target.value)}>
                {type_summary.numeric_columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          {scatterX && scatterY && scatterX !== scatterY ? (
            <Box sx={{ p: 2, border: '1px solid #EEEEEE', borderRadius: 2, bgcolor: '#fff' }}>
              <ScatterPlot datasetId={datasetId} xCol={scatterX} yCol={scatterY} />
            </Box>
          ) : (
            <Box sx={{ p: 4, border: '1px dashed #E0E0E0', borderRadius: 2, textAlign: 'center' }}>
              <BubbleChartIcon sx={{ fontSize: 40, color: '#DDD', mb: 1 }} />
              <Typography variant="body2" sx={{ color: '#999' }}>
                Selecciona dos variables numéricas distintas para ver su relación.
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

// ── Mini Boxplot (SVG – matching OutlierDetail style) ───────────
interface MiniBoxplotProps {
  boxplot: NonNullable<ProfilingColumn['boxplot']>;
}

const MiniBoxplot: React.FC<MiniBoxplotProps> = ({ boxplot }) => {
  const sMin = boxplot.min;
  const sMax = boxplot.max;
  const range = sMax - sMin;
  if (range === 0) {
    return <Typography variant="caption" sx={{ color: '#999' }}>Todos los valores son iguales</Typography>;
  }

  const toX = (v: number) => Math.max(5, Math.min(995, ((v - sMin) / range) * 990 + 5));

  const lbX = toX(boxplot.lower_fence);
  const ubX = toX(boxplot.upper_fence);
  const q1X = toX(boxplot.q1);
  const q3X = toX(boxplot.q3);
  const medX = toX(boxplot.median);

  return (
    <Box>
      <svg width="100%" height="70" viewBox="0 0 1000 70" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
        {/* Whiskers */}
        <line x1={lbX} y1="35" x2={q1X} y2="35" stroke="#999" strokeWidth="2" strokeDasharray="4,2" />
        <line x1={q3X} y1="35" x2={ubX} y2="35" stroke="#999" strokeWidth="2" strokeDasharray="4,2" />
        {/* Whisker caps */}
        <line x1={lbX} y1="22" x2={lbX} y2="48" stroke="#999" strokeWidth="2" />
        <line x1={ubX} y1="22" x2={ubX} y2="48" stroke="#999" strokeWidth="2" />
        {/* IQR Box */}
        <rect x={q1X} y="15" width={Math.max(q3X - q1X, 4)} height="40" rx="4" fill="#C8E6C9" stroke="#66BB6A" strokeWidth="2" />
        {/* Median */}
        <line x1={medX} y1="15" x2={medX} y2="55" stroke="#1B5E20" strokeWidth="3" />
        {/* Outlier dots */}
        {boxplot.outliers_sample.slice(0, 30).map((v, i) => (
          <circle key={i} cx={toX(v)} cy="35" r="4" fill="#E5484D" stroke="#fff" strokeWidth="1.5" opacity="0.85" />
        ))}
      </svg>

      {/* Labels row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5, mt: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#999', fontFamily: 'monospace', fontSize: '0.65rem' }}>
          {sMin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Typography>
        <Typography variant="caption" sx={{ color: '#999', fontFamily: 'monospace', fontSize: '0.65rem' }}>
          {sMax.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Typography>
      </Box>
      {boxplot.outlier_count > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <WarningIcon sx={{ color: '#FFB800', fontSize: 13 }} />
          <Typography variant="caption" sx={{ color: '#888', fontSize: '0.7rem' }}>
            {boxplot.outlier_count} outlier{boxplot.outlier_count > 1 ? 's' : ''}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ── Scatter Plot (fetches raw data on demand) ───────────────────
interface ScatterPlotProps {
  datasetId: number;
  xCol: string;
  yCol: string;
}

const ScatterPlot: React.FC<ScatterPlotProps> = ({ datasetId, xCol, yCol }) => {
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await datasetsAPI.previewDataset(datasetId);
        const rows = res.data?.data ?? [];
        if (!cancelled) {
          const pts = rows
            .map((r: any) => ({ x: parseFloat(r[xCol]), y: parseFloat(r[yCol]) }))
            .filter((p: any) => !isNaN(p.x) && !isNaN(p.y));
          setPoints(pts);
        }
      } catch {
        if (!cancelled) setPoints([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [datasetId, xCol, yCol]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} sx={{ color: '#00B37E' }} />
      </Box>
    );
  }

  if (points.length === 0) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#999' }}>Sin datos suficientes para este par de variables.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 320 }}>
      <Scatter
        data={{
          datasets: [{
            label: `${xCol} vs ${yCol}`,
            data: points,
            backgroundColor: 'rgba(0, 179, 126, 0.4)',
            borderColor: 'rgba(0, 179, 126, 0.8)',
            pointRadius: 3,
            pointHoverRadius: 5,
          }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: xCol, color: '#666', font: { weight: 'bold' } }, grid: { color: '#F0F0F0' }, ticks: { color: '#999' } },
            y: { title: { display: true, text: yCol, color: '#666', font: { weight: 'bold' } }, grid: { color: '#F0F0F0' }, ticks: { color: '#999' } },
          },
        }}
      />
    </Box>
  );
};

export default DataProfilingTab;
