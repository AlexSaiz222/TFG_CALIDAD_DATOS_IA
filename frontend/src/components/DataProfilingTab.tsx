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
  Dialog,
  DialogTitle,
  DialogContent,
  Fade,
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
  Fullscreen as FullscreenIcon,
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
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

const badgeFor = (val: number, thresholds: [number, number, number, number] = [0.98, 0.95, 0.90, 0.80]) => {
  if (val >= thresholds[0]) return { label: 'Excelente', bg: 'rgba(0,179,126,0.1)', color: '#00B37E' };      // >= 98%
  if (val >= thresholds[1]) return { label: 'Bueno', bg: 'rgba(52,211,153,0.1)', color: '#34D399' };        // >= 95%
  if (val >= thresholds[2]) return { label: 'Aceptable', bg: 'rgba(251,191,36,0.1)', color: '#FBB024' };    // >= 90%
  if (val >= thresholds[3]) return { label: 'Requiere atención', bg: 'rgba(251,146,60,0.1)', color: '#FB923C' }; // >= 80%
  return { label: 'Crítico', bg: 'rgba(239,68,68,0.1)', color: '#EF4444' };                                 // < 80%
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

// ── Chart Modal ────────────────────────────────────────────────
interface ChartModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const ChartModal: React.FC<ChartModalProps> = ({ open, onClose, title, children }) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="lg"
    fullWidth
    TransitionComponent={Fade}
    PaperProps={{
      sx: {
        borderRadius: 3,
        background: 'linear-gradient(135deg, #fafafa 0%, #ffffff 100%)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        overflow: 'hidden',
      },
    }}
  >
    <DialogTitle
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #E8E8E8',
        background: 'linear-gradient(90deg, #00B37E08 0%, transparent 100%)',
        py: 2,
        px: 3,
      }}
    >
      <Typography
        variant="h6"
        sx={{
          fontWeight: 700,
          fontSize: '1.1rem',
          background: 'linear-gradient(135deg, #00B37E 0%, #1976d2 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </Typography>
      <IconButton
        onClick={onClose}
        size="small"
        sx={{
          color: '#999',
          transition: 'all 0.2s',
          '&:hover': {
            color: '#E5484D',
            bgcolor: '#E5484D10',
            transform: 'rotate(90deg)',
          },
        }}
      >
        <CloseIcon />
      </IconButton>
    </DialogTitle>
    <DialogContent sx={{ p: 4, minHeight: 500 }}>{children}</DialogContent>
  </Dialog>
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

// ── Enhanced Chart Cards ───────────────────────────────────────
const EnhancedHistogramCard: React.FC<{ column: ProfilingColumn }> = ({ column }) => {
  const [modalOpen, setModalOpen] = useState(false);

  if (!column.histogram || column.histogram.bins.length === 0) {
    return (
      <Box sx={{ p: 2, border: '1px dashed #E8E8E8', borderRadius: 1.5, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: '#CCC' }}>Sin histograma</Typography>
      </Box>
    );
  }

  const chartData = {
    labels: column.histogram.bins.map(b => b.toFixed(1)),
    datasets: [{
      data: column.histogram.counts,
      backgroundColor: (context: any) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return 'rgba(0,179,126,0.5)';
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, 'rgba(0,179,126,0.3)');
        gradient.addColorStop(1, 'rgba(0,179,126,0.8)');
        return gradient;
      },
      borderColor: '#00B37E',
      borderWidth: 2,
      borderRadius: 4,
      hoverBackgroundColor: 'rgba(0,179,126,0.9)',
    }],
  };

  const chartOptions = (isExpanded: boolean) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        backgroundColor: 'rgba(0,0,0,0.9)',
        padding: 14,
        titleFont: { size: 13, weight: 'bold' as const },
        bodyFont: { size: 12 },
        borderColor: '#00B37E',
        borderWidth: 2,
        displayColors: false,
        callbacks: {
          title: (context: any) => {
            const index = context[0].dataIndex;
            const bins = column.histogram!.bins;
            const binStart = bins[index];
            const binEnd = bins[index + 1] || bins[index];
            return `Rango: ${binStart.toFixed(2)} - ${binEnd.toFixed(2)}`;
          },
          label: (context: any) => {
            const count = context.parsed.y;
            const total = column.histogram!.counts.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((count / total) * 100).toFixed(1);
            return [
              `Frecuencia: ${count} valores`,
              `Porcentaje: ${percentage}%`
            ];
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: { display: false },
        ticks: {
          maxTicksLimit: isExpanded ? 12 : 6,
          font: { size: isExpanded ? 11 : 9, weight: 500 },
          color: '#666',
        },
      },
      y: {
        display: true,
        beginAtZero: true,
        grid: { color: '#F0F0F0', lineWidth: 1 },
        ticks: {
          font: { size: isExpanded ? 11 : 9, weight: 500 },
          color: '#666',
        },
      },
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart' as const,
    },
  });

  return (
    <>
      <Box
        sx={{
          p: 1.5,
          border: '1px solid #E8E8E8',
          borderRadius: 2,
          position: 'relative',
          background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
          transition: 'all 0.3s',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          '&:hover': {
            borderColor: '#00B37E',
            boxShadow: '0 4px 12px rgba(0,179,126,0.1)',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#555', fontSize: '0.7rem', letterSpacing: '0.02em' }}>
            Histograma
          </Typography>
          <IconButton
            size="small"
            onClick={() => setModalOpen(true)}
            sx={{
              bgcolor: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: '#00B37E',
                color: 'white',
                transform: 'scale(1.1)',
              },
            }}
          >
            <FullscreenIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, minHeight: 200 }}>
          <Bar data={chartData} options={chartOptions(false)} />
        </Box>
      </Box>

      <ChartModal open={modalOpen} onClose={() => setModalOpen(false)} title={`Histograma - ${column.name}`}>
        <Box sx={{ height: 450 }}>
          <Bar data={chartData} options={chartOptions(true)} />
        </Box>
      </ChartModal>
    </>
  );
};

