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
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

interface ColumnAccuracy {
  expected_type: string;
  pattern: string;
  conformance_rate: number;
  valid_count: number;
  invalid_count: number;
  total_checked: number;
  sample_invalid: string[];
}

interface SyntacticAccuracyData {
  overall_conformance: number;
  columns_checked: number;
  columns: Record<string, ColumnAccuracy>;
}

interface SyntacticAccuracyDetailProps {
  data: SyntacticAccuracyData;
  threshold?: number;
}

const TYPE_LABELS: Record<string, string> = {
  email: 'Email',
  url: 'URL',
  phone_es: 'Telefono (ES)',
  phone_intl: 'Telefono (Intl)',
  dni_es: 'DNI (ES)',
  date_iso: 'Fecha ISO',
  date_eu: 'Fecha EU',
  integer: 'Entero',
  decimal: 'Decimal',
  uuid: 'UUID',
  ip_v4: 'IPv4',
  postal_code_es: 'Cod. Postal (ES)',
  credit_card: 'Tarjeta de credito',
  custom: 'Personalizado',
};

const SyntacticAccuracyDetail: React.FC<SyntacticAccuracyDetailProps> = ({
  data,
  threshold = 0.95,
}) => {
  if (!data || !data.columns) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No se detectaron columnas para validar exactitud sintactica.
        </Typography>
      </Box>
    );
  }

  const columns = Object.entries(data.columns)
    .map(([name, col]) => ({ name, ...col }))
    .sort((a, b) => a.conformance_rate - b.conformance_rate);

  const columnsBelow = columns.filter(c => c.conformance_rate < threshold);
  const totalInvalid = columns.reduce((sum, c) => sum + c.invalid_count, 0);
  const overallPct = (data.overall_conformance * 100).toFixed(1);

  const getColor = (val: number): string => {
    if (val >= 0.98) return '#00B37E';
    if (val >= 0.95) return '#34D399';
    if (val >= 0.90) return '#FBB024';
    if (val >= 0.80) return '#FB923C';
    return '#EF4444';
  };

  const getStatusIcon = (val: number) => {
    if (val >= 0.95) return <CheckCircleIcon sx={{ fontSize: 16, color: '#00B37E' }} />;
    if (val >= 0.80) return <WarningIcon sx={{ fontSize: 16, color: '#FFB800' }} />;
    return <ErrorIcon sx={{ fontSize: 16, color: '#E5484D' }} />;
  };

  return (
    <Box>
      {/* Score global */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: getColor(data.overall_conformance), lineHeight: 1 }}
        >
          {overallPct}%
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
            Conformidad sintactica global
          </Typography>
          <LinearProgress
            variant="determinate"
            value={data.overall_conformance * 100}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: '#F0F0F0',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                backgroundColor: getColor(data.overall_conformance),
              },
            }}
          />
        </Box>
      </Box>

      {/* Insight */}
      <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
        {columns.length === 0
          ? 'No se detectaron columnas con tipos validables.'
          : columnsBelow.length === 0
            ? `Las ${columns.length} columnas analizadas cumplen el umbral de conformidad (${(threshold * 100).toFixed(0)}%).`
            : `${columnsBelow.length} de ${columns.length} columnas no alcanzan el umbral de conformidad. Total de valores invalidos: ${totalInvalid.toLocaleString()}.`}
      </Typography>

      {/* Table */}
      {columns.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Columna</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Tipo esperado</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Conformidad</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }} align="right">Validos</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }} align="right">Invalidos</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Ejemplos invalidos</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {columns.map((col) => (
                <TableRow
                  key={col.name}
                  sx={{
                    backgroundColor: col.conformance_rate < threshold ? '#FFF5F5' : 'transparent',
                    '&:hover': { backgroundColor: '#F8F8F8' },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {getStatusIcon(col.conformance_rate)}
                      <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {col.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={TYPE_LABELS[col.expected_type] || col.expected_type}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.75rem', height: 24 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
                      <LinearProgress
                        variant="determinate"
                        value={col.conformance_rate * 100}
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: '#F0F0F0',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            backgroundColor: getColor(col.conformance_rate),
                          },
                        }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 42, textAlign: 'right' }}>
                        {(col.conformance_rate * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#00B37E' }}>
                      {col.valid_count.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      variant="body2"
                      sx={{ fontSize: '0.8rem', fontWeight: col.invalid_count > 0 ? 600 : 400, color: col.invalid_count > 0 ? '#E5484D' : '#999' }}
                    >
                      {col.invalid_count.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 250 }}>
                      {col.sample_invalid.length > 0
                        ? col.sample_invalid.map((val, i) => (
                            <Tooltip key={i} title={val} arrow>
                              <Chip
                                label={val.length > 20 ? val.slice(0, 20) + '...' : val}
                                size="small"
                                sx={{
                                  fontSize: '0.7rem',
                                  height: 22,
                                  backgroundColor: '#FEE2E2',
                                  color: '#991B1B',
                                  fontFamily: 'monospace',
                                }}
                              />
                            </Tooltip>
                          ))
                        : <Typography variant="caption" color="text.secondary">-</Typography>
                      }
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default SyntacticAccuracyDetail;
