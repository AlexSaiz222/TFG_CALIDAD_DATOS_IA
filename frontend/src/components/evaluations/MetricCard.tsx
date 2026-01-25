import React from 'react';
import { Box, Card, CardContent, Typography, LinearProgress } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

interface MetricCardProps {
  name: string;
  value: number;
  threshold?: number;
  description?: string;
  icon?: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({
  name,
  value,
  threshold = 0.8,
  description,
  icon,
}) => {
  const normalizedValue = Math.min(1, Math.max(0, value));
  const percentage = normalizedValue * 100;
  const isPassing = normalizedValue >= threshold;

  const getColor = (): string => {
    if (normalizedValue >= 0.9) return '#00B37E';
    if (normalizedValue >= 0.7) return '#FFB800';
    return '#E5484D';
  };

  const getStatusIcon = () => {
    if (normalizedValue >= 0.9) {
      return <CheckCircleIcon sx={{ color: '#00B37E', fontSize: 20 }} />;
    }
    if (normalizedValue >= 0.7) {
      return <WarningIcon sx={{ color: '#FFB800', fontSize: 20 }} />;
    }
    return <ErrorIcon sx={{ color: '#E5484D', fontSize: 20 }} />;
  };

  const color = getColor();

  return (
    <Card
      elevation={0}
      sx={{
        border: '1px solid #EEEEEE',
        borderRadius: 2,
        height: '100%',
        transition: 'box-shadow 0.2s ease-in-out',
        '&:hover': {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
              {name}
            </Typography>
          </Box>
          {getStatusIcon()}
        </Box>

        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: color,
            mb: 1,
          }}
        >
          {percentage.toFixed(1)}%
        </Typography>

        <LinearProgress
          variant="determinate"
          value={percentage}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: '#EEEEEE',
            mb: 1,
            '& .MuiLinearProgress-bar': {
              backgroundColor: color,
              borderRadius: 3,
            },
          }}
        />

        {description && (
          <Typography variant="caption" sx={{ color: '#555555' }}>
            {description}
          </Typography>
        )}

        {threshold && (
          <Typography variant="caption" sx={{ color: '#888888', display: 'block', mt: 0.5 }}>
            Threshold: {(threshold * 100).toFixed(0)}%
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default MetricCard;
