import React from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  HelpOutline as HelpOutlineIcon,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import type { QualityGateStatus } from '../types';

interface QualityGateBadgeProps {
  status?: QualityGateStatus | null;
  newIssuesCount?: number;
  fixedIssuesCount?: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  showIssuesCounts?: boolean;
}

const STATUS_CONFIG = {
  PASSED: {
    color: '#00B37E',
    bgColor: 'rgba(0, 179, 126, 0.1)',
    borderColor: 'rgba(0, 179, 126, 0.3)',
    icon: CheckCircleIcon,
    label: 'Passed',
    labelEs: 'Aprobado',
  },
  FAILED: {
    color: '#E5484D',
    bgColor: 'rgba(229, 72, 77, 0.1)',
    borderColor: 'rgba(229, 72, 77, 0.3)',
    icon: CancelIcon,
    label: 'Failed',
    labelEs: 'Fallido',
  },
  WARNING: {
    color: '#FFB800',
    bgColor: 'rgba(255, 184, 0, 0.1)',
    borderColor: 'rgba(255, 184, 0, 0.3)',
    icon: WarningIcon,
    label: 'Warning',
    labelEs: 'Advertencia',
  },
};

const QualityGateBadge: React.FC<QualityGateBadgeProps> = ({
  status,
  newIssuesCount = 0,
  fixedIssuesCount = 0,
  size = 'medium',
  showLabel = true,
  showIssuesCounts = true,
}) => {
  // Si no hay status, mostrar estado "sin análisis"
  if (!status) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="No hay análisis ejecutados">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              backgroundColor: 'rgba(128, 128, 128, 0.1)',
              border: '1px solid rgba(128, 128, 128, 0.2)',
            }}
          >
            <HelpOutlineIcon
              sx={{
                fontSize: size === 'small' ? 16 : size === 'large' ? 28 : 20,
                color: '#888888',
              }}
            />
            {showLabel && (
              <Typography
                variant={size === 'small' ? 'caption' : 'body2'}
                sx={{ color: '#888888', fontWeight: 500 }}
              >
                Sin análisis
              </Typography>
            )}
          </Box>
        </Tooltip>
      </Box>
    );
  }

  const config = STATUS_CONFIG[status];
  const IconComponent = config.icon;

  const iconSize = size === 'small' ? 16 : size === 'large' ? 32 : 24;
  const fontSize = size === 'small' ? 'caption' : size === 'large' ? 'body1' : 'body2';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {/* Quality Gate Status Badge */}
      <Tooltip title={`Quality Gate: ${config.labelEs}`}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: size === 'small' ? 0.75 : 1.5,
            py: size === 'small' ? 0.25 : 0.5,
            borderRadius: 1,
            backgroundColor: config.bgColor,
            border: `1px solid ${config.borderColor}`,
            transition: 'all 0.2s ease',
            '&:hover': {
              boxShadow: `0 0 8px ${config.borderColor}`,
            },
          }}
        >
          <IconComponent
            sx={{
              fontSize: iconSize,
              color: config.color,
            }}
          />
          {showLabel && (
            <Typography
              variant={fontSize as any}
              sx={{
                color: config.color,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {config.labelEs}
            </Typography>
          )}
        </Box>
      </Tooltip>

      {/* Issues Counts */}
      {showIssuesCounts && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* New Issues */}
          {newIssuesCount > 0 && (
            <Tooltip title={`${newIssuesCount} nuevos issues detectados`}>
              <Chip
                icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
                label={`+${newIssuesCount}`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(229, 72, 77, 0.1)',
                  color: '#E5484D',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: size === 'small' ? 20 : 24,
                  '& .MuiChip-icon': {
                    color: '#E5484D',
                  },
                }}
              />
            </Tooltip>
          )}

          {/* Fixed Issues */}
          {fixedIssuesCount > 0 && (
            <Tooltip title={`${fixedIssuesCount} issues corregidos`}>
              <Chip
                icon={<TrendingDownIcon sx={{ fontSize: 14 }} />}
                label={`-${fixedIssuesCount}`}
                size="small"
                sx={{
                  backgroundColor: 'rgba(0, 179, 126, 0.1)',
                  color: '#00B37E',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  height: size === 'small' ? 20 : 24,
                  '& .MuiChip-icon': {
                    color: '#00B37E',
                  },
                }}
              />
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
};

export default QualityGateBadge;
