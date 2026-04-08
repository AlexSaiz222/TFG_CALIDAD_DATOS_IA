import React, { useMemo, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Box, Typography } from '@mui/material';
import type { AnalysisRun } from '../types';

ChartJS.register(
  CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Tooltip, Legend, Filler,
);

// ─── paleta de la app ──────────────────────────────────────────────────────
const GREEN  = '#00B37E';
const RED    = '#E5484D';
const ORANGE = '#FFB800';
const GRAY   = '#888888';

// ─── plugin: bandas de zona de calidad ────────────────────────────────────
function makeZonesPlugin(threshold: number) {
  return {
    id: 'qualityZones',
    beforeDatasetsDraw(chart: any) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.y) return;
      const { left, right } = chartArea;

      const band = (top: number, bottom: number, color: string) => {
        const y0 = scales.y.getPixelForValue(top);
        const y1 = scales.y.getPixelForValue(bottom);
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(left, y0, right - left, y1 - y0);
        ctx.restore();
      };

      band(100, threshold, 'rgba(0,179,126,0.04)');
      band(threshold, 60,  'rgba(255,184,0,0.04)');
      band(60, 0,          'rgba(229,72,77,0.04)');
    },
  };
}

// ─── tipos ────────────────────────────────────────────────────────────────
interface DatasetInfo {
  id: number;
  name: string;
  version?: number;
  parent_dataset_id?: number | null;
}

interface QualityTrendChartProps {
  runs: AnalysisRun[];
  qualityGateThreshold?: number;
  selectedDatasetId?: number | null;
  datasets?: DatasetInfo[];
}

