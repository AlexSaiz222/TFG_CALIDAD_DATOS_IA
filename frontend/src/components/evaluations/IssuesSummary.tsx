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

interface SeverityConfig {
  key: string;
  label: string;
  count: number;
  color: string;
  bgColor: string;
  icon: React.ReactElement;
}

const SeverityChip: React.FC<{
  config: SeverityConfig;
  isSelected: boolean;
  interactive: boolean;
  onClick: () => void;
}> = ({ config, isSelected, interactive, onClick }) => (
  <Chip
    icon={config.icon}
    label={`${config.label}: ${config.count}`}
    onClick={onClick}
    sx={{
      backgroundColor: isSelected ? config.color : config.bgColor,
      color: isSelected ? '#FFFFFF' : config.color,
      fontWeight: 500,
      cursor: interactive ? 'pointer' : 'default',
      '& .MuiChip-icon': {
        color: isSelected ? '#FFFFFF' : config.color,
      },
      '&:hover': interactive
        ? {
            backgroundColor: config.color,
            color: '#FFFFFF',
            '& .MuiChip-icon': { color: '#FFFFFF' },
          }
        : {},
    }}
  />
);

const IssuesSummary: React.FC<IssuesSummaryProps> = ({
  issues,
  onFilterChange,
  selectedSeverity,
}) => {
  const highCount = issues.filter((i) => i.severity === 'high').length;
  const mediumCount = issues.filter((i) => i.severity === 'medium').length;
  const lowCount = issues.filter((i) => i.severity === 'low').length;

  const severityConfig: SeverityConfig[] = [
    {
      key: 'high',
      label: 'Alta',
      count: highCount,
      color: '#E5484D',
      bgColor: 'rgba(229, 72, 77, 0.1)',
      icon: <ErrorIcon sx={{ fontSize: 16 }} />,
    },
    {
      key: 'medium',
      label: 'Media',
      count: mediumCount,
      color: '#FFB800',
      bgColor: 'rgba(255, 184, 0, 0.1)',
      icon: <WarningIcon sx={{ fontSize: 16 }} />,
    },
    {
      key: 'low',
      label: 'Baja',
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
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {severityConfig.map((config) => (
          <SeverityChip
            key={config.key}
            config={config}
            isSelected={selectedSeverity === config.key}
            interactive={!!onFilterChange}
            onClick={() => onFilterChange?.(selectedSeverity === config.key ? null : config.key)}
          />
        ))}

        {selectedSeverity && (
          <Chip
            label="Limpiar filtro"
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
      </div>
    </Paper>
  );
};

export default IssuesSummary;
