import React from 'react';
import {
  Box,
  Typography,
  Paper,
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
    <Paper
      elevation={0}
      sx={{
        p: 3,
        border: '1px solid #EEEEEE',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {getTrendIcon()}
            <Typography variant="body2" sx={{ color: getTrendColor(), fontWeight: 500 }}>
              {getTrendLabel()}
            </Typography>
          </Box>
          
          <Chip
            label={`${scoreDiff >= 0 ? '+' : ''}${scoreDiff.toFixed(1)}%`}
            size="small"
            sx={{
              backgroundColor: scoreDiff >= 0 ? 'rgba(0, 179, 126, 0.1)' : 'rgba(229, 72, 77, 0.1)',
              color: scoreDiff >= 0 ? '#00B37E' : '#E5484D',
              fontWeight: 600,
            }}
          />
        </Box>
      </Box>

      <Box sx={{ height: 250 }}>
        <Line data={chartData} options={chartOptions} />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 3, pt: 2, borderTop: '1px solid #EEEEEE' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            {sortedVersions.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Versiones
          </Typography>
        </Box>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#00B37E' }}>
            {lastScore !== null ? `${lastScore}%` : '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Score actual
          </Typography>
        </Box>
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            {issues[issues.length - 1] ?? '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Issues actuales
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default VersionEvolutionChart;