const EnhancedBoxplotCard: React.FC<{ column: ProfilingColumn }> = ({ column }) => {
  const [modalOpen, setModalOpen] = useState(false);

  if (!column.boxplot) {
    return (
      <Box sx={{ p: 2, border: '1px dashed #E8E8E8', borderRadius: 1.5, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: '#CCC' }}>Sin boxplot</Typography>
      </Box>
    );
  }

  return (
    <>
      <Box
        sx={{
          p: 1.5,
          border: '1px solid #E8E8E8',
          borderRadius: 2,
          background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
          transition: 'all 0.3s',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          '&:hover': {
            borderColor: '#00B37E',
            boxShadow: '0 4px 12px rgba(0,179,126,0.1)',
          },
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#555', display: 'block', mb: 0.5, fontSize: '0.7rem', letterSpacing: '0.02em' }}>
          Boxplot
        </Typography>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: 200 }}>
          <Box sx={{ width: '100%' }}>
            <EnhancedBoxplot boxplot={column.boxplot} columnName={column.name} onExpand={() => setModalOpen(true)} />
          </Box>
        </Box>
      </Box>

      <ChartModal open={modalOpen} onClose={() => setModalOpen(false)} title={`Boxplot - ${column.name}`}>
        <EnhancedBoxplot boxplot={column.boxplot} columnName={column.name} isExpanded />
      </ChartModal>
    </>
  );
};

