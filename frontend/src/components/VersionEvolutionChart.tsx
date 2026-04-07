import React from 'react';
import {
  Box,
  Typography,
  Chip,
} from '@mui/material';
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
import { Line } from 'react-chartjs-2';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
} from '@mui/icons-material';

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

interface VersionData {
  version: number;
  version_tag?: string;
  quality_score: number | null;
  total_issues: number;
  created_at: string;
}

interface VersionEvolutionChartProps {
  versions: VersionData[];
  title?: string;
}

const VersionEvolutionChart: React.FC<VersionEvolutionChartProps> = ({
  versions,
  title = 'Evolución de calidad',
}) => {
  if (!versions || versions.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          No hay datos de versiones para mostrar
        </Typography>
      </Box>
    );
  }

  const sortedVersions = [...versions].sort((a, b) => a.version - b.version);

  const labels = sortedVersions.map(v => v.version_tag || `v${v.version}`);
  const scores = sortedVersions.map(v => v.quality_score ?? null);
  const issues = sortedVersions.map(v => v.total_issues);

  const firstScore = scores.find(s => s !== null) ?? 0;
  const lastScore = scores.filter(s => s !== null).pop() ?? 0;
  const scoreDiff = lastScore - firstScore;

  const getTrendIcon = () => {
    if (scoreDiff > 2) return <TrendingUpIcon sx={{ color: '#00B37E' }} />;
    if (scoreDiff < -2) return <TrendingDownIcon sx={{ color: '#E5484D' }} />;
    return <TrendingFlatIcon sx={{ color: '#FFB800' }} />;
  };

  const getTrendLabel = () => {
    if (scoreDiff > 2) return 'Mejorando';
    if (scoreDiff < -2) return 'Empeorando';
    return 'Estable';
  };

  const getTrendColor = () => {
    if (scoreDiff > 2) return '#00B37E';
    if (scoreDiff < -2) return '#E5484D';
    return '#FFB800';
  };

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Quality Score',
        data: scores,
        borderColor: '#00B37E',
        backgroundColor: 'rgba(0, 179, 126, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: '#00B37E',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
        padding: 12,
        callbacks: {
          label: (context: any) => {
            const score = context.raw;
            const issueCount = issues[context.dataIndex];
            return [
              `Score: ${score !== null ? `${score}%` : 'Sin análisis'}`,
              `Issues: ${issueCount}`,
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
  };

  return (
    <Box>
      {/* Indicador de tendencia — compacto */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1.5, mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {getTrendIcon()}
          <Typography variant="body2" sx={{ color: getTrendColor(), fontWeight: 500, fontSize: '0.82rem' }}>
            {getTrendLabel()}
          </Typography>
        </Box>
        <Chip
          label={`${scoreDiff >= 0 ? '+' : ''}${scoreDiff.toFixed(1)}%`}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.75rem',
            backgroundColor: scoreDiff >= 0 ? 'rgba(0, 179, 126, 0.1)' : 'rgba(229, 72, 77, 0.1)',
            color: scoreDiff >= 0 ? '#00B37E' : '#E5484D',
            fontWeight: 600,
          }}
        />
      </Box>

      <Box sx={{ height: 240 }}>
        <Line data={chartData} options={chartOptions} />
      </Box>
    </Box>
  );
};

export default VersionEvolutionChart;
