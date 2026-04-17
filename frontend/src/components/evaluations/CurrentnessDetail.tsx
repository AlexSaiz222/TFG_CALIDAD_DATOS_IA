import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ColumnCurrentness {
  max_date: string | null;
  min_date: string | null;
  age_days: number | null;
  age_human: string;
  date_range_days: number | null;
  parse_success_rate: number;
  valid_dates_count: number;
  is_stale: boolean;
  freshness_score: number;
  staleness_threshold_days: number;
}

interface CurrentnessData {
  overall_freshness_score: number;
  columns_analyzed: number;
  columns_stale: number;
  staleness_threshold_days: number;
  analysis_timestamp: string;
  columns: Record<string, ColumnCurrentness>;
}

interface CurrentnessDetailProps {
  data: CurrentnessData;
}

const formatDate = (isoStr: string | null): string => {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return isoStr;
  }
};

const CurrentnessDetail: React.FC<CurrentnessDetailProps> = ({ data }) => {
  const { t } = useTranslation();

  if (!data || !data.columns || Object.keys(data.columns).length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          {t('currentnessDetail.noDateCols')}
        </Typography>
      </Box>
    );
  }

  const columns = Object.entries(data.columns)
    .map(([name, col]) => ({ name, ...col }))
    .sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0));

  const overallPct = (data.overall_freshness_score * 100).toFixed(1);

  const getColor = (val: number): string => {
    if (val >= 0.90) return '#00B37E';
    if (val >= 0.70) return '#34D399';
    if (val >= 0.50) return '#FBB024';
    if (val >= 0.25) return '#FB923C';
    return '#EF4444';
  };

  const getStalenessColor = (ageDays: number | null, threshold: number): string => {
    if (ageDays === null) return '#999';
    if (ageDays <= threshold) return '#00B37E';
    if (ageDays <= threshold * 2) return '#FBB024';
    if (ageDays <= threshold * 5) return '#FB923C';
    return '#EF4444';
  };

  const getStatusIcon = (isStale: boolean, ageDays: number | null) => {
    if (ageDays === null) return <AccessTimeIcon sx={{ fontSize: 16, color: '#999' }} />;
    if (!isStale) return <CheckCircleIcon sx={{ fontSize: 16, color: '#00B37E' }} />;
    return <ErrorIcon sx={{ fontSize: 16, color: '#E5484D' }} />;
  };

  return (
    <Box>
      {/* Global score */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: getColor(data.overall_freshness_score), lineHeight: 1 }}
        >
          {overallPct}%
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
            {t('currentnessDetail.scoreLabel')}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={data.overall_freshness_score * 100}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: '#F0F0F0',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                backgroundColor: getColor(data.overall_freshness_score),
              },
            }}
          />
        </Box>
      </Box>

      {/* Insight */}
      <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
        {t('currentnessDetail.insight', {
          stale: data.columns_stale,
          total: data.columns_analyzed,
          days: data.staleness_threshold_days,
        })}
      </Typography>

      {/* Stale alert */}
      {data.columns_stale > 0 && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem' }}>
          {t('currentnessDetail.staleAlert')}
        </Alert>
      )}

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('currentnessDetail.tableColumns.column')}</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('currentnessDetail.tableColumns.maxDate')}</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('currentnessDetail.tableColumns.ageDays')}</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{t('currentnessDetail.tableColumns.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {columns.map((col) => (
              <TableRow
                key={col.name}
                sx={{
                  backgroundColor: col.is_stale ? '#FFF5F5' : 'transparent',
                  '&:hover': { backgroundColor: '#F8F8F8' },
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {getStatusIcon(col.is_stale, col.age_days)}
                    <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {col.name}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                    {formatDate(col.max_date)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.8rem',
                      fontWeight: col.is_stale ? 600 : 400,
                      color: getStalenessColor(col.age_days, col.staleness_threshold_days),
                    }}
                  >
                    {col.age_human}
                  </Typography>
                </TableCell>
                <TableCell>
                  {col.is_stale ? (
                    <Chip
                      label={t('currentnessDetail.staleChip', { days: col.age_days ?? 0 })}
                      size="small"
                      sx={{ fontSize: '0.7rem', height: 22, backgroundColor: '#FEE2E2', color: '#991B1B' }}
                    />
                  ) : (
                    <Chip
                      label={t('currentnessDetail.currentChip')}
                      size="small"
                      sx={{ fontSize: '0.7rem', height: 22, backgroundColor: '#D1FAE5', color: '#065F46' }}
                    />
                  )}
                  {col.parse_success_rate < 0.80 && (
                    <Chip
                      label={t('currentnessDetail.parseError')}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', height: 20, ml: 0.5, borderColor: '#FBB024', color: '#92400E' }}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Analysis timestamp */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, textAlign: 'right' }}>
        {t('currentnessDetail.timestampFooter', { ts: formatDate(data.analysis_timestamp) })}
      </Typography>
    </Box>
  );
};

export default CurrentnessDetail;