const EnhancedBarChartCard: React.FC<{ column: ProfilingColumn }> = ({ column }) => {
  const [modalOpen, setModalOpen] = useState(false);

  if (!column.bar_chart || column.bar_chart.labels.length === 0) {
    return (
      <Box sx={{ p: 2, border: '1px dashed #E8E8E8', borderRadius: 1.5, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: '#CCC' }}>Sin datos de distribución</Typography>
      </Box>
    );
  }

  const chartData = {
    labels: column.bar_chart.labels,
    datasets: [{
      data: column.bar_chart.counts,
      backgroundColor: (context: any) => {
        const chart = context.chart;
        const { ctx, chartArea } = chart;
        if (!chartArea) return 'rgba(123,31,162,0.5)';
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, 'rgba(123,31,162,0.4)');
        gradient.addColorStop(1, 'rgba(123,31,162,0.75)');
        return gradient;
      },
      borderColor: '#7b1fa2',
      borderWidth: 2,
      borderRadius: 4,
      hoverBackgroundColor: 'rgba(123,31,162,0.9)',
    }],
  };

  const chartOptions = (isExpanded: boolean) => ({
    indexAxis: column.bar_chart!.labels.length > 8 ? 'y' as const : 'x' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.9)',
        padding: 14,
        titleFont: { size: 13, weight: 'bold' as const },
        bodyFont: { size: 12 },
        borderColor: '#7b1fa2',
        borderWidth: 2,
        displayColors: false,
        callbacks: {
          title: (context: any) => {
            return `Categoría: ${context[0].label}`;
          },
          label: (context: any) => {
            const count = context.parsed.y || context.parsed.x;
            const total = column.bar_chart!.counts.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((count / total) * 100).toFixed(1);
            return [
              `Frecuencia: ${count} registros`,
              `Porcentaje: ${percentage}%`,
              `Total: ${total} registros`
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: isExpanded ? 11 : 9, weight: 500 },
          color: '#666',
        },
      },
      y: {
        grid: { color: '#F0F0F0', lineWidth: 1 },
        ticks: {
          font: { size: isExpanded ? 11 : 9, weight: 500 },
          color: '#666',
        },
        beginAtZero: true,
      },
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart' as const,
    },
  });

  return (
    <>
      <Box
        sx={{
          p: 1.5,
          border: '1px solid #E8E8E8',
          borderRadius: 2,
          position: 'relative',
          background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
          transition: 'all 0.3s',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          '&:hover': {
            borderColor: '#7b1fa2',
            boxShadow: '0 4px 12px rgba(123,31,162,0.1)',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#555', fontSize: '0.7rem', letterSpacing: '0.02em' }}>
            Top {Math.min(20, column.bar_chart.labels.length)} categorías
          </Typography>
          <IconButton
            size="small"
            onClick={() => setModalOpen(true)}
            sx={{
              bgcolor: 'white',
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: '#7b1fa2',
                color: 'white',
                transform: 'scale(1.1)',
              },
            }}
          >
            <FullscreenIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, minHeight: 200 }}>
          <Bar data={chartData} options={chartOptions(false)} />
        </Box>
      </Box>

      <ChartModal open={modalOpen} onClose={() => setModalOpen(false)} title={`Distribución - ${column.name}`}>
        <Box sx={{ height: 450 }}>
          <Bar data={chartData} options={chartOptions(true)} />
        </Box>
      </ChartModal>
    </>
  );
};

