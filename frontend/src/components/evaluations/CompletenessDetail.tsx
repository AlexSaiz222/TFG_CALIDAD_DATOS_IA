import React, { useState } from 'react';
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
  Link,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { ColumnMetrics } from '../../types';
import { useTranslation } from 'react-i18next';
import ViolationsDrawer from './ViolationsDrawer';

interface CompletenessDetailProps {
  overallCompleteness: number;
  columnMetrics: Record<string, ColumnMetrics>;
  threshold?: number;
  analysisRunId?: number;
  evaluationId?: number;
}

const CompletenessDetail: React.FC<CompletenessDetailProps> = ({
  overallCompleteness,
  columnMetrics,
  threshold = 0.95,
  analysisRunId,
  evaluationId,
}) => {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerColumn, setDrawerColumn] = useState('');

  const canShowViolations = !!(analysisRunId || evaluationId);

  const handleOpenViolations = (colName: string) => {
    setDrawerColumn(colName);
    setDrawerOpen(true);
  };

  const columns = Object.entries(columnMetrics)
    .map(([name, metrics]) => ({
      name,
      completeness: metrics.completeness,
      nNulls: metrics.n_nulls ?? 0,
      nNonNulls: metrics.n_non_nulls ?? 0,
      total: (metrics.n_nulls ?? 0) + (metrics.n_non_nulls ?? 0),
      type: metrics.type,
    }))
    .sort((a, b) => a.completeness - b.completeness);

  const totalNulls = columns.reduce((sum, c) => sum + c.nNulls, 0);
  const totalCells = columns.reduce((sum, c) => sum + c.total, 0);
  const columnsBelow = columns.filter(c => c.completeness < threshold);
  const columnsWithNulls = columns.filter(c => c.nNulls > 0);
  const pct = ((1 - overallCompleteness) * 100).toFixed(1);

  const getColor = (val: number): string => {
    if (val >= 0.98) return '#00B37E';
    if (val >= 0.95) return '#34D399';
    if (val >= 0.90) return '#FBB024';
    if (val >= 0.80) return '#FB923C';
    return '#EF4444';
  };

  return (
    <Box>
      {/* Global score + insight */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, color: getColor(overallCompleteness), lineHeight: 1 }}>
          {pct}%
        </Typography>
        <Box>
          <Typography variant="body2" sx={{ color: '#555' }}>
            {(totalCells - totalNulls).toLocaleString()} {t('completenessDetail.insight', {
              nullCols: columnsWithNulls.length,
              totalCols: columns.length,
              worstPct: columnsBelow.length > 0 ? (100 - columnsBelow[0].completeness * 100).toFixed(1) : 0,
              worst: columnsBelow.length > 0 ? columnsBelow[0].name : '',
            })}
          </Typography>
        </Box>
      </Box>

      {/* Global bar showing % null values */}
      <Box sx={{ position: 'relative', mb: 3 }}>
        <LinearProgress
          variant="determinate"
          value={(1 - overallCompleteness) * 100}
          sx={{
            height: 10,
            borderRadius: 5,
            backgroundColor: '#EEEEEE',
            '& .MuiLinearProgress-bar': {
              backgroundColor: getColor(overallCompleteness),
              borderRadius: 5,
            },
          }}
        />
      </Box>

      {/* Table */}
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#333' }}>
        {t('completenessDetail.tableTitle')} ({columns.length})
      </Typography>
      <TableContainer sx={{ mb: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F5F5' }}>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('completenessDetail.columns.column')}</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('common.type')}</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 140 }}>{t('completenessDetail.columns.completeness')}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('completenessDetail.columns.nullCount')}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Total</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{t('common.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {columns.map((col) => (
              <TableRow
                key={col.name}
                hover
                sx={col.completeness < threshold ? { backgroundColor: 'rgba(229, 72, 77, 0.02)' } : undefined}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{col.name}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', backgroundColor: '#F0F0F0', px: 0.5, borderRadius: 0.5 }}>
                    {col.type}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 60 }}>
                      <LinearProgress
                        variant="determinate"
                        value={col.completeness * 100}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: '#EEEEEE',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getColor(col.completeness),
                            borderRadius: 3,
                          },
                        }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: getColor(col.completeness), minWidth: 40, textAlign: 'right' }}>
                      {(col.completeness * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  {col.nNulls > 0 ? (
                    canShowViolations ? (
                      <Link
                        component="button"
                        variant="body2"
                        onClick={() => handleOpenViolations(col.name)}
                        sx={{ color: '#E5484D', fontWeight: 600, textDecoration: 'underline dotted', cursor: 'pointer', '&:hover': { color: '#C0393E' } }}
                      >
                        {col.nNulls.toLocaleString()}
                      </Link>
                    ) : (
                      <Typography variant="body2" sx={{ color: '#E5484D', fontWeight: 600 }}>
                        {col.nNulls.toLocaleString()}
                      </Typography>
                    )
                  ) : (
                    <Typography variant="body2" sx={{ color: '#CCC' }}>0</Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ color: '#888' }}>{col.total.toLocaleString()}</Typography>
                </TableCell>
                <TableCell>
                  {col.completeness >= threshold ? (
                    <CheckCircleIcon sx={{ fontSize: 16, color: '#00B37E' }} />
                  ) : col.completeness >= 0.80 ? (
                    <WarningIcon sx={{ fontSize: 16, color: '#FFB800' }} />
                  ) : (
                    <ErrorIcon sx={{ fontSize: 16, color: '#E5484D' }} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Footer */}
      {columnsWithNulls.length > 0 && (
        <Typography variant="caption" sx={{ color: '#999' }}>
          {t('completenessDetail.footer', { count: columns.length - columnsWithNulls.length })}
        </Typography>
      )}

      {/* Violations Drawer */}
      {canShowViolations && (
        <ViolationsDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          analysisRunId={analysisRunId}
          evaluationId={evaluationId}
          metric="completeness"
          column={drawerColumn}
          title={t('violations.completenessTitle', { column: drawerColumn })}
          subtitle={t('violations.completenessSubtitle')}
        />
      )}
    </Box>
  );
};

export default CompletenessDetail;
