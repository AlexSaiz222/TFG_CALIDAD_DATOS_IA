import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  BarChart as BarChartIcon,
  BubbleChart as BubbleChartIcon,
  GridOn as GridOnIcon,
  Warning as WarningIcon,
  Notes as NotesIcon,
  ManageSearch as ManageSearchIcon,
  ScatterPlot as ScatterPlotIcon,
} from '@mui/icons-material';
import { datasetsAPI } from '../services/api';
import type { DataProfilingResult, ProfilingColumn, ColumnMetrics } from '../types';
import MetricDetailsTabs from './evaluations/MetricDetailsTabs';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, ChartTooltip, Legend, Filler);

// ── Types ───────────────────────────────────────────────────────
interface DataProfilingTabProps { datasetId: number; }

type SectionKey = 'overview' | 'metricDetails' | 'columns' | 'correlation' | 'scatter';

// ── Helpers ─────────────────────────────────────────────────────
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const subTypeLabels: Record<string, string> = { continuous: 'Continua', discrete: 'Discreta', binary: 'Binaria', nominal: 'Nominal', text: 'Texto' };
const getSubTypeLabel = (s: string) => subTypeLabels[s] || s;
const getCategoryColor = (cat: string) => cat === 'numeric' ? '#1976d2' : '#7b1fa2';
const completenessColor = (v: number) => v >= 98 ? '#00B37E' : v >= 90 ? '#FFB800' : '#E5484D';
const formatStat = (v: number | null | undefined) => v == null ? '—' : Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 });

const correlationColor = (v: number): { bg: string; text: string } => {
  const abs = Math.abs(v);
  if (abs < 0.05) return { bg: '#FAFAFA', text: '#999' };
  if (v > 0) {
    const r = Math.round(220 - abs * 180);
    return { bg: `rgb(${255 - Math.round(abs * 50)}, ${r}, ${r})`, text: abs > 0.5 ? '#fff' : '#333' };
  }
  const b = Math.round(220 - abs * 180);
  return { bg: `rgb(${b}, ${b}, ${255 - Math.round(abs * 50)})`, text: abs > 0.5 ? '#fff' : '#333' };
};

const badgeFor = (val: number, thresholds: [number, number] = [0.98, 0.90]) => {
  if (val >= thresholds[0]) return { label: 'Excelente', bg: 'rgba(0,179,126,0.1)', color: '#00B37E' };
  if (val >= thresholds[1]) return { label: 'Requiere atención', bg: 'rgba(255,184,0,0.1)', color: '#FFB800' };
  return { label: 'Crítico', bg: 'rgba(229,72,77,0.1)', color: '#E5484D' };
};

// ── Collapsible Section ─────────────────────────────────────────
const CollapsibleSection: React.FC<{
  id?: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  count?: number;
}> = ({ id, icon, title, subtitle, open, onToggle, children, count }) => (
  <Paper id={id} elevation={0} sx={{ mb: 2, borderRadius: 2, border: '1px solid #EEEEEE', scrollMarginTop: '80px', overflow: 'hidden' }}>
    <Box
      onClick={onToggle}
      sx={{
        display: 'flex', alignItems: 'center', gap: 2.5, px: 3, py: 2, cursor: 'pointer',
        userSelect: 'none', '&:hover': { bgcolor: '#FAFAFA' }, transition: 'background 0.15s',
      }}
    >
      {icon}
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2, fontSize: '0.95rem' }}>
          {title}
          {count !== undefined && <Chip label={count} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem', fontWeight: 600 }} />}
        </Typography>
        {subtitle && !open && <Typography variant="caption" sx={{ color: '#888' }}>{subtitle}</Typography>}
      </Box>
      <IconButton size="small" sx={{ color: '#999' }}>
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </IconButton>
    </Box>
    <Collapse in={open} timeout={250}>
      <Box sx={{ px: 3, pb: 3 }}>{children}</Box>
    </Collapse>
  </Paper>
);