// ── Main Component ──────────────────────────────────────────────
const DataProfilingTab: React.FC<DataProfilingTabProps> = ({ datasetId }) => {
  const [profiling, setProfiling] = useState<DataProfilingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Scatter-plot selectors
  const [scatterX, setScatterX] = useState<string>('');
  const [scatterY, setScatterY] = useState<string>('');
  
  // Initial tab for MetricDetailsTabs (0=Valores nulos, 1=Registros duplicados, 2=Outliers)
  const [initialMetricTab, setInitialMetricTab] = useState<number>(0);

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
  // ══════════════════════════════════════════════════════════════════════════════
  // IMPORTANTE: Completitud, Unicidad y Outliers son CARACTERÍSTICAS DEL DATASET
  // NO son métricas de evaluación de calidad de datos.
  // 
  // En el futuro, estas características se separarán del sistema de evaluaciones
  // para dejar paso a las métricas reales de calidad de datos.
  // 
  // Por ahora, se mantiene la compatibilidad con el formato de evaluaciones para
  // reutilizar los componentes de visualización (MetricDetailsTabs, etc.)
  // ══════════════════════════════════════════════════════════════════════════════
  const { evalColumnMetrics, evalOverallMetrics } = useMemo(() => {
    if (!profiling) return { evalColumnMetrics: {} as Record<string, ColumnMetrics>, evalOverallMetrics: {} as Record<string, any> };

    // Construir características por columna (NO métricas de evaluación)
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
    // Calcular características generales del dataset (NO métricas de evaluación)
    const overallCompleteness = ov.total_cells > 0 ? (ov.total_cells - ov.total_missing) / ov.total_cells : 1;
    const overallUniqueness = ov.total_rows > 0 ? (ov.total_rows - ov.duplicate_rows) / ov.total_rows : 1;

    return {
      evalColumnMetrics: cm, // NOTA: Nombre temporal por compatibilidad, representa características por columna
      evalOverallMetrics: {  // NOTA: Nombre temporal por compatibilidad, representa características generales
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

  const openAnalysisDetails = useCallback((tabIndex: number = 0) => {
    setInitialMetricTab(tabIndex);
    setSections(prev => ({ ...prev, metricDetails: true }));
    setTimeout(() => {
      document.getElementById('profiling-analysis-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const openValoresNulos = useCallback(() => openAnalysisDetails(0), [openAnalysisDetails]);
  const openRegistrosDuplicados = useCallback(() => openAnalysisDetails(1), [openAnalysisDetails]);
  const openOutliers = useCallback(() => openAnalysisDetails(2), [openAnalysisDetails]);

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
  const nullPct = ((1 - compVal) * 100).toFixed(1); // % de valores nulos
  const nullCols = Object.values(evalColumnMetrics).filter((c: any) => (c.n_nulls || 0) > 0).length;
  const compBadge = badgeFor(compVal);

  const uniqVal = evalOverallMetrics.uniqueness ?? 1;
  const dupPct = ((1 - uniqVal) * 100).toFixed(1); // % de registros duplicados
  // Badge basado en % de duplicados invertido: menos duplicados = mejor
  // Si hay 2% duplicados, el badge se calcula como si tuviéramos 98% de "calidad"
  const uniqBadge = badgeFor(uniqVal);

  const outlierMap = evalOverallMetrics.outliers || {};
  const totalOutliers = Object.values(outlierMap).reduce((s: number, c: any) => s + (c?.count || 0), 0);
  const totalOutlierVals = Object.values(outlierMap).reduce((s: number, c: any) => s + (c?.total_values || 0), 0);
  const outlierProp = totalOutlierVals > 0 ? totalOutliers / totalOutlierVals : 0;
  const outlierColCount = Object.values(outlierMap).filter((c: any) => c?.count > 0).length;
  // Badge basado en proporción de outliers (densidad): menos outliers = mejor
  // Invertimos la lógica: 1 - outlierProp para que 0% outliers = 100% "calidad"
  const outBadge = badgeFor(1 - outlierProp);

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

        {/* ═══════════════════════════════════════════════════════════════════
             CARACTERÍSTICAS DEL DATASET (NO métricas de evaluación)
             Estas tarjetas muestran propiedades intrínsecas del dataset:
             - Valores nulos (completitud)
             - Registros duplicados (unicidad)
             - Outliers (valores atípicos)
             ═══════════════════════════════════════════════════════════════════ */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <MetricCard
              title="Valores nulos"
              value={`${nullPct}%`}
              badge={compBadge}
              insight={nullCols > 0 ? `${nullCols} de ${overview.total_columns} columnas con nulos` : 'Sin valores nulos'}
              onDetail={openValoresNulos}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MetricCard
              title="Registros duplicados"
              value={`${dupPct}%`}
              badge={uniqBadge}
              insight={overview.duplicate_rows > 0
                ? `${overview.duplicate_rows.toLocaleString()} fila${overview.duplicate_rows !== 1 ? 's' : ''} duplicada${overview.duplicate_rows !== 1 ? 's' : ''}`
                : 'Sin filas duplicadas'}
              onDetail={openRegistrosDuplicados}
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
              onDetail={openOutliers}
            />
          </Grid>
        </Grid>
      </CollapsibleSection>

      {/* ══════════════════════════════════════════════════════════════════════════════
           SECTION 2 – Análisis Detallado de Características del Dataset
           
           IMPORTANTE: Esta sección muestra CARACTERÍSTICAS DEL DATASET, NO métricas.
           - Valores nulos (completitud)
           - Registros duplicados (unicidad)  
           - Outliers (valores atípicos)
           
           En el futuro, esta sección se separará del sistema de evaluaciones para
           enfocarse exclusivamente en características descriptivas del dataset.
           ══════════════════════════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        id="profiling-analysis-details"
        icon={<ManageSearchIcon sx={{ color: '#00B37E' }} />}
        title="Valores nulos, registros duplicados y outliers"
        subtitle="Completitud, unicidad y valores atípicos"
        open={sections.metricDetails}
        onToggle={() => toggle('metricDetails')}
      >
        {/* NOTA: MetricDetailsTabs se reutiliza temporalmente para mostrar características.
            En el futuro, se creará un componente específico para características del dataset. */}
        <MetricDetailsTabs overallMetrics={evalOverallMetrics} columnMetrics={evalColumnMetrics} datasetId={datasetId} initialTab={initialMetricTab} />
      </CollapsibleSection>

      {/* ── SECTION 3 – Per-column Analysis ── */}
      <CollapsibleSection
        icon={<BarChartIcon sx={{ color: '#00B37E' }} />}
        title="Análisis por columna"
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
                    <Grid container spacing={1.5} sx={{ alignItems: 'stretch' }}>
                      <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
                        <Box sx={{ width: '100%' }}>
                          <EnhancedHistogramCard column={col} />
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
                        <Box sx={{ width: '100%' }}>
                          <EnhancedBoxplotCard column={col} />
                        </Box>
                      </Grid>
                    </Grid>
                  </>
                ) : (
                  /* ── Categorical ── */
                  <Grid container spacing={1.5} sx={{ alignItems: 'stretch' }}>
                    <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: 1, 
                        height: '100%',
                        justifyContent: 'center'
                      }}>
                        <Box sx={{ 
                          p: 1.5, 
                          bgcolor: '#FAFAFA', 
                          borderRadius: 1.5, 
                          border: '1px solid #F0F0F0',
                          textAlign: 'center'
                        }}>
                          <Typography variant="caption" sx={{ color: '#999', display: 'block', fontSize: '0.65rem', mb: 0.5 }}>Valores únicos</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'monospace', color: '#7b1fa2', fontSize: '1.5rem' }}>{col.n_unique.toLocaleString()}</Typography>
                        </Box>
                        <Box sx={{ 
                          p: 1.5, 
                          bgcolor: '#FAFAFA', 
                          borderRadius: 1.5, 
                          border: '1px solid #F0F0F0',
                          textAlign: 'center'
                        }}>
                          <Typography variant="caption" sx={{ color: '#999', display: 'block', fontSize: '0.65rem', mb: 0.5 }}>Moda (más frecuente)</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#333', fontSize: '0.9rem', wordBreak: 'break-word' }}>{col.mode || '—'}</Typography>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={8} sx={{ display: 'flex' }}>
                      <Box sx={{ width: '100%' }}>
                        <EnhancedBarChartCard column={col} />
                      </Box>
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
          title="Matriz de correlación"
          subtitle={`${correlation_matrix.columns.length} variables numéricas · Pearson`}
          open={sections.correlation}
          onToggle={() => toggle('correlation')}
        >
          <Box sx={{ overflowX: 'auto', pb: 1 }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 12, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 6px' }} />
                  {correlation_matrix.columns.map(c => (
                    <th key={c} style={{ 
                      padding: '8px 6px', 
                      fontWeight: 700, 
                      fontSize: '0.7rem', 
                      color: '#555', 
                      maxWidth: 80, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap', 
                      textAlign: 'center',
                      background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
                      borderRadius: '6px 6px 0 0'
                    }}>
                      <Tooltip title={c} arrow><span>{c.length > 8 ? c.slice(0, 8) + '…' : c}</span></Tooltip>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {correlation_matrix.values.map((row, i) => (
                  <tr key={i}>
                    <td style={{ 
                      padding: '8px 10px', 
                      fontWeight: 700, 
                      whiteSpace: 'nowrap', 
                      fontSize: '0.72rem', 
                      color: '#555',
                      background: 'linear-gradient(90deg, #fafafa 0%, #f5f5f5 100%)',
                      borderRadius: '6px 0 0 6px',
                    }}>
                      <Tooltip title={correlation_matrix!.columns[i]} arrow>
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
                            padding: '8px 6px', 
                            textAlign: 'center', 
                            fontWeight: isDiagonal ? 700 : 600,
                            fontSize: '0.75rem', 
                            color: isDiagonal ? '#333' : text,
                            backgroundColor: isDiagonal ? '#F5F5F5' : bg, 
                            borderRadius: 6, 
                            fontFamily: 'monospace',
                            cursor: isDiagonal ? 'default' : 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            border: isDiagonal ? '1px solid #E0E0E0' : '1px solid transparent',
                            boxShadow: isDiagonal ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                          onMouseEnter={(e) => {
                            if (!isDiagonal) {
                              e.currentTarget.style.transform = 'scale(1.15)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,179,126,0.25)';
                              e.currentTarget.style.zIndex = '10';
                              e.currentTarget.style.border = '1px solid #ffffff';
                              e.currentTarget.style.fontWeight = '700';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isDiagonal) {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                              e.currentTarget.style.zIndex = '1';
                              e.currentTarget.style.border = '1px solid transparent';
                              e.currentTarget.style.fontWeight = '600';
                            }
                          }}
                        >
                          <Tooltip 
                            title={
                              isDiagonal ? (
                                <Box sx={{ textAlign: 'center', py: 0.5 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                                    {correlation_matrix!.columns[i]}
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', opacity: 0.8 }}>
                                    Correlación perfecta consigo misma
                                  </Typography>
                                </Box>
                              ) : (
                                <Box sx={{ textAlign: 'center', py: 0.5 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                                    {correlation_matrix!.columns[i]} vs {correlation_matrix!.columns[j]}
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block' }}>
                                    Coeficiente: {v.toFixed(4)}
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', opacity: 0.9 }}>
                                    {Math.abs(v) < 0.3 ? 'Correlación débil' : 
                                     Math.abs(v) < 0.7 ? 'Correlación moderada' : 
                                     'Correlación fuerte'}
                                    {v > 0 ? ' positiva' : v < 0 ? ' negativa' : ''}
                                  </Typography>
                                  <Typography variant="caption" sx={{ display: 'block', fontSize: '0.6rem', opacity: 0.7, mt: 0.5, fontStyle: 'italic' }}>
                                    Click para ver gráfico de dispersión
                                  </Typography>
                                </Box>
                              )
                            }
                            arrow
                          >
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
          <Box sx={{ 
            mt: 3, 
            p: 2.5, 
            background: 'linear-gradient(135deg, #fafafa 0%, #ffffff 100%)', 
            borderRadius: 2, 
            border: '1px solid #E8E8E8' 
          }}>
            <Typography variant="caption" sx={{ 
              fontWeight: 700, 
              fontSize: '0.7rem', 
              color: '#555', 
              display: 'block', 
              mb: 1.5, 
              textAlign: 'center',
              letterSpacing: '0.02em'
            }}>
              Leyenda de correlación
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#4466CC', fontWeight: 700, fontSize: '0.75rem', display: 'block' }}>
                  −1.0
                </Typography>
                <Typography variant="caption" sx={{ color: '#888', fontSize: '0.6rem', display: 'block' }}>
                  Negativa
                </Typography>
              </Box>
              <Box sx={{ 
                width: 200, 
                height: 12, 
                borderRadius: 6, 
                background: 'linear-gradient(to right, #4466CC, #8899DD, #FAFAFA, #DD9988, #CC6644)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                border: '1px solid #E0E0E0'
              }} />
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ color: '#CC6644', fontWeight: 700, fontSize: '0.75rem', display: 'block' }}>
                  +1.0
                </Typography>
                <Typography variant="caption" sx={{ color: '#888', fontSize: '0.6rem', display: 'block' }}>
                  Positiva
                </Typography>
              </Box>
            </Box>
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
            <Box sx={{ 
              p: 4, 
              border: '2px dashed #E8E8E8', 
              borderRadius: 2, 
              textAlign: 'center',
              background: 'linear-gradient(135deg, #fafafa 0%, #ffffff 100%)'
            }}>
              <BubbleChartIcon sx={{ fontSize: 48, color: '#CCC', mb: 1 }} />
              <Typography variant="body2" sx={{ color: '#999', fontWeight: 500 }}>
                Selecciona dos variables numéricas distintas
              </Typography>
              <Typography variant="caption" sx={{ color: '#BBB', display: 'block', mt: 0.5 }}>
                Usa los selectores de arriba para elegir las variables
              </Typography>
            </Box>
          )}
        </CollapsibleSection>
      )}
    </Box>
  );
};

// ── Enhanced Boxplot Component ──────────────────────────────────
const EnhancedBoxplot: React.FC<{ 
  boxplot: NonNullable<ProfilingColumn['boxplot']>;
  columnName?: string;
  onExpand?: () => void;
  isExpanded?: boolean;
}> = ({ boxplot, columnName, onExpand, isExpanded = false }) => {
  const range = boxplot.max - boxplot.min;
  if (range === 0) return <Typography variant="caption" sx={{ color: '#999' }}>Todos los valores son iguales</Typography>;

  const toX = (v: number) => Math.max(5, Math.min(995, ((v - boxplot.min) / range) * 990 + 5));
  const [lbX, ubX, q1X, q3X, medX] = [toX(boxplot.lower_fence), toX(boxplot.upper_fence), toX(boxplot.q1), toX(boxplot.q3), toX(boxplot.median)];
  const height = isExpanded ? 120 : 60;
  const yCenter = height / 2;
  const boxHeight = isExpanded ? 50 : 32;
  const boxY = (height - boxHeight) / 2;

  return (
    <Box sx={{ position: 'relative' }}>
      {onExpand && (
        <IconButton
          size="small"
          onClick={onExpand}
          sx={{
            position: 'absolute',
            top: -8,
            right: -8,
            zIndex: 10,
            bgcolor: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: '#00B37E',
              color: 'white',
              transform: 'scale(1.1)',
            },
          }}
        >
          <FullscreenIcon fontSize="small" />
        </IconButton>
      )}
      <svg width="100%" height={height} viewBox={`0 0 1000 ${height}`} preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="boxGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#00B37E', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: '#00B37E', stopOpacity: 0.6 }} />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
          </filter>
        </defs>
        
        {/* Lower whisker */}
        <Tooltip 
          title={
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>Límite Inferior (Whisker)</Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>Valor: {boxplot.lower_fence.toFixed(2)}</Typography>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', opacity: 0.8 }}>Valores por debajo son outliers</Typography>
            </Box>
          } 
          arrow
        >
          <g>
            <line x1={lbX} y1={yCenter} x2={q1X} y2={yCenter} stroke="#999" strokeWidth="2" strokeDasharray="6,3" style={{ cursor: 'help' }} />
            <line x1={lbX} y1={yCenter - 15} x2={lbX} y2={yCenter + 15} stroke="#999" strokeWidth="2" style={{ cursor: 'help' }} />
          </g>
        </Tooltip>
        
        {/* Upper whisker */}
        <Tooltip 
          title={
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>Límite Superior (Whisker)</Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>Valor: {boxplot.upper_fence.toFixed(2)}</Typography>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', opacity: 0.8 }}>Valores por encima son outliers</Typography>
            </Box>
          } 
          arrow
        >
          <g>
            <line x1={q3X} y1={yCenter} x2={ubX} y2={yCenter} stroke="#999" strokeWidth="2" strokeDasharray="6,3" style={{ cursor: 'help' }} />
            <line x1={ubX} y1={yCenter - 15} x2={ubX} y2={yCenter + 15} stroke="#999" strokeWidth="2" style={{ cursor: 'help' }} />
          </g>
        </Tooltip>
        
        {/* IQR Box (Q1 to Q3) */}
        <Tooltip 
          title={
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>Rango Intercuartílico (IQR)</Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>Cuartil 1 (Q1): {boxplot.q1.toFixed(2)}</Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>Cuartil 3 (Q3): {boxplot.q3.toFixed(2)}</Typography>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', opacity: 0.8, mt: 0.5 }}>Contiene el 50% central de los datos</Typography>
            </Box>
          } 
          arrow
        >
          <rect 
            x={q1X} 
            y={boxY} 
            width={Math.max(q3X - q1X, 4)} 
            height={boxHeight} 
            rx="4" 
            fill="url(#boxGradient)" 
            stroke="#00B37E" 
            strokeWidth="2.5" 
            style={{ cursor: 'help', filter: 'url(#shadow)' }}
          />
        </Tooltip>
        
        {/* Median line (Q2) */}
        <Tooltip 
          title={
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>Mediana (Q2)</Typography>
              <Typography variant="caption" sx={{ display: 'block' }}>Valor: {boxplot.median.toFixed(2)}</Typography>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', opacity: 0.8 }}>Valor central de la distribución</Typography>
            </Box>
          } 
          arrow
        >
          <line x1={medX} y1={boxY} x2={medX} y2={boxY + boxHeight} stroke="#004D40" strokeWidth="3" style={{ cursor: 'help' }} />
        </Tooltip>
        
        {/* Outliers */}
        {boxplot.outliers_sample.slice(0, isExpanded ? 50 : 25).map((v, i) => (
          <Tooltip 
            key={i} 
            title={
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>Valor Atípico (Outlier)</Typography>
                <Typography variant="caption" sx={{ display: 'block' }}>Valor: {v.toFixed(2)}</Typography>
                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', opacity: 0.8 }}>Fuera del rango normal</Typography>
              </Box>
            } 
            arrow
          >
            <circle 
              cx={toX(v)} 
              cy={yCenter} 
              r={isExpanded ? 5 : 3.5} 
              fill="#E5484D" 
              stroke="#fff" 
              strokeWidth="1.5" 
              opacity="0.85" 
              style={{ cursor: 'help', filter: 'url(#shadow)' }}
            />
          </Tooltip>
        ))}
      </svg>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5, mt: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#888', fontFamily: 'monospace', fontSize: '0.65rem', fontWeight: 600 }}>
          {boxplot.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Typography>
        <Typography variant="caption" sx={{ color: '#888', fontFamily: 'monospace', fontSize: '0.65rem', fontWeight: 600 }}>
          {boxplot.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </Typography>
      </Box>
      {boxplot.outlier_count > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, justifyContent: 'center' }}>
          <WarningIcon sx={{ color: '#FFB800', fontSize: 14 }} />
          <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem', fontWeight: 500 }}>
            {boxplot.outlier_count} outlier{boxplot.outlier_count > 1 ? 's' : ''} detectado{boxplot.outlier_count > 1 ? 's' : ''}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const MiniBoxplot = EnhancedBoxplot;

// ── Scatter Plot (fetches on demand) ────────────────────────────
const ScatterPlotChart: React.FC<{ datasetId: number; xCol: string; yCol: string }> = ({ datasetId, xCol, yCol }) => {
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

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

  const chartOptions = (isExpanded: boolean) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.9)',
        padding: 14,
        titleFont: { size: 13, weight: 'bold' as const },
        bodyFont: { size: 12 },
        borderColor: '#00B37E',
        borderWidth: 2,
        displayColors: false,
        callbacks: {
          title: () => 'Punto de datos',
          label: (context: any) => {
            const xVal = context.parsed.x;
            const yVal = context.parsed.y;
            return [
              `${xCol}: ${xVal.toFixed(2)}`,
              `${yCol}: ${yVal.toFixed(2)}`
            ];
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: xCol,
          color: '#555',
          font: { weight: 700, size: isExpanded ? 13 : 11 },
        },
        grid: { color: '#F0F0F0', lineWidth: 1 },
        ticks: {
          color: '#666',
          font: { size: isExpanded ? 11 : 9, weight: 500 },
        },
      },
      y: {
        title: {
          display: true,
          text: yCol,
          color: '#555',
          font: { weight: 700, size: isExpanded ? 13 : 11 },
        },
        grid: { color: '#F0F0F0', lineWidth: 1 },
        ticks: {
          color: '#666',
          font: { size: isExpanded ? 11 : 9, weight: 500 },
        },
      },
    },
    animation: {
      duration: 750,
      easing: 'easeInOutQuart' as const,
    },
  });

  const chartData = {
    datasets: [{
      label: `${xCol} vs ${yCol}`,
      data: points,
      backgroundColor: 'rgba(0,179,126,0.5)',
      borderColor: 'rgba(0,179,126,0.8)',
      borderWidth: 1.5,
      pointRadius: 3.5,
      pointHoverRadius: 6,
      pointHoverBackgroundColor: '#00B37E',
      pointHoverBorderColor: '#fff',
      pointHoverBorderWidth: 2,
    }],
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} sx={{ color: '#00B37E' }} /></Box>;
  if (points.length === 0) return <Box sx={{ py: 2, textAlign: 'center' }}><Typography variant="caption" sx={{ color: '#BBB' }}>Sin datos suficientes.</Typography></Box>;

  return (
    <>
      <Box
        sx={{
          height: 300,
          p: 1.5,
          border: '1px solid #E8E8E8',
          borderRadius: 2,
          position: 'relative',
          background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
          transition: 'all 0.3s',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            borderColor: '#00B37E',
          },
        }}
      >
        <IconButton
          size="small"
          onClick={() => setModalOpen(true)}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            bgcolor: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: '#00B37E',
              color: 'white',
              transform: 'scale(1.1)',
            },
          }}
        >
          <FullscreenIcon fontSize="small" />
        </IconButton>
        <Scatter data={chartData} options={chartOptions(false)} />
      </Box>

      <ChartModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Dispersión: ${xCol} vs ${yCol}`}
      >
        <Box sx={{ height: 450 }}>
          <Scatter data={chartData} options={chartOptions(true)} />
        </Box>
      </ChartModal>
    </>
  );
};

export default DataProfilingTab;
