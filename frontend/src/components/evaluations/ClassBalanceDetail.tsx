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
  Chip,
  Collapse,
  IconButton,
  Alert,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  KeyboardArrowDown,
  KeyboardArrowUp,
  BalanceOutlined,
} from '@mui/icons-material';

interface FrequencyEntry {
  count: number;
  proportion: number;
  num_classes?: number;
}

interface ColumnBalance {
  balance_index: number;
  entropy: number;
  max_entropy: number;
  num_classes: number;
  total_values: number;
  frequency_table: Record<string, FrequencyEntry>;
  dominant_class: { value: string; proportion: number };
  minority_class: { value: string; proportion: number };
  alerts: string[];
}

interface ClassBalanceData {
  overall_balance_index: number;
  columns_analyzed: number;
  columns_with_alerts: number;
  columns: Record<string, ColumnBalance>;
}

interface ClassBalanceDetailProps {
  data: ClassBalanceData;
}

const ColumnRow: React.FC<{ name: string; col: ColumnBalance }> = ({ name, col }) => {
  const [open, setOpen] = useState(false);

  const getBalanceColor = (idx: number): string => {
    if (idx >= 80) return '#00B37E';
    if (idx >= 60) return '#34D399';
    if (idx >= 40) return '#FBB024';
    if (idx >= 20) return '#FB923C';
    return '#EF4444';
  };

  const getStatusIcon = (idx: number) => {
    if (idx >= 70) return <CheckCircleIcon sx={{ fontSize: 16, color: '#00B37E' }} />;
    if (idx >= 40) return <WarningIcon sx={{ fontSize: 16, color: '#FFB800' }} />;
    return <ErrorIcon sx={{ fontSize: 16, color: '#E5484D' }} />;
  };

  const freqEntries = Object.entries(col.frequency_table)
    .sort(([, a], [, b]) => b.proportion - a.proportion);

  return (
    <>
      <TableRow
        sx={{
          backgroundColor: col.alerts.length > 0 ? '#FFF5F5' : 'transparent',
          '&:hover': { backgroundColor: '#F8F8F8' },
        }}
      >
        <TableCell sx={{ width: 40, p: 0.5 }}>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {getStatusIcon(col.balance_index)}
            <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {name}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 130 }}>
            <LinearProgress
              variant="determinate"
              value={col.balance_index}
              sx={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#F0F0F0',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  backgroundColor: getBalanceColor(col.balance_index),
                },
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 36, textAlign: 'right' }}>
              {col.balance_index.toFixed(0)}
            </Typography>
          </Box>
        </TableCell>
        <TableCell align="center">
          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
            {col.num_classes}
          </Typography>
        </TableCell>
        <TableCell>
          <Chip
            label={`${col.dominant_class.value} (${(col.dominant_class.proportion * 100).toFixed(1)}%)`}
            size="small"
            sx={{
              fontSize: '0.7rem',
              height: 22,
              backgroundColor: col.dominant_class.proportion >= 0.90 ? '#FEE2E2' : '#F0F0F0',
              color: col.dominant_class.proportion >= 0.90 ? '#991B1B' : '#333',
            }}
          />
        </TableCell>
        <TableCell>
          {col.alerts.length > 0 ? (
            <Chip
              label={`${col.alerts.length} alerta${col.alerts.length > 1 ? 's' : ''}`}
              size="small"
              sx={{ fontSize: '0.7rem', height: 22, backgroundColor: '#FEF3C7', color: '#92400E' }}
            />
          ) : (
            <Typography variant="caption" color="text.secondary">-</Typography>
          )}
        </TableCell>
      </TableRow>

      {/* Expandable frequency table */}
      <TableRow>
        <TableCell sx={{ py: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ m: 1.5, p: 1.5, backgroundColor: '#FAFAFA', borderRadius: 1, border: '1px solid #EEE' }}>
              {/* Alerts */}
              {col.alerts.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  {col.alerts.map((alert, i) => (
                    <Alert key={i} severity="warning" sx={{ mb: 0.5, py: 0, fontSize: '0.75rem' }}>
                      {alert}
                    </Alert>
                  ))}
                </Box>
              )}

              {/* Stats */}
              <Box sx={{ display: 'flex', gap: 3, mb: 1.5, flexWrap: 'wrap' }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Entropia</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{col.entropy.toFixed(3)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Entropia max.</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{col.max_entropy.toFixed(3)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Total valores</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{col.total_values.toLocaleString()}</Typography>
                </Box>
              </Box>

              {/* Frequency bars */}
              <Typography variant="caption" sx={{ fontWeight: 600, mb: 1, display: 'block', color: '#666' }}>
                Distribucion de clases:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {freqEntries.map(([value, entry]) => (
                  <Box key={value} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{ minWidth: 100, fontFamily: 'monospace', fontSize: '0.7rem', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={value === '__others__' ? `${entry.num_classes} clases mas` : value}
                    >
                      {value === '__others__' ? `(+${entry.num_classes} mas)` : value}
                    </Typography>
                    <Box sx={{ flex: 1, position: 'relative', height: 16, backgroundColor: '#E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          height: '100%',
                          width: `${entry.proportion * 100}%`,
                          backgroundColor: entry.proportion >= 0.90 ? '#EF4444' : entry.proportion >= 0.50 ? '#FBB024' : '#60A5FA',
                          borderRadius: 2,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ minWidth: 55, fontWeight: 500, fontSize: '0.7rem' }}>
                      {(entry.proportion * 100).toFixed(1)}% ({entry.count.toLocaleString()})
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const ClassBalanceDetail: React.FC<ClassBalanceDetailProps> = ({ data }) => {
  if (!data || !data.columns || Object.keys(data.columns).length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No se detectaron columnas categoricas para analizar el equilibrio de clases.
        </Typography>
      </Box>
    );
  }

  const columns = Object.entries(data.columns)
    .map(([name, col]) => ({ name, ...col }))
    .sort((a, b) => a.balance_index - b.balance_index);

  const getColor = (val: number): string => {
    if (val >= 80) return '#00B37E';
    if (val >= 60) return '#34D399';
    if (val >= 40) return '#FBB024';
    if (val >= 20) return '#FB923C';
    return '#EF4444';
  };

  return (
    <Box>
      {/* Score global */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: getColor(data.overall_balance_index), lineHeight: 1 }}
        >
          {data.overall_balance_index.toFixed(0)}
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
            Indice de equilibrio global (0-100)
          </Typography>
          <LinearProgress
            variant="determinate"
            value={data.overall_balance_index}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: '#F0F0F0',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                backgroundColor: getColor(data.overall_balance_index),
              },
            }}
          />
        </Box>
      </Box>

      {/* Insight */}
      <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
        {data.columns_with_alerts === 0
          ? `Las ${data.columns_analyzed} columnas categoricas analizadas presentan una distribucion equilibrada.`
          : `${data.columns_with_alerts} de ${data.columns_analyzed} columnas presentan desbalance de clases. Expande cada columna para ver la distribucion completa.`}
      </Typography>

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Columna</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Balance Index</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }} align="center">Clases</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Clase dominante</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Alertas</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {columns.map((col) => (
              <ColumnRow key={col.name} name={col.name} col={col} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ClassBalanceDetail;
