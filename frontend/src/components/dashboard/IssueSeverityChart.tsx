import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface ProjectIssueData {
  name: string;
  critical: number;
  major: number;
  minor: number;
  info: number;
}

interface IssueSeverityChartProps {
  projects: ProjectIssueData[];
  maxProjects?: number;
}

const SEVERITY_COLORS = {
  critical: '#8B0000',
  major: '#E5484D',
  minor: '#FFB800',
  info: '#00B37E',
};

const IssueSeverityChart: React.FC<IssueSeverityChartProps> = ({ projects, maxProjects = 10 }) => {
  const { t } = useTranslation();

  const SEVERITY_LABELS = {
    critical: t('issueSeverityChart.severity.critical'),
    major: t('issueSeverityChart.severity.major'),
    minor: t('issueSeverityChart.severity.minor'),
    info: t('issueSeverityChart.severity.info'),
  };

  const sorted = [...projects]
    .sort((a, b) => (b.critical + b.major + b.minor + b.info) - (a.critical + a.major + a.minor + a.info))
    .slice(0, maxProjects);

  if (sorted.length === 0 || sorted.every(p => p.critical + p.major + p.minor + p.info === 0)) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200 }}>
        <Typography variant="body2" sx={{ color: '#888' }}>
          {t('issueSeverityChart.noIssues')}
        </Typography>
      </Box>
    );
  }

  const data = {
    labels: sorted.map(p => p.name.length > 18 ? p.name.substring(0, 16) + '...' : p.name),
    datasets: (['critical', 'major', 'minor', 'info'] as const).map(severity => ({
      label: SEVERITY_LABELS[severity],
      data: sorted.map(p => p[severity]),
      backgroundColor: SEVERITY_COLORS[severity],
      borderRadius: 2,
      barThickness: 18,
    })),
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { size: 11, family: 'Inter' },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 10,
        titleFont: { family: 'Inter' },
        bodyFont: { family: 'Inter' },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 11, family: 'Inter' } },
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 11, family: 'Inter' } },
      },
    },
  };

  return (
    <Box sx={{ height: Math.max(200, sorted.length * 40 + 60), width: '100%' }}>
      <Bar data={data} options={options} />
    </Box>
  );
};

export default IssueSeverityChart;
