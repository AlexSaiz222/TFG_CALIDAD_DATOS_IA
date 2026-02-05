import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Box, Typography, Paper, Grid, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { TrendingUp as TrendingUpIcon, BarChart as BarChartIcon } from '@mui/icons-material';
import type { AnalysisRun } from '../types';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Colores consistentes
const GREEN = '#00B37E';
const RED = '#E5484D';
const ORANGE = '#FFB800';
const GRAY = '#888888';
const LIGHT_GREEN = 'rgba(0, 179, 126, 0.1)';
const LIGHT_RED = 'rgba(229, 72, 77, 0.1)';

interface QualityTrendChartProps {
  runs: AnalysisRun[];
  qualityGateThreshold?: number;
}

const QualityTrendChart: React.FC<QualityTrendChartProps> = ({
  runs,
  qualityGateThreshold = 80,
}) => {
  const [chartType, setChartType] = React.useState<'score' | 'issues'>('score');

  // Ordenar runs por fecha (más antiguo primero para el gráfico)
  const sortedRuns = useMemo(() => {
    return [...runs]
      .filter((run) => run.status === 'COMPLETED' && run.quality_score !== null)
      .sort((a, b) => {
        const dateA = new Date(a.completed_at || a.created_at).getTime();
        const dateB = new Date(b.completed_at || b.created_at).getTime();
        return dateA - dateB;
      });
  }, [runs]);

  // Formatear fecha para labels
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  // Datos para el gráfico de Quality Score
  const scoreChartData = useMemo(() => {
    const labels = sortedRuns.map((run) => formatDate(run.completed_at || run.created_at));
    const scores = sortedRuns.map((run) => run.quality_score || 0);
    
    // Colores según si está por encima o debajo del umbral
    const pointColors = scores.map((score) => (score >= qualityGateThreshold ? GREEN : RED));
    const bgColors = scores.map((score) => 
      score >= qualityGateThreshold ? LIGHT_GREEN : LIGHT_RED
    );

    return {
      labels,
      datasets: [
        {
          label: 'Quality Score',
          data: scores,
          borderColor: GREEN,
          backgroundColor: (context: any) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return LIGHT_GREEN;
            
            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, 'rgba(0, 179, 126, 0.0)');
            gradient.addColorStop(1, 'rgba(0, 179, 126, 0.3)');
            return gradient;
          },
          fill: true,
          tension: 0.3,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointColors,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
        {
          label: 'Umbral Quality Gate',
          data: Array(labels.length).fill(qualityGateThreshold),
          borderColor: ORANGE,
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [sortedRuns, qualityGateThreshold]);

  // Opciones para el gráfico de Quality Score
  const scoreChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
        padding: 12,
        callbacks: {
          label: (context: any) => {
            if (context.dataset.label === 'Umbral Quality Gate') {
              return `Umbral: ${context.raw}%`;
            }
            const run = sortedRuns[context.dataIndex];
            return [
              `Score: ${context.raw?.toFixed(1)}%`,
              `Issues: ${run?.total_issues_count || 0}`,
              `Nuevos: ${run?.new_issues_count || 0}`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: {
          callback: (value: any) => `${value}%`,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  }), [sortedRuns]);

  // Datos para el gráfico de Issues
  const issuesChartData = useMemo(() => {
    const labels = sortedRuns.map((run) => formatDate(run.completed_at || run.created_at));
    
    return {
      labels,
      datasets: [
        {
          label: 'Nuevos Issues',
          data: sortedRuns.map((run) => run.new_issues_count || 0),
          backgroundColor: RED,
          borderRadius: 4,
        },
        {
          label: 'Issues Corregidos',
          data: sortedRuns.map((run) => run.fixed_issues_count || 0),
          backgroundColor: GREEN,
          borderRadius: 4,
        },
        {
          label: 'Total Issues',
          data: sortedRuns.map((run) => run.total_issues_count || 0),
          backgroundColor: GRAY,
          borderRadius: 4,
        },
      ],
    };
  }, [sortedRuns]);

  // Opciones para el gráfico de Issues
  const issuesChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
        padding: 12,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  }), []);

  // Calcular estadísticas agregadas del proyecto
  const stats = useMemo(() => {
    if (sortedRuns.length === 0) return null;
    
    const scores = sortedRuns.map((r) => r.quality_score || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const latestScore = scores[scores.length - 1];
    
    // Contar datasets únicos analizados
    const uniqueDatasets = new Set(sortedRuns.map(r => r.dataset_id).filter(Boolean));
    
    // Total de issues en el último análisis de cada dataset
    const totalIssuesLastRun = sortedRuns.length > 0 ? (sortedRuns[sortedRuns.length - 1].total_issues_count || 0) : 0;
    
    return {
      avgScore,
      latestScore,
      runsCount: sortedRuns.length,
      datasetsAnalyzed: uniqueDatasets.size,
      totalIssuesLastRun,
    };
  }, [sortedRuns]);

  if (sortedRuns.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px dashed #CCCCCC', textAlign: 'center' }}>
        <TrendingUpIcon sx={{ fontSize: 48, color: GRAY, mb: 2 }} />
        <Typography variant="h6" sx={{ color: '#555555' }}>
          No hay datos suficientes
        </Typography>
        <Typography variant="body2" sx={{ color: '#888888' }}>
          Se necesitan análisis completados para mostrar tendencias.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Estadísticas resumen del proyecto */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #EEEEEE', textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: GRAY }}>
                Score promedio
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600, color: stats.avgScore >= qualityGateThreshold ? GREEN : RED }}>
                {stats.avgScore.toFixed(1)}%
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #EEEEEE', textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: GRAY }}>
                Último score
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600, color: stats.latestScore >= qualityGateThreshold ? GREEN : RED }}>
                {stats.latestScore.toFixed(1)}%
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #EEEEEE', textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: GRAY }}>
                Análisis realizados
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                {stats.runsCount}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #EEEEEE', textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: GRAY }}>
                Datasets analizados
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                {stats.datasetsAnalyzed}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Selector de tipo de gráfico */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <ToggleButtonGroup
          value={chartType}
          exclusive
          onChange={(_, value) => value && setChartType(value)}
          size="small"
        >
          <ToggleButton value="score" sx={{ px: 2 }}>
            <TrendingUpIcon sx={{ mr: 1, fontSize: 18 }} />
            Quality Score
          </ToggleButton>
          <ToggleButton value="issues" sx={{ px: 2 }}>
            <BarChartIcon sx={{ mr: 1, fontSize: 18 }} />
            Issues
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Gráfico */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #EEEEEE' }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 500 }}>
          {chartType === 'score' ? 'Evolución del Quality Score' : 'Evolución de Issues'}
        </Typography>
        <Box sx={{ height: 300 }}>
          {chartType === 'score' ? (
            <Line data={scoreChartData} options={scoreChartOptions} />
          ) : (
            <Bar data={issuesChartData} options={issuesChartOptions} />
          )}
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 2, color: GRAY, textAlign: 'center' }}>
          Basado en {sortedRuns.length} análisis completados
        </Typography>
      </Paper>
    </Box>
  );
};

export default QualityTrendChart;
