import React from 'react';
import { Box, Typography, Chip, Paper } from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { Issue } from '../../types';

interface IssuesSummaryProps {
  issues: Issue[];
  onFilterChange?: (severity: string | null) => void;
  selectedSeverity?: string | null;
}

const IssuesSummary: React.FC<IssuesSummaryProps> = ({
  issues,
  onFilterChange,
  selectedSeverity,
}) => {
  const highCount = issues.filter((i) => i.severity === 'high').length;
  const mediumCount = issues.filter((i) => i.severity === 'medium').length;
  const lowCount = issues.filter((i) => i.severity === 'low').length;

  const severityConfig = [
    {
      key: 'high',
      label: 'High',
      count: highCount,
      color: '#E5484D',
      bgColor: 'rgba(229, 72, 77, 0.1)',
      icon: <ErrorIcon sx={{ fontSize: 16 }} />,
    },
    {
      key: 'medium',
      label: 'Medium',
      count: mediumCount,
      color: '#FFB800',
      bgColor: 'rgba(255, 184, 0, 0.1)',
      icon: <WarningIcon sx={{ fontSize: 16 }} />,
    },
    {
      key: 'low',
      label: 'Low',
      count: lowCount,
      color: '#00B37E',
      bgColor: 'rgba(0, 179, 126, 0.1)',
      icon: <InfoIcon sx={{ fontSize: 16 }} />,
    },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: '1px solid #EEEEEE',
        borderRadius: 2,
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#1A1A1A' }}>
        Issues by Severity ({issues.length} total)
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {severityConfig.map((config) => (
          <Chip
            key={config.key}
            icon={config.icon}
            label={`${config.label}: ${config.count}`}
            onClick={() => onFilterChange?.(selectedSeverity === config.key ? null : config.key)}
            sx={{
              backgroundColor: selectedSeverity === config.key ? config.color : config.bgColor,
              color: selectedSeverity === config.key ? '#FFFFFF' : config.color,
              fontWeight: 500,
              cursor: onFilterChange ? 'pointer' : 'default',
              '& .MuiChip-icon': {
                color: selectedSeverity === config.key ? '#FFFFFF' : config.color,
              },
              '&:hover': onFilterChange
                ? {
                    backgroundColor: config.color,
                    color: '#FFFFFF',
                    '& .MuiChip-icon': {
                      color: '#FFFFFF',
                    },
                  }
                : {},
            }}
          />
        ))}

        {selectedSeverity && (
          <Chip
            label="Clear filter"
            variant="outlined"
            size="small"
            onClick={() => onFilterChange?.(null)}
            sx={{
              borderColor: '#CCCCCC',
              color: '#555555',
              cursor: 'pointer',
            }}
          />
        )}
      </Box>
    </Paper>
  );
};

export default IssuesSummary;