// ─── helpers ──────────────────────────────────────────────────────────────
const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const fmtDate = (s?: string) => {
  if (!s) return '';
  const d = new Date(s);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hh}:${mm}`;
};

const fmtDateFull = (s?: string) => {
  if (!s) return '';
  const d = new Date(s);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
};

// ─── componente ────────────────────────────────────────────────────────────
const QualityTrendChart: React.FC<QualityTrendChartProps> = ({
  runs,
  qualityGateThreshold = 70,
  selectedDatasetId = null,
  datasets = [],
}) => {
  const [view, setView] = React.useState<'score' | 'issues'>('score');

  // versión cadena filter
  const findRootId = useCallback(
    (id: number): number => {
      const ds = datasets.find(d => d.id === id);
      if (!ds || !ds.parent_dataset_id) return id;
      return findRootId(ds.parent_dataset_id);
    },
    [datasets],
  );

  const chainIds = useMemo(() => {
    if (!selectedDatasetId) return null;
    const root = findRootId(selectedDatasetId);
    return datasets.filter(d => findRootId(d.id) === root).map(d => d.id);
  }, [selectedDatasetId, datasets, findRootId]);

  const getVersion = (dsId?: number) =>
    datasets.find(d => d.id === dsId)?.version ?? 1;

  const sortedRuns = useMemo(() => {
    let r = [...runs].filter(x => x.status === 'COMPLETED' && x.quality_score != null);
    if (chainIds) r = r.filter(x => chainIds.includes(x.dataset_id!));
    return r.sort(
      (a, b) =>
        new Date(a.completed_at || a.created_at).getTime() -
        new Date(b.completed_at || b.created_at).getTime(),
    );
  }, [runs, chainIds]);

  // estadísticas del footer
  const stats = useMemo(() => {
    if (!sortedRuns.length) return null;
    const scores = sortedRuns.map(r => r.quality_score!);
    const last = scores.at(-1)!;
    const prev = scores.at(-2) ?? null;
    return {
      last,
      trend: prev !== null ? last - prev : null,
      min: Math.min(...scores),
      max: Math.max(...scores),
      passing: scores.filter(s => s >= qualityGateThreshold).length,
      total: scores.length,
    };
  }, [sortedRuns, qualityGateThreshold]);

  const labels = useMemo(
    () =>
      sortedRuns.map(r => {
        const d = fmtDate(r.completed_at || r.created_at);
        const v = getVersion(r.dataset_id);
        return selectedDatasetId ? d : `${d} · v${v}`;
      }),
    [sortedRuns, selectedDatasetId, datasets],
  );

  // ── datos score ───────────────────────────────────────────────────────
  const scoreData = useMemo(() => {
    const scores = sortedRuns.map(r => r.quality_score!);

    return {
      labels,
      datasets: [
        // área de relleno
        {
          label: '_fill',
          data: scores,
          borderWidth: 0,
          pointRadius: 0,
          clip: false,
          fill: 'origin',
          tension: 0.38,
          backgroundColor: (ctx: any) => {
            const { chartArea, ctx: c } = ctx.chart;
            if (!chartArea) return 'rgba(0,179,126,0.06)';
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, 'rgba(0,179,126,0.10)');
            g.addColorStop(1, 'rgba(0,179,126,0.00)');
            return g;
          },
        },
        // línea principal con segmentos coloreados según umbral
        {
          label: 'Quality Score',
          data: scores,
          borderWidth: 2,
          pointStyle: 'circle',
          pointRadius: scores.map((_, i) => (i === scores.length - 1 ? 5 : 3.5)),
          pointHoverRadius: 6,
          pointBackgroundColor: scores.map(s =>
            s >= qualityGateThreshold ? GREEN : RED,
          ),
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          clip: false,
          fill: false,
          tension: 0.38,
          segment: {
            borderColor: (ctx: any) => {
              const avg = (ctx.p0.parsed.y + ctx.p1.parsed.y) / 2;
              return avg >= qualityGateThreshold
                ? 'rgba(0,179,126,0.85)'
                : 'rgba(229,72,77,0.85)';
            },
          },
        },
        // umbral (línea discontinua ámbar, círculo relleno en leyenda)
        {
          label: `Umbral (${qualityGateThreshold}%)`,
          data: Array(labels.length).fill(qualityGateThreshold),
          borderColor: 'rgba(255,184,0,0.65)',
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointStyle: 'circle',
          pointRadius: 0,
          pointHoverRadius: 0,
          pointBackgroundColor: ORANGE,
          pointBorderColor: ORANGE,
          clip: false,
          fill: false,
          tension: 0,
        },
      ],
    };
  }, [sortedRuns, labels, qualityGateThreshold]);

  // opciones score
  const scoreOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          align: 'end' as const,
          labels: {
            color: GRAY,
            font: { size: 11 },
            usePointStyle: true,
            boxWidth: 8,
            boxHeight: 8,
            padding: 16,
            filter: (item: any) => !item.text.startsWith('_'),
          },
        },
        tooltip: {
          backgroundColor: 'rgba(26,26,26,0.92)',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.7)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          titleFont: { size: 12, weight: 'bold' as const },
          bodyFont: { size: 11 },
          filter: (item: any) => !item.dataset.label?.startsWith('_'),
          callbacks: {
            title: (items: any[]) => {
              const run = sortedRuns[items[0]?.dataIndex];
              return fmtDateFull(run?.completed_at || run?.created_at);
            },
            label: (ctx: any) => {
              if (ctx.dataset.label?.startsWith('Umbral')) return `Umbral: ${ctx.parsed.y}%`;
              if (ctx.dataset.label?.startsWith('_')) return '';
              const run = sortedRuns[ctx.dataIndex];
              const ds = datasets.find(d => d.id === run?.dataset_id);
              const gate = ctx.parsed.y >= qualityGateThreshold ? '✓ Passed' : '✗ Failed';
              const lines: string[] = [];
              if (ds && !selectedDatasetId) {
                lines.push(`Dataset: ${ds.name}${ds.version != null ? ` · v${ds.version}` : ''}`);
              }
              lines.push(`Score: ${ctx.parsed.y.toFixed(1)}%  —  ${gate}`);
              lines.push(`Issues: ${run?.total_issues_count ?? 0}  (↑${run?.new_issues_count ?? 0} nuevos  ↓${run?.fixed_issues_count ?? 0} corregidos)`);
              return lines;
            },
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          border: { color: '#F0F0F0' },
          ticks: {
            color: '#AAAAAA',
            font: { size: 11 },
            callback: (v: any) => `${v}%`,
            maxTicksLimit: 6,
          },
          grid: { color: 'rgba(0,0,0,0.04)' },
        },
        x: {
          border: { color: '#F0F0F0' },
          ticks: { color: '#AAAAAA', font: { size: 11 }, maxRotation: 30, maxTicksLimit: 10 },
          grid: { display: false },
        },
      },
    }),
    [sortedRuns, qualityGateThreshold, selectedDatasetId, datasets],
  );

  // ── datos issues (barras apiladas) ──────────────────────────────────
  const issuesData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Recurrentes',
        data: sortedRuns.map(r =>
          Math.max(0, (r.total_issues_count ?? 0) - (r.new_issues_count ?? 0)),
        ),
        backgroundColor: 'rgba(140,140,160,0.35)',
        borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
        stack: 'total',
      },
      {
        label: 'Nuevos',
        data: sortedRuns.map(r => r.new_issues_count ?? 0),
        backgroundColor: 'rgba(229,72,77,0.70)',
        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
        stack: 'total',
      },
      {
        label: 'Corregidos',
        data: sortedRuns.map(r => r.fixed_issues_count ?? 0),
        backgroundColor: 'rgba(0,179,126,0.65)',
        borderRadius: 4,
        stack: 'fixed',
      },
    ],
  }), [sortedRuns, labels]);

  const issuesOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          align: 'end' as const,
          labels: {
            color: GRAY,
            font: { size: 11 },
            usePointStyle: true,
            pointStyleWidth: 8,
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(26,26,26,0.92)',
          titleColor: '#fff',
          bodyColor: 'rgba(255,255,255,0.7)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          titleFont: { size: 12, weight: 'bold' as const },
          bodyFont: { size: 11 },
          callbacks: {
            title: (items: any[]) => {
              const run = sortedRuns[items[0]?.dataIndex];
              return fmtDateFull(run?.completed_at || run?.created_at);
            },
            footer: (items: any[]) => {
              const run = sortedRuns[items[0]?.dataIndex];
              const ds = datasets.find(d => d.id === run?.dataset_id);
              const lines: string[] = [];
              if (ds && !selectedDatasetId) {
                lines.push(`Dataset: ${ds.name}${ds.version != null ? ` · v${ds.version}` : ''}`);
              }
              lines.push(`Total: ${run?.total_issues_count ?? 0} issues`);
              return lines;
            },
          },
        },
      },
      scales: {
        y: {
          stacked: true,
          border: { color: '#F0F0F0' },
          ticks: { color: '#AAAAAA', font: { size: 11 }, precision: 0 },
          grid: { color: 'rgba(0,0,0,0.04)' },
        },
        x: {
          stacked: true,
          border: { color: '#F0F0F0' },
          ticks: { color: '#AAAAAA', font: { size: 11 }, maxRotation: 30, maxTicksLimit: 10 },
          grid: { display: false },
        },
      },
    }),
    [sortedRuns, selectedDatasetId, datasets],
  );

  const zonesPlugin = useMemo(
    () => makeZonesPlugin(qualityGateThreshold),
    [qualityGateThreshold],
  );

  // ── empty state ───────────────────────────────────────────────────────
  if (sortedRuns.length === 0) {
    return (
      <Box sx={{ py: 5, textAlign: 'center' }}>
        <Typography sx={{ color: '#AAAAAA', fontSize: '0.9rem' }}>
          Sin análisis completados
          {selectedDatasetId ? ' para este dataset' : ''}
        </Typography>
      </Box>
    );
  }

  const trendColor =
    stats?.trend == null ? GRAY
    : stats.trend > 0    ? GREEN
    : stats.trend < 0    ? RED
                         : ORANGE;

  return (
    <Box>
      {/* Toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Box sx={{
          display: 'flex',
          border: '1px solid #E8E8E8',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: '#FAFAFA',
        }}>
          {(['score', 'issues'] as const).map(v => (
            <Box
              key={v}
              onClick={() => setView(v)}
              sx={{
                px: 1.75, py: 0.6,
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: view === v ? '#00B37E' : 'transparent',
                color: view === v ? '#fff' : '#777',
                borderLeft: v === 'issues' ? '1px solid #E8E8E8' : 'none',
                '&:hover': view !== v ? { backgroundColor: '#F0F0F0', color: '#333' } : {},
              }}
            >
              {v === 'score' ? 'Score' : 'Issues'}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Gráfico */}
      <Box sx={{ height: 300 }}>
        {view === 'score' ? (
          <Line
            key="score"
            data={scoreData as any}
            options={scoreOptions as any}
            plugins={[zonesPlugin] as any}
          />
        ) : (
          <Bar
            key="issues"
            data={issuesData as any}
            options={issuesOptions as any}
          />
        )}
      </Box>

      {/* Footer de estadísticas — solo en vista Score */}
      {view === 'score' && stats && (
        <Box sx={{
          display: 'flex',
          mt: 3,
          pt: 2,
          borderTop: '1px solid #F0F0F0',
        }}>
          {[
            {
              label: 'Último',
              value: `${stats.last.toFixed(1)}%`,
              color: stats.last >= qualityGateThreshold ? GREEN : RED,
            },
            {
              label: 'Tendencia',
              value: stats.trend == null
                ? '—'
                : `${stats.trend >= 0 ? '+' : ''}${stats.trend.toFixed(1)}%`,
              color: trendColor,
            },
            {
              label: 'Rango',
              value: `${stats.min.toFixed(0)}% – ${stats.max.toFixed(0)}%`,
              color: '#555',
            },
            {
              label: 'Umbral',
              value: `${qualityGateThreshold}%`,
              color: ORANGE,
            },
            {
              label: 'Superado',
              value: `${stats.passing} / ${stats.total}`,
              color: stats.passing === stats.total ? GREEN : '#555',
            },
          ].map(({ label, value, color }, i, arr) => (
            <Box
              key={label}
              sx={{
                flex: 1,
                textAlign: 'center',
                borderRight: i < arr.length - 1 ? '1px solid #F0F0F0' : 'none',
              }}
            >
              <Typography sx={{
                fontSize: '0.68rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#BBBBBB',
                mb: 0.4,
              }}>
                {label}
              </Typography>
              <Typography sx={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default QualityTrendChart;
