import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Filler
);

// Consistent colors
const GREEN = '#00B37E';
const RED = '#E5484D';
const ORANGE = '#FFB800';
const GRAY = '#CCCCCC';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

/**
 * Mini sparkline for showing score trend
 */
export const MiniSparkline: React.FC<SparklineProps> = ({
  data,
  color = GREEN,
  height = 40
}) => {
  const { t } = useTranslation();

  if (data.length < 2) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" sx={{ color: '#888' }}>
          {t('dashboardCharts.noEnoughData')}
        </Typography>
      </Box>
    );
  }

  const chartData = {
    labels: data.map((_, i) => i.toString()),
    datasets: [
      {
        data,
        borderColor: color,
        backgroundColor: `${color}20`,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: { display: false },
      y: {
        display: false,
        min: Math.min(...data) - 5,
        max: Math.max(...data) + 5,
      },
    },
    elements: {
      line: { borderCapStyle: 'round' as const },
    },
  };

  return (
    <Box sx={{ height, width: '100%' }}>
      <Line data={chartData} options={options} />
    </Box>
  );
};

interface StatusDonutProps {
  passed: number;
  warning: number;
  failed: number;
  noAnalysis: number;
  size?: number;
}

/**
 * Donut chart for Quality Gate status distribution
 */
export const StatusDonut: React.FC<StatusDonutProps> = ({
  passed,
  warning,
  failed,
  noAnalysis,
  size = 120,
}) => {
  const { t } = useTranslation();
  const total = passed + warning + failed + noAnalysis;

  if (total === 0) {
    return (
      <Box sx={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        border: '2px dashed #ccc',
      }}>
        <Typography variant="caption" sx={{ color: '#888', textAlign: 'center' }}>
          {t('dashboardCharts.noData')}
        </Typography>
      </Box>
    );
  }

  const chartData = {
    labels: [
      t('dashboardCharts.chartLabels.passed'),
      t('dashboardCharts.chartLabels.warning'),
      t('dashboardCharts.chartLabels.failed'),
      t('dashboardCharts.chartLabels.noAnalysis'),
    ],
    datasets: [
      {
        data: [passed, warning, failed, noAnalysis],
        backgroundColor: [GREEN, ORANGE, RED, GRAY],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  };

  // Calculate percentage of "healthy" (passed) projects
  const healthyPercentage = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <Doughnut data={chartData} options={options} />
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#1A1A1A', lineHeight: 1 }}>
          {healthyPercentage}%
        </Typography>
        <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem' }}>
          {t('dashboardCharts.approved')}
        </Typography>
      </Box>
    </Box>
  );
};

interface TrendIndicatorProps {
  current: number;
  previous: number | null;
}

/**
 * Trend indicator with arrow
 */
export const TrendIndicator: React.FC<TrendIndicatorProps> = ({ current, previous }) => {
  if (previous === null) return null;

  const diff = current - previous;
  const isPositive = diff > 0;
  const isNeutral = diff === 0;

  if (isNeutral) {
    return (
      <Typography component="span" sx={{ fontSize: '0.75rem', color: '#888', ml: 0.5 }}>
        =
      </Typography>
    );
  }

  return (
    <Typography
      component="span"
      sx={{
        fontSize: '0.75rem',
        color: isPositive ? GREEN : RED,
        ml: 0.5,
        fontWeight: 500,
      }}
    >
      {isPositive ? '↑' : '↓'} {Math.abs(diff).toFixed(1)}%
    </Typography>
  );
};
