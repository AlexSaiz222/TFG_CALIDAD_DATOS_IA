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
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Storage as StorageIcon,
  Functions as FunctionsIcon,
  Category as CategoryIcon,
  BarChart as BarChartIcon,
  BubbleChart as BubbleChartIcon,
  GridOn as GridOnIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { datasetsAPI } from '../services/api';
import type { DataProfilingResult, ProfilingColumn } from '../types';

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

// Colour scale for the correlation heatmap (-1 → blue, 0 → white, 1 → red)
function correlationColor(v: number): string {
  if (v >= 0) {
    const intensity = Math.round(v * 200);
    return `rgb(${intensity}, ${Math.max(60, 100 - intensity / 2)}, ${60})`;
  }
  const intensity = Math.round(Math.abs(v) * 200);
  return `rgb(${60}, ${Math.max(60, 100 - intensity / 2)}, ${intensity})`;
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

  // Build per-column lookup for scatter data
  const numericColumnData = useMemo(() => {
    if (!profiling) return {} as Record<string, ProfilingColumn>;
    const map: Record<string, ProfilingColumn> = {};
    for (const col of profiling.columns) {
      if (col.category === 'numeric') map[col.name] = col;
    }
    return map;
  }, [profiling]);

  // ── Render states ─────────────────────────────────────────────
  if (loading) {
    return (
      // @ts-ignore – MUI sx union type complexity
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

  // ── SECTION 1 – Dataset Overview ──────────────────────────────
  const OverviewSection = (
    <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #EEEEEE' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <StorageIcon sx={{ color: '#00B37E' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Visión General del Dataset</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Row / Col / Size cards */}
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: '#F8F9FA', borderRadius: 2 }}>
            <Typography variant="body2" sx={{ color: '#777', mb: 0.5 }}>Filas</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{overview.total_rows.toLocaleString()}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: '#F8F9FA', borderRadius: 2 }}>
            <Typography variant="body2" sx={{ color: '#777', mb: 0.5 }}>Columnas</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{overview.total_columns}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: '#F8F9FA', borderRadius: 2 }}>
            <Typography variant="body2" sx={{ color: '#777', mb: 0.5 }}>Tamaño</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{formatBytes(overview.estimated_size_bytes)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, textAlign: 'center', bgcolor: '#F8F9FA', borderRadius: 2 }}>
            <Typography variant="body2" sx={{ color: '#777', mb: 0.5 }}>Celdas Totales</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>{overview.total_cells.toLocaleString()}</Typography>
          </Paper>
        </Grid>

        {/* Completeness gauge */}
        <Grid item xs={12} sm={6}>
          <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#F8F9FA', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Completitud</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: overview.missing_percent > 10 ? '#E5484D' : overview.missing_percent > 3 ? '#FFB800' : '#00B37E' }}>
                {(100 - overview.missing_percent).toFixed(1)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={100 - overview.missing_percent}
              sx={{
                height: 10, borderRadius: 5, bgcolor: '#E0E0E0',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 5,
                  bgcolor: overview.missing_percent > 10 ? '#E5484D' : overview.missing_percent > 3 ? '#FFB800' : '#00B37E',
                },
              }}
            />
            <Typography variant="caption" sx={{ color: '#888', mt: 0.5, display: 'block' }}>
              {overview.total_missing.toLocaleString()} celdas vacías ({overview.missing_percent}%)
            </Typography>
          </Paper>
        </Grid>

        {/* Uniqueness gauge */}
        <Grid item xs={12} sm={6}>
          <Paper elevation={0} sx={{ p: 2.5, bgcolor: '#F8F9FA', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>Unicidad (filas)</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, color: overview.duplicate_percent > 10 ? '#E5484D' : overview.duplicate_percent > 3 ? '#FFB800' : '#00B37E' }}>
                {(100 - overview.duplicate_percent).toFixed(1)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={100 - overview.duplicate_percent}
              sx={{
                height: 10, borderRadius: 5, bgcolor: '#E0E0E0',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 5,
                  bgcolor: overview.duplicate_percent > 10 ? '#E5484D' : overview.duplicate_percent > 3 ? '#FFB800' : '#00B37E',
                },
              }}
            />
            <Typography variant="caption" sx={{ color: '#888', mt: 0.5, display: 'block' }}>
              {overview.duplicate_rows.toLocaleString()} filas duplicadas ({overview.duplicate_percent}%)
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );

  // ── SECTION 2 – Type Summary ──────────────────────────────────
  const TypeSummarySection = (
    <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #EEEEEE' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <CategoryIcon sx={{ color: '#1976d2' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Tipos de Datos</Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(25, 118, 210, 0.06)', borderRadius: 2, border: '1px solid rgba(25, 118, 210, 0.15)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <FunctionsIcon sx={{ color: '#1976d2', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1976d2' }}>
                Numéricas ({type_summary.numeric_count})
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {type_summary.numeric_columns.map(c => (
                <Chip key={c} label={c} size="small" sx={{ bgcolor: 'rgba(25, 118, 210, 0.10)', color: '#1565c0', fontWeight: 500 }} />
              ))}
              {type_summary.numeric_columns.length === 0 && (
                <Typography variant="caption" sx={{ color: '#999' }}>Sin columnas numéricas</Typography>
              )}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(123, 31, 162, 0.06)', borderRadius: 2, border: '1px solid rgba(123, 31, 162, 0.15)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CategoryIcon sx={{ color: '#7b1fa2', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#7b1fa2' }}>
                Categóricas ({type_summary.categorical_count})
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {type_summary.categorical_columns.map(c => (
                <Chip key={c} label={c} size="small" sx={{ bgcolor: 'rgba(123, 31, 162, 0.10)', color: '#6a1b9a', fontWeight: 500 }} />
              ))}
              {type_summary.categorical_columns.length === 0 && (
                <Typography variant="caption" sx={{ color: '#999' }}>Sin columnas categóricas</Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );

  // ── SECTION 3 & 4 – Per-column stats + visualisations ─────────
  const ColumnsSection = (
    <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #EEEEEE' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <BarChartIcon sx={{ color: '#00B37E' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Análisis por Columna</Typography>
      </Box>

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
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <Chip
                label={col.category === 'numeric' ? 'NUM' : 'CAT'}
                size="small"
                sx={{
                  fontWeight: 700, fontSize: '0.7rem', minWidth: 42,
                  bgcolor: getCategoryColor(col.category) + '18',
                  color: getCategoryColor(col.category),
                }}
              />
              <Typography sx={{ fontWeight: 600, flexGrow: 1 }}>{col.name}</Typography>
              <Chip label={getSubTypeLabel(col.sub_type)} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
              {col.missing_percent > 5 && (
                <Tooltip title={`${col.missing_percent}% valores nulos`}>
                  <WarningIcon sx={{ color: '#FFB800', fontSize: 18 }} />
                </Tooltip>
              )}
              <Typography variant="caption" sx={{ color: '#999', minWidth: 60, textAlign: 'right' }}>
                {col.n_unique} únicos
              </Typography>
            </Box>
          </AccordionSummary>

          <AccordionDetails sx={{ px: 2, pb: 3 }}>
            {/* Missing bar */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Completitud</Typography>
                <Typography variant="caption">{(100 - col.missing_percent).toFixed(1)}% ({col.n_valid.toLocaleString()} válidos / {col.n_missing.toLocaleString()} nulos)</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={100 - col.missing_percent}
                sx={{ height: 6, borderRadius: 3, bgcolor: '#E0E0E0', '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: '#00B37E' } }}
              />
            </Box>

            <Divider sx={{ mb: 2 }} />

            {col.category === 'numeric' ? (
              <Grid container spacing={2}>
                {/* Stats table */}
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Estadísticas Descriptivas</Typography>
                  {[
                    { label: 'Media', value: col.mean },
                    { label: 'Mediana', value: col.median },
                    { label: 'Desv. Estándar', value: col.std },
                    { label: 'Mínimo', value: col.min },
                    { label: 'Máximo', value: col.max },
                    { label: 'Q1 (P25)', value: col.q1 },
                    { label: 'Q3 (P75)', value: col.q3 },
                    { label: 'IQR', value: col.iqr },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
                      <Typography variant="body2" sx={{ color: '#666' }}>{label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {value !== null && value !== undefined ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}
                      </Typography>
                    </Box>
                  ))}
                </Grid>

                {/* Histogram */}
                <Grid item xs={12} md={4}>
                  {col.histogram && col.histogram.bins.length > 0 ? (
                    <>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Histograma</Typography>
                      <Box sx={{ height: 200 }}>
                        <Bar
                          data={{
                            labels: col.histogram.bins.map(b => b.toFixed(1)),
                            datasets: [{
                              data: col.histogram.counts,
                              backgroundColor: 'rgba(25, 118, 210, 0.6)',
                              borderColor: 'rgba(25, 118, 210, 1)',
                              borderWidth: 1,
                            }],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false }, tooltip: { mode: 'index' } },
                            scales: {
                              x: { display: true, ticks: { maxTicksLimit: 6, font: { size: 9 } } },
                              y: { display: true, beginAtZero: true, ticks: { font: { size: 9 } } },
                            },
                          }}
                        />
                      </Box>
                    </>
                  ) : (
                    <Typography variant="caption" sx={{ color: '#999' }}>Sin datos para histograma</Typography>
                  )}
                </Grid>

                {/* Boxplot visualisation (drawn with CSS since Chart.js core has no boxplot) */}
                <Grid item xs={12} md={4}>
                  {col.boxplot ? (
                    <>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Boxplot</Typography>
                      <BoxplotViz boxplot={col.boxplot} />
                    </>
                  ) : (
                    <Typography variant="caption" sx={{ color: '#999' }}>Sin datos para boxplot</Typography>
                  )}
                </Grid>
              </Grid>
            ) : (
              /* Categorical column */
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Resumen</Typography>
                  {[
                    { label: 'Valores únicos', value: col.n_unique },
                    { label: 'Moda', value: col.mode || '—' },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
                      <Typography variant="body2" sx={{ color: '#666' }}>{label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{String(value)}</Typography>
                    </Box>
                  ))}
                </Grid>

                {/* Bar chart */}
                <Grid item xs={12} md={8}>
                  {col.bar_chart && col.bar_chart.labels.length > 0 ? (
                    <>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Distribución de Categorías</Typography>
                      <Box sx={{ height: 220 }}>
                        <Bar
                          data={{
                            labels: col.bar_chart.labels,
                            datasets: [{
                              data: col.bar_chart.counts,
                              backgroundColor: 'rgba(123, 31, 162, 0.55)',
                              borderColor: 'rgba(123, 31, 162, 1)',
                              borderWidth: 1,
                            }],
                          }}
                          options={{
                            indexAxis: col.bar_chart.labels.length > 8 ? 'y' as const : 'x' as const,
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                              x: { ticks: { font: { size: 10 } } },
                              y: { ticks: { font: { size: 10 } }, beginAtZero: true },
                            },
                          }}
                        />
                      </Box>
                    </>
                  ) : (
                    <Typography variant="caption" sx={{ color: '#999' }}>Sin datos para gráfico</Typography>
                  )}
                </Grid>
              </Grid>
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Paper>
  );

  // ── SECTION 5 – Correlation Matrix + optional Scatter ─────────
  const CorrelationSection = correlation_matrix ? (
    <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #EEEEEE' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <GridOnIcon sx={{ color: '#d32f2f' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Matriz de Correlación</Typography>
      </Box>

      {/* Heatmap */}
      <Box sx={{ overflowX: 'auto', mb: 3 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: 4 }}></th>
              {correlation_matrix.columns.map(c => (
                <th key={c} style={{ padding: '4px 6px', fontWeight: 600, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Tooltip title={c}><span>{c.length > 10 ? c.slice(0, 10) + '…' : c}</span></Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {correlation_matrix.values.map((row, i) => (
              <tr key={i}>
                <td style={{ padding: '4px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  <Tooltip title={correlation_matrix!.columns[i]}>
                    <span>{correlation_matrix!.columns[i].length > 12 ? correlation_matrix!.columns[i].slice(0, 12) + '…' : correlation_matrix!.columns[i]}</span>
                  </Tooltip>
                </td>
                {row.map((v, j) => (
                  <td
                    key={j}
                    style={{
                      padding: '6px 8px',
                      textAlign: 'center',
                      fontWeight: i === j ? 700 : 400,
                      color: '#fff',
                      backgroundColor: correlationColor(v),
                      borderRadius: 2,
                    }}
                  >
                    <Tooltip title={`${correlation_matrix!.columns[i]} ↔ ${correlation_matrix!.columns[j]}: ${v.toFixed(4)}`}>
                      <span>{v.toFixed(2)}</span>
                    </Tooltip>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      {/* Scatter plot selector */}
      {type_summary.numeric_columns.length >= 2 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <BubbleChartIcon sx={{ color: '#00B37E' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Gráfico de Dispersión</Typography>
          </Box>
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
            <ScatterPlot datasetId={datasetId} xCol={scatterX} yCol={scatterY} />
          ) : (
            <Typography variant="caption" sx={{ color: '#999' }}>
              Selecciona dos variables numéricas distintas para ver su relación.
            </Typography>
          )}
        </>
      )}
    </Paper>
  ) : null;

  // ── Final render ──────────────────────────────────────────────
  return (
    <Box>
      {OverviewSection}
      {TypeSummarySection}
      {ColumnsSection}
      {CorrelationSection}
    </Box>
  );
};

// ── Boxplot CSS Visualisation ───────────────────────────────────
interface BoxplotVizProps {
  boxplot: NonNullable<ProfilingColumn['boxplot']>;
}

const BoxplotViz: React.FC<BoxplotVizProps> = ({ boxplot }) => {
  const range = boxplot.max - boxplot.min;
  if (range === 0) {
    return <Typography variant="caption" sx={{ color: '#999' }}>Todos los valores son iguales</Typography>;
  }
  const pct = (v: number) => ((v - boxplot.min) / range) * 100;

  return (
    <Box sx={{ px: 1, py: 2 }}>
      {/* Scale */}
      <Box sx={{ position: 'relative', height: 60, mb: 1 }}>
        {/* Whiskers line */}
        <Box sx={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          left: `${pct(boxplot.lower_fence)}%`,
          width: `${pct(boxplot.upper_fence) - pct(boxplot.lower_fence)}%`,
          height: 2, bgcolor: '#666',
        }} />
        {/* Box */}
        <Box sx={{
          position: 'absolute', top: '20%', height: '60%',
          left: `${pct(boxplot.q1)}%`,
          width: `${pct(boxplot.q3) - pct(boxplot.q1)}%`,
          bgcolor: 'rgba(25, 118, 210, 0.2)',
          border: '2px solid rgba(25, 118, 210, 0.7)',
          borderRadius: 1,
        }} />
        {/* Median line */}
        <Box sx={{
          position: 'absolute', top: '15%', height: '70%',
          left: `${pct(boxplot.median)}%`,
          width: 3, bgcolor: '#d32f2f', borderRadius: 1,
        }} />
        {/* Whisker end lines */}
        {[boxplot.lower_fence, boxplot.upper_fence].map((v, i) => (
          <Box key={i} sx={{
            position: 'absolute', top: '30%', height: '40%',
            left: `${pct(v)}%`, width: 2, bgcolor: '#666',
          }} />
        ))}
        {/* Outlier dots */}
        {boxplot.outliers_sample.slice(0, 20).map((v, i) => (
          <Tooltip key={i} title={`Outlier: ${v}`}>
            <Box sx={{
              position: 'absolute', top: '45%', transform: 'translate(-50%, -50%)',
              left: `${Math.min(100, Math.max(0, pct(v)))}%`,
              width: 6, height: 6, borderRadius: '50%',
              bgcolor: '#E5484D', opacity: 0.7,
            }} />
          </Tooltip>
        ))}
      </Box>
      {/* Labels */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#999' }}>{boxplot.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Typography>
        <Typography variant="caption" sx={{ color: '#999' }}>{boxplot.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Typography>
      </Box>
      {boxplot.outlier_count > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <WarningIcon sx={{ color: '#FFB800', fontSize: 14 }} />
          <Typography variant="caption" sx={{ color: '#888' }}>
            {boxplot.outlier_count} outlier{boxplot.outlier_count > 1 ? 's' : ''} detectado{boxplot.outlier_count > 1 ? 's' : ''}
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

  if (loading) return <CircularProgress size={20} sx={{ color: '#00B37E' }} />;
  if (points.length === 0) return <Typography variant="caption" sx={{ color: '#999' }}>Sin datos suficientes</Typography>;

  return (
    <Box sx={{ height: 300 }}>
      <Scatter
        data={{
          datasets: [{
            label: `${xCol} vs ${yCol}`,
            data: points,
            backgroundColor: 'rgba(0, 179, 126, 0.5)',
            borderColor: 'rgba(0, 179, 126, 1)',
            pointRadius: 3,
          }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { title: { display: true, text: xCol } },
            y: { title: { display: true, text: yCol } },
          },
        }}
      />
    </Box>
  );
};

export default DataProfilingTab;