// ── Metric Card ─────────────────────────────────────────────────
const MetricCard: React.FC<{
  title: string; value: string;
  badge: { label: string; bg: string; color: string };
  insight: string; onDetail: () => void;
}> = ({ title, value, badge, insight, onDetail }) => (
  <Paper
    elevation={0} onClick={onDetail}
    sx={{
      p: 2.5, border: '1px solid #EEEEEE', borderRadius: 2, cursor: 'pointer', height: '100%',
      transition: 'all 0.2s', '&:hover': { borderColor: '#1976d2', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
    }}
  >
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>{title}</Typography>
      <Chip label={badge.label} size="small" sx={{ bgcolor: badge.bg, color: badge.color, fontWeight: 500, fontSize: '0.65rem', height: 20 }} />
    </Box>
    <Typography variant="h4" sx={{ fontWeight: 700, color: badge.color, mb: 1, lineHeight: 1 }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 1, minHeight: '2em' }}>{insight}</Typography>
    <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 500 }}>Ver detalle →</Typography>
  </Paper>
);

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

  // ── Section visibility state ──────────────────────────────────
  const defaultOpen: Record<SectionKey, boolean> = {
    overview: false,
    metricDetails: false,
    columns: false,
    correlation: false,
    scatter: false,
  };
  const [sections, setSections] = useState<Record<SectionKey, boolean>>(defaultOpen);

  const toggle = useCallback((key: SectionKey) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const openAnalysisDetails = useCallback(() => {
    setSections(prev => ({ ...prev, metricDetails: true }));
    setTimeout(() => {
      document.getElementById('profiling-analysis-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }, []);

  // ── Render states ─────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
        <CircularProgress sx={{ color: '#00B37E' }} />
        <Typography variant="body2" sx={{ color: '#666' }}>Generando análisis exploratorio…</Typography>
      </Box>
    );
  }
  if (error) return <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>;
  if (!profiling) return <Alert severity="info" sx={{ mt: 2 }}>No hay datos de profiling disponibles.</Alert>;

  const { overview, type_summary, columns, correlation_matrix } = profiling;

  // ── Computed metrics ──────────────────────────────────────────
  const compVal = evalOverallMetrics.completeness ?? 1;
  const compPct = (compVal * 100).toFixed(1);
  const nullCols = Object.values(evalColumnMetrics).filter((c: any) => (c.n_nulls || 0) > 0).length;
  const compBadge = badgeFor(compVal);

  const uniqVal = evalOverallMetrics.uniqueness ?? 1;
  const uniqPct = (uniqVal * 100).toFixed(1);
  const uniqBadge = overview.duplicate_rows === 0 ? badgeFor(1) : overview.duplicate_rows <= 2 ? badgeFor(0.95) : badgeFor(0.5);

  const outlierMap = evalOverallMetrics.outliers || {};
  const totalOutliers = Object.values(outlierMap).reduce((s: number, c: any) => s + (c?.count || 0), 0);
  const totalOutlierVals = Object.values(outlierMap).reduce((s: number, c: any) => s + (c?.total_values || 0), 0);
  const outlierProp = totalOutlierVals > 0 ? totalOutliers / totalOutlierVals : 0;
  const outlierColCount = Object.values(outlierMap).filter((c: any) => c?.count > 0).length;
  const outBadge = totalOutliers === 0 ? badgeFor(1) : outlierProp >= 0.05 ? badgeFor(0.5) : outlierProp >= 0.02 ? badgeFor(0.95) : badgeFor(1);

  const numPct = overview.total_columns > 0 ? Math.round((type_summary.numeric_count / overview.total_columns) * 100) : 0;
  const catPct = 100 - numPct;

  // ── Render ────────────────────────────────────────────────────
  return (
    <Box>
      {/* ── SECTION 1 – Overview + Metrics ── */}
      <CollapsibleSection
        icon={<NotesIcon sx={{ color: '#00B37E' }} />}
        title="Resumen del dataset"
        subtitle={`${overview.total_rows.toLocaleString()} filas · ${overview.total_columns} columnas · ${formatBytes(overview.estimated_size_bytes)}`}
        open={sections.overview}
        onToggle={() => toggle('overview')}
      >
        {/* Compact volumetry strip */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 3, px: 1 }}>
          {[
            { label: 'Filas', val: overview.total_rows.toLocaleString() },
            { label: 'Columnas', val: String(overview.total_columns) },
            { label: 'Celdas', val: overview.total_cells.toLocaleString() },
            { label: 'Tamaño', val: formatBytes(overview.estimated_size_bytes) },
            { label: 'Numéricas', val: `${type_summary.numeric_count} (${numPct}%)` },
            { label: 'Categóricas', val: `${type_summary.categorical_count} (${catPct}%)` },
          ].map(({ label, val }) => (
            <Box key={label} sx={{ minWidth: 80 }}>
              <Typography variant="caption" sx={{ color: '#999', display: 'block', fontSize: '0.65rem', lineHeight: 1 }}>{label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', color: '#333' }}>{val}</Typography>
            </Box>
          ))}
        </Box>

        {/* Type proportion bar */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden' }}>
            <Box sx={{ width: `${numPct}%`, bgcolor: '#1976d2', transition: 'width 0.3s' }} />
            <Box sx={{ width: `${catPct}%`, bgcolor: '#7b1fa2', transition: 'width 0.3s' }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#1976d2' }} />
              <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem' }}>Numéricas</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#7b1fa2' }} />
              <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem' }}>Categóricas</Typography>
            </Box>
          </Box>
        </Box>

        {/* Características del dataset */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <MetricCard
              title="Completitud"
              value={`${compPct}%`}
              badge={compBadge}
              insight={nullCols > 0 ? `${nullCols} de ${overview.total_columns} columnas con nulos` : 'Todas las columnas completas'}
              onDetail={openAnalysisDetails}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MetricCard
              title="Unicidad"
              value={`${uniqPct}%`}
              badge={uniqBadge}
              insight={overview.duplicate_rows > 0
                ? `${overview.duplicate_rows.toLocaleString()} fila${overview.duplicate_rows !== 1 ? 's' : ''} duplicada${overview.duplicate_rows !== 1 ? 's' : ''}`
                : 'Sin filas duplicadas'}
              onDetail={openAnalysisDetails}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MetricCard
              title="Outliers"
              value={String(totalOutliers)}
              badge={outBadge}
              insight={totalOutliers === 0
                ? 'Sin valores atípicos'
                : `${outlierColCount} col. afectada${outlierColCount !== 1 ? 's' : ''} (${(outlierProp * 100).toFixed(1)}%)`}
              onDetail={openAnalysisDetails}
            />
          </Grid>
        </Grid>
      </CollapsibleSection>

      {/* ── SECTION 2 – Análisis de Nulos, Duplicados y Outliers ── */}
      <CollapsibleSection
        id="profiling-analysis-details"
        icon={<ManageSearchIcon sx={{ color: '#00B37E' }} />}
        title="Análisis de Nulos, Duplicados y Outliers"
        subtitle="Completitud, unicidad y valores atípicos"
        open={sections.metricDetails}
        onToggle={() => toggle('metricDetails')}
      >
        <MetricDetailsTabs overallMetrics={evalOverallMetrics} columnMetrics={evalColumnMetrics} />
      </CollapsibleSection>

      {/* ── SECTION 3 – Per-column Analysis ── */}
      <CollapsibleSection
        icon={<BarChartIcon sx={{ color: '#00B37E' }} />}
        title="Análisis por Columna"
        subtitle="Estadísticas descriptivas y distribuciones"
        count={columns.length}
        open={sections.columns}
        onToggle={() => toggle('columns')}
      >
        {columns.map((col) => {
          const compColPct = 100 - col.missing_percent;
          return (
            <Accordion
              key={col.name}
              disableGutters
              elevation={0}
              sx={{
                border: '1px solid #E8E8E8', borderRadius: '8px !important', mb: 1,
                '&::before': { display: 'none' }, overflow: 'hidden',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, py: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Chip
                    label={col.category === 'numeric' ? 'NUM' : 'CAT'}
                    size="small"
                    sx={{
                      fontWeight: 700, fontSize: '0.6rem', minWidth: 36, height: 20,
                      bgcolor: getCategoryColor(col.category) + '18', color: getCategoryColor(col.category),
                    }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1, fontSize: '0.85rem' }}>{col.name}</Typography>
                  <Chip label={getSubTypeLabel(col.sub_type)} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 20, borderColor: '#DDD' }} />
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#888', fontSize: '0.65rem' }}>
                    {col.n_unique} únicos
                  </Typography>
                  {/* Inline mini completeness bar */}
                  <Tooltip title={`${compColPct.toFixed(1)}% completo · ${col.n_missing} nulos`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 70 }}>
                      <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#EEEEEE', overflow: 'hidden' }}>
                        <Box sx={{ width: `${compColPct}%`, height: '100%', borderRadius: 2, bgcolor: completenessColor(compColPct) }} />
                      </Box>
                      <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, color: completenessColor(compColPct), minWidth: 28 }}>
                        {compColPct.toFixed(0)}%
                      </Typography>
                    </Box>
                  </Tooltip>
                </Box>
              </AccordionSummary>

              <AccordionDetails sx={{ px: 2, pb: 2.5, pt: 0 }}>
                {col.category === 'numeric' ? (
                  <>
                    {/* Stat cards */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 1, mb: 2 }}>
                      {[
                        { label: 'Media', value: col.mean },
                        { label: 'Mediana', value: col.median },
                        { label: 'Desv. Est.', value: col.std },
                        { label: 'Mín', value: col.min },
                        { label: 'Máx', value: col.max },
                        { label: 'Q1', value: col.q1 },
                        { label: 'Q3', value: col.q3 },
                        { label: 'IQR', value: col.iqr },
                      ].map(({ label, value }) => (
                        <Box key={label} sx={{ p: 1, bgcolor: '#FAFAFA', borderRadius: 1, border: '1px solid #F0F0F0' }}>
                          <Typography variant="caption" sx={{ color: '#999', display: 'block', fontSize: '0.6rem', lineHeight: 1 }}>{label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.78rem', color: '#333' }}>
                            {formatStat(value)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Charts */}
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} md={6}>
                        {col.histogram && col.histogram.bins.length > 0 ? (
                          <Box sx={{ p: 1.5, border: '1px solid #F0F0F0', borderRadius: 1.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: '#888', display: 'block', mb: 0.5, fontSize: '0.65rem' }}>Histograma</Typography>
                            <Box sx={{ height: 180 }}>
                              <Bar
                                data={{
                                  labels: col.histogram.bins.map(b => b.toFixed(1)),
                                  datasets: [{ data: col.histogram.counts, backgroundColor: 'rgba(25,118,210,0.5)', borderColor: 'rgba(25,118,210,0.7)', borderWidth: 1, borderRadius: 2 }],
                                }}
                                options={{
                                  responsive: true, maintainAspectRatio: false,
                                  plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
                                  scales: {
                                    x: { display: true, grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 9 }, color: '#BBB' } },
                                    y: { display: true, beginAtZero: true, grid: { color: '#F5F5F5' }, ticks: { font: { size: 9 }, color: '#BBB' } },
                                  },
                                }}
                              />
                            </Box>
                          </Box>
                        ) : (
                          <Box sx={{ p: 2, border: '1px dashed #E8E8E8', borderRadius: 1.5, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: '#CCC' }}>Sin histograma</Typography>
                          </Box>
                        )}
                      </Grid>
                      <Grid item xs={12} md={6}>
                        {col.boxplot ? (
                          <Box sx={{ p: 1.5, border: '1px solid #F0F0F0', borderRadius: 1.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, color: '#888', display: 'block', mb: 0.5, fontSize: '0.65rem' }}>Boxplot</Typography>
                            <MiniBoxplot boxplot={col.boxplot} />
                          </Box>
                        ) : (
                          <Box sx={{ p: 2, border: '1px dashed #E8E8E8', borderRadius: 1.5, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: '#CCC' }}>Sin boxplot</Typography>
                          </Box>
                        )}
                      </Grid>
                    </Grid>
                  </>
                ) : (
                  /* ── Categorical ── */
                  <Grid container spacing={1.5}>
                    <Grid item xs={12} md={4}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                        <Box sx={{ p: 1, bgcolor: '#FAFAFA', borderRadius: 1, border: '1px solid #F0F0F0' }}>
                          <Typography variant="caption" sx={{ color: '#999', display: 'block', fontSize: '0.6rem' }}>Únicos</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', color: '#333' }}>{col.n_unique.toLocaleString()}</Typography>
                        </Box>
                        <Box sx={{ p: 1, bgcolor: '#FAFAFA', borderRadius: 1, border: '1px solid #F0F0F0' }}>
                          <Typography variant="caption" sx={{ color: '#999', display: 'block', fontSize: '0.6rem' }}>Moda</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#7b1fa2', fontSize: '0.78rem', wordBreak: 'break-all' }}>{col.mode || '—'}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={8}>
                      {col.bar_chart && col.bar_chart.labels.length > 0 ? (
                        <Box sx={{ p: 1.5, border: '1px solid #F0F0F0', borderRadius: 1.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#888', display: 'block', mb: 0.5, fontSize: '0.65rem' }}>
                            Top {Math.min(20, col.bar_chart.labels.length)} categorías
                          </Typography>
                          <Box sx={{ height: 200 }}>
                            <Bar
                              data={{
                                labels: col.bar_chart.labels,
                                datasets: [{ data: col.bar_chart.counts, backgroundColor: 'rgba(123,31,162,0.45)', borderColor: 'rgba(123,31,162,0.7)', borderWidth: 1, borderRadius: 2 }],
                              }}
                              options={{
                                indexAxis: col.bar_chart.labels.length > 8 ? 'y' as const : 'x' as const,
                                responsive: true, maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                  x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#BBB' } },
                                  y: { grid: { color: '#F5F5F5' }, ticks: { font: { size: 9 }, color: '#BBB' }, beginAtZero: true },
                                },
                              }}
                            />
                          </Box>
                        </Box>
                      ) : (
                        <Box sx={{ p: 2, border: '1px dashed #E8E8E8', borderRadius: 1.5, textAlign: 'center' }}>
                          <Typography variant="caption" sx={{ color: '#CCC' }}>Sin datos de distribución</Typography>
                        </Box>
                      )}
                    </Grid>
                  </Grid>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </CollapsibleSection>

      {/* ── SECTION 4 – Correlation Matrix (collapsed by default) ── */}
      {correlation_matrix && (
        <CollapsibleSection
          icon={<GridOnIcon sx={{ color: '#00B37E' }} />}
          title="Matriz de Correlación"
          subtitle={`${correlation_matrix.columns.length} variables numéricas · Pearson`}
          open={sections.correlation}
          onToggle={() => toggle('correlation')}
        >
          <Box sx={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 2, fontSize: 12, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: 6 }} />
                  {correlation_matrix.columns.map(c => (
                    <th key={c} style={{ padding: '6px 4px', fontWeight: 600, fontSize: '0.65rem', color: '#888', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      <Tooltip title={c}><span>{c.length > 8 ? c.slice(0, 8) + '…' : c}</span></Tooltip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlation_matrix.values.map((row, i) => (
                  <tr key={i}>
                    <td style={{ padding: '4px 8px', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.7rem', color: '#666' }}>
                      <Tooltip title={correlation_matrix!.columns[i]}>
                        <span>{correlation_matrix!.columns[i].length > 12 ? correlation_matrix!.columns[i].slice(0, 12) + '…' : correlation_matrix!.columns[i]}</span>
                      </Tooltip>
                    </td>
                    {row.map((v, j) => {
                      const { bg, text } = correlationColor(v);
                      const isDiagonal = i === j;
                      const handleClick = () => {
                        if (!isDiagonal) {
                          setScatterX(correlation_matrix!.columns[i]);
                          setScatterY(correlation_matrix!.columns[j]);
                          setSections(prev => ({ ...prev, scatter: true }));
                          setTimeout(() => {
                            document.getElementById('scatter-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }, 300);
                        }
                      };
                      return (
                        <td
                          key={j}
                          onClick={handleClick}
                          style={{
                            padding: '5px 4px', textAlign: 'center', fontWeight: isDiagonal ? 700 : 500,
                            fontSize: '0.7rem', color: isDiagonal ? '#333' : text,
                            backgroundColor: isDiagonal ? '#F5F5F5' : bg, borderRadius: 3, fontFamily: 'monospace',
                            cursor: isDiagonal ? 'default' : 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isDiagonal) {
                              e.currentTarget.style.transform = 'scale(1.1)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                              e.currentTarget.style.zIndex = '10';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isDiagonal) {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = 'none';
                              e.currentTarget.style.zIndex = '1';
                            }
                          }}
                        >
                          <Tooltip title={isDiagonal ? `${correlation_matrix!.columns[i]} (diagonal)` : `Click para graficar: ${correlation_matrix!.columns[i]} vs ${correlation_matrix!.columns[j]} (r=${v.toFixed(4)})`}>
                            <span>{isDiagonal ? '1.00' : v.toFixed(2)}</span>
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1.5 }}>
            <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 600, fontSize: '0.65rem' }}>−1</Typography>
            <Box sx={{ width: 160, height: 8, borderRadius: 4, background: 'linear-gradient(to right, #4466CC, #8899DD, #FAFAFA, #DD9988, #CC6644)' }} />
            <Typography variant="caption" sx={{ color: '#d32f2f', fontWeight: 600, fontSize: '0.65rem' }}>+1</Typography>
          </Box>
        </CollapsibleSection>
      )}

      {/* ── SECTION 5 – Scatter Plot (collapsed by default) ── */}
      {type_summary.numeric_columns.length >= 2 && (
        <CollapsibleSection
          id="scatter-section"
          icon={<ScatterPlotIcon sx={{ color: '#00B37E' }} />}
          title="Dispersión"
          subtitle="Explora la relación entre dos variables numéricas"
          open={sections.scatter}
          onToggle={() => toggle('scatter')}
        >
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Eje X</InputLabel>
              <Select value={scatterX} label="Eje X" onChange={(e) => setScatterX(e.target.value)}>
                {type_summary.numeric_columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Eje Y</InputLabel>
              <Select value={scatterY} label="Eje Y" onChange={(e) => setScatterY(e.target.value)}>
                {type_summary.numeric_columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          {scatterX && scatterY && scatterX !== scatterY ? (
            <ScatterPlotChart datasetId={datasetId} xCol={scatterX} yCol={scatterY} />
          ) : (
            <Box sx={{ p: 3, border: '1px dashed #E0E0E0', borderRadius: 1.5, textAlign: 'center' }}>
              <BubbleChartIcon sx={{ fontSize: 32, color: '#DDD', mb: 0.5 }} />
              <Typography variant="caption" sx={{ color: '#BBB', display: 'block' }}>
                Selecciona dos variables numéricas distintas.
              </Typography>
            </Box>
          )}
        </CollapsibleSection>
      )}
    </Box>
  );
};

// ── Mini Boxplot (SVG) ──────────────────────────────────────────
const MiniBoxplot: React.FC<{ boxplot: NonNullable<ProfilingColumn['boxplot']> }> = ({ boxplot }) => {
  const range = boxplot.max - boxplot.min;
  if (range === 0) return <Typography variant="caption" sx={{ color: '#999' }}>Todos los valores son iguales</Typography>;

  const toX = (v: number) => Math.max(5, Math.min(995, ((v - boxplot.min) / range) * 990 + 5));
  const [lbX, ubX, q1X, q3X, medX] = [toX(boxplot.lower_fence), toX(boxplot.upper_fence), toX(boxplot.q1), toX(boxplot.q3), toX(boxplot.median)];

  return (
    <Box>
      <svg width="100%" height="60" viewBox="0 0 1000 60" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
        {/* Lower whisker */}
        <Tooltip title={`Límite inferior: ${boxplot.lower_fence.toFixed(2)}`} arrow>
          <g>
            <line x1={lbX} y1="30" x2={q1X} y2="30" stroke="#BBB" strokeWidth="1.5" strokeDasharray="4,2" style={{ cursor: 'help' }} />
            <line x1={lbX} y1="20" x2={lbX} y2="40" stroke="#BBB" strokeWidth="1.5" style={{ cursor: 'help' }} />
          </g>
        </Tooltip>
        
        {/* Upper whisker */}
        <Tooltip title={`Límite superior: ${boxplot.upper_fence.toFixed(2)}`} arrow>
          <g>
            <line x1={q3X} y1="30" x2={ubX} y2="30" stroke="#BBB" strokeWidth="1.5" strokeDasharray="4,2" style={{ cursor: 'help' }} />
            <line x1={ubX} y1="20" x2={ubX} y2="40" stroke="#BBB" strokeWidth="1.5" style={{ cursor: 'help' }} />
          </g>
        </Tooltip>
        
        {/* IQR Box (Q1 to Q3) */}
        <Tooltip title={`Q1: ${boxplot.q1.toFixed(2)} | Q3: ${boxplot.q3.toFixed(2)}`} arrow>
          <rect x={q1X} y="14" width={Math.max(q3X - q1X, 4)} height="32" rx="3" fill="#C8E6C9" stroke="#66BB6A" strokeWidth="1.5" style={{ cursor: 'help' }} />
        </Tooltip>
        
        {/* Median line (Q2) */}
        <Tooltip title={`Mediana (Q2): ${boxplot.median.toFixed(2)}`} arrow>
          <line x1={medX} y1="14" x2={medX} y2="46" stroke="#1B5E20" strokeWidth="2.5" style={{ cursor: 'help' }} />
        </Tooltip>
        
        {/* Outliers */}
        {boxplot.outliers_sample.slice(0, 25).map((v, i) => (
          <Tooltip key={i} title={`Outlier: ${v.toFixed(2)}`} arrow>
            <circle cx={toX(v)} cy="30" r="3" fill="#E5484D" stroke="#fff" strokeWidth="1" opacity="0.8" style={{ cursor: 'help' }} />
          </Tooltip>
        ))}
      </svg>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#BBB', fontFamily: 'monospace', fontSize: '0.6rem' }}>
          {boxplot.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Typography>
        <Typography variant="caption" sx={{ color: '#BBB', fontFamily: 'monospace', fontSize: '0.6rem' }}>
          {boxplot.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Typography>
      </Box>
      {boxplot.outlier_count > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <WarningIcon sx={{ color: '#FFB800', fontSize: 12 }} />
          <Typography variant="caption" sx={{ color: '#999', fontSize: '0.65rem' }}>
            {boxplot.outlier_count} outlier{boxplot.outlier_count > 1 ? 's' : ''}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ── Scatter Plot (fetches on demand) ────────────────────────────
const ScatterPlotChart: React.FC<{ datasetId: number; xCol: string; yCol: string }> = ({ datasetId, xCol, yCol }) => {
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await datasetsAPI.previewDataset(datasetId);
        const rows = res.data?.data ?? [];
        if (!cancelled) setPoints(rows.map((r: any) => ({ x: parseFloat(r[xCol]), y: parseFloat(r[yCol]) })).filter((p: any) => !isNaN(p.x) && !isNaN(p.y)));
      } catch { if (!cancelled) setPoints([]); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [datasetId, xCol, yCol]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} sx={{ color: '#00B37E' }} /></Box>;
  if (points.length === 0) return <Box sx={{ py: 2, textAlign: 'center' }}><Typography variant="caption" sx={{ color: '#BBB' }}>Sin datos suficientes.</Typography></Box>;

  return (
    <Box sx={{ height: 300 }}>
      <Scatter
        data={{ datasets: [{ label: `${xCol} vs ${yCol}`, data: points, backgroundColor: 'rgba(0,179,126,0.35)', borderColor: 'rgba(0,179,126,0.7)', pointRadius: 2.5, pointHoverRadius: 4 }] }}
        options={{
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: xCol, color: '#888', font: { weight: 'bold', size: 11 } }, grid: { color: '#F5F5F5' }, ticks: { color: '#BBB', font: { size: 9 } } },
            y: { title: { display: true, text: yCol, color: '#888', font: { weight: 'bold', size: 11 } }, grid: { color: '#F5F5F5' }, ticks: { color: '#BBB', font: { size: 9 } } },
          },
        }}
      />
    </Box>
  );
};

export default DataProfilingTab;
