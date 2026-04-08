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
  if (!data || !data.columns || Object.keys(data.columns).length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No se detectaron columnas de fecha para analizar la actualidad de los datos.
        </Typography>
      </Box>
    );
  }

  const columns = Object.entries(data.columns)
    .map(([name, col]) => ({ name, ...col }))
    .sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0)); // Most stale first

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
      {/* Score global */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: getColor(data.overall_freshness_score), lineHeight: 1 }}
        >
          {overallPct}%
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
            Frescura global de datos
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
        {data.columns_stale === 0
          ? `Las ${data.columns_analyzed} columnas de fecha analizadas contienen datos dentro del umbral de frescura (${data.staleness_threshold_days} dias).`
          : `${data.columns_stale} de ${data.columns_analyzed} columnas contienen datos que superan el umbral de ${data.staleness_threshold_days} dias de antiguedad.`}
      </Typography>

      {/* Stale alert */}
      {data.columns_stale > 0 && (
        <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8rem' }}>
          Se detectaron {data.columns_stale} columna{data.columns_stale > 1 ? 's' : ''} con datos obsoletos.
          Considera actualizar el dataset para obtener resultados mas fiables.
        </Alert>
      )}

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Columna</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Fecha mas reciente</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Antiguedad</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Rango cubierto</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Frescura</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Estado</TableCell>
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
                  {col.min_date && col.min_date !== col.max_date && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
                      desde {formatDate(col.min_date)}
                    </Typography>
                  )}
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
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                    {col.date_range_days !== null
                      ? col.date_range_days >= 365
                        ? `${(col.date_range_days / 365).toFixed(1)} años`
                        : col.date_range_days >= 30
                          ? `${Math.round(col.date_range_days / 30)} meses`
                          : `${col.date_range_days} dias`
                      : '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
                    <LinearProgress
                      variant="determinate"
                      value={col.freshness_score * 100}
                      sx={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: '#F0F0F0',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          backgroundColor: getColor(col.freshness_score),
                        },
                      }}
                    />
                    <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 42, textAlign: 'right' }}>
                      {(col.freshness_score * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  {col.is_stale ? (
                    <Chip
                      label="Obsoleto"
                      size="small"
                      sx={{ fontSize: '0.7rem', height: 22, backgroundColor: '#FEE2E2', color: '#991B1B' }}
                    />
                  ) : (
                    <Chip
                      label="Vigente"
                      size="small"
                      sx={{ fontSize: '0.7rem', height: 22, backgroundColor: '#D1FAE5', color: '#065F46' }}
                    />
                  )}
                  {col.parse_success_rate < 0.80 && (
                    <Chip
                      label={`Parseo: ${(col.parse_success_rate * 100).toFixed(0)}%`}
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
        Analisis realizado: {formatDate(data.analysis_timestamp)}
      </Typography>
    </Box>
  );
};

export default CurrentnessDetail;
