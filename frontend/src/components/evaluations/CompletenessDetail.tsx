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
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { ColumnMetrics } from '../../types';

interface CompletenessDetailProps {
  overallCompleteness: number;
  columnMetrics: Record<string, ColumnMetrics>;
  threshold?: number;
}

const CompletenessDetail: React.FC<CompletenessDetailProps> = ({
  overallCompleteness,
  columnMetrics,
  threshold = 0.95,
}) => {
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
  const pct = (overallCompleteness * 100).toFixed(1);

  const getColor = (val: number): string => {
    if (val >= 0.95) return '#00B37E';
    if (val >= 0.80) return '#FFB800';
    return '#E5484D';
  };

  return (
    <Box>
      {/* ─── Score global + insight ─── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, color: getColor(overallCompleteness), lineHeight: 1 }}>
          {pct}%
        </Typography>
        <Box>
          <Typography variant="body2" sx={{ color: '#555' }}>
            {(totalCells - totalNulls).toLocaleString()} de {totalCells.toLocaleString()} celdas tienen valor.
            {totalNulls > 0
              ? ` Faltan ${totalNulls.toLocaleString()} valores.`
              : ' Todas las celdas tienen valor.'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#888' }}>
            Umbral: {(threshold * 100).toFixed(0)}% — por debajo se genera un issue.
          </Typography>
        </Box>
      </Box>

      {/* ─── Barra global con marcador de umbral ─── */}
      <Box sx={{ position: 'relative', mb: 3 }}>
        <LinearProgress
          variant="determinate"
          value={overallCompleteness * 100}
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
        <Box
          sx={{
            position: 'absolute',
            left: `${threshold * 100}%`,
            top: -4,
            bottom: -4,
            width: 2,
            backgroundColor: '#333',
            opacity: 0.5,
          }}
        />
        <Typography
          variant="caption"
          sx={{
            position: 'absolute',
            left: `${threshold * 100}%`,
            top: 14,
            transform: 'translateX(-50%)',
            color: '#888',
            fontSize: '0.65rem',
          }}
        >
          {(threshold * 100).toFixed(0)}%
        </Typography>
      </Box>

      {/* ─── Insight contextual ─── */}
      {columnsBelow.length > 0 && (
        <Box sx={{ p: 1.5, backgroundColor: 'rgba(255, 184, 0, 0.05)', border: '1px solid rgba(255, 184, 0, 0.2)', borderRadius: 2, mb: 2.5 }}>
          <Typography variant="body2" sx={{ color: '#555', fontSize: '0.8rem' }}>
            <strong>Insight:</strong> La columna <code style={{ backgroundColor: '#F0F0F0', padding: '1px 4px', borderRadius: 3 }}>{columnsBelow[0].name}</code> tiene
            el mayor porcentaje de valores faltantes ({(100 - columnsBelow[0].completeness * 100).toFixed(1)}%).
            {columnsBelow.length > 1 && ` Otras ${columnsBelow.length - 1} columna${columnsBelow.length - 1 > 1 ? 's' : ''} también requieren atención.`}
          </Typography>
        </Box>
      )}

      {/* ─── Tabla única con mini-barras integradas (todas las columnas) ─── */}
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#333' }}>
        Completitud por columna ({columns.length})
      </Typography>
      <TableContainer sx={{ mb: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#F5F5F5' }}>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Columna</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Tipo</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 140 }}>Completitud</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Nulls</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Total</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Estado</TableCell>
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
                {/* Mini-barra integrada + porcentaje */}
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
                    <Typography variant="body2" sx={{ color: '#E5484D', fontWeight: 600 }}>
                      {col.nNulls.toLocaleString()}
                    </Typography>
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

      {/* ─── Resumen pie de tabla ─── */}
      {columnsWithNulls.length > 0 && (
        <Typography variant="caption" sx={{ color: '#999' }}>
          {columnsWithNulls.length} de {columns.length} columnas tienen al menos un valor nulo.
        </Typography>
      )}
    </Box>
  );
};

export default CompletenessDetail;
