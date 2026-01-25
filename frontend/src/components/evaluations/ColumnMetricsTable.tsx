import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import { ColumnMetrics } from '../../types';

interface ColumnMetricsTableProps {
  columnMetrics: Record<string, ColumnMetrics>;
}

const ColumnMetricsTable: React.FC<ColumnMetricsTableProps> = ({ columnMetrics }) => {
  const columns = Object.keys(columnMetrics);

  if (columns.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #CCCCCC', borderRadius: 2 }}>
        <Typography variant="body1" sx={{ color: '#555555' }}>
          No column metrics available.
        </Typography>
      </Box>
    );
  }

  const getCompletionColor = (value: number): string => {
    if (value >= 0.95) return '#00B37E';
    if (value >= 0.8) return '#FFB800';
    return '#E5484D';
  };

  const formatValue = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '—';
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(2);
  };

  const formatPercentage = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '—';
    return `${(value * 100).toFixed(1)}%`;
  };

  return (
    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #EEEEEE', borderRadius: 2 }}>
      <Table size="small" aria-label="column metrics table">
        <TableHead>
          <TableRow sx={{ backgroundColor: '#F5F5F5' }}>
            <TableCell sx={{ fontWeight: 600 }}>Column</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Completeness</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Uniqueness</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Min</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Max</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Mean</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Std</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {columns.map((columnName) => {
            const metrics = columnMetrics[columnName];
            const completenessColor = getCompletionColor(metrics.completeness);

            return (
              <TableRow key={columnName} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {columnName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="caption"
                    sx={{
                      backgroundColor: '#F0F0F0',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      fontFamily: 'monospace',
                    }}
                  >
                    {metrics.type}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title={formatPercentage(metrics.completeness)}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                      <LinearProgress
                        variant="determinate"
                        value={metrics.completeness * 100}
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: '#EEEEEE',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: completenessColor,
                            borderRadius: 3,
                          },
                        }}
                      />
                      <Typography variant="caption" sx={{ color: completenessColor, fontWeight: 500, minWidth: 45 }}>
                        {formatPercentage(metrics.completeness)}
                      </Typography>
                    </Box>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{formatPercentage(metrics.uniqueness)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{formatValue(metrics.min)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{formatValue(metrics.max)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{formatValue(metrics.mean)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{formatValue(metrics.std)}</Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ColumnMetricsTable;
