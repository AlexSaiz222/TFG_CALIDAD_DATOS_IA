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
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  KeyboardArrowDown,
  KeyboardArrowUp,
} from '@mui/icons-material';

interface RuleResult {
  name: string;
  expression: string;
  condition?: string;
  assertion?: string;
  type: string;
  violation_count: number;
  total_rows: number;
  compliance_rate: number | null;
  affected_columns: string[];
  sample_violations: Record<string, any>[];
  error?: string;
}

interface LogicalConsistencyData {
  overall_compliance: number;
  rules_evaluated: number;
  rules_with_violations: number;
  rules: RuleResult[];
}

interface LogicalConsistencyDetailProps {
  data: LogicalConsistencyData;
}

const RuleRow: React.FC<{ rule: RuleResult }> = ({ rule }) => {
  const [open, setOpen] = useState(false);
  const hasSamples = rule.sample_violations && rule.sample_violations.length > 0;

  const getColor = (val: number | null): string => {
    if (val === null) return '#999';
    if (val >= 0.98) return '#00B37E';
    if (val >= 0.95) return '#34D399';
    if (val >= 0.90) return '#FBB024';
    if (val >= 0.80) return '#FB923C';
    return '#EF4444';
  };

  const getStatusIcon = (val: number | null) => {
    if (val === null) return <ErrorIcon sx={{ fontSize: 16, color: '#999' }} />;
    if (val >= 0.98) return <CheckCircleIcon sx={{ fontSize: 16, color: '#00B37E' }} />;
    if (val >= 0.90) return <WarningIcon sx={{ fontSize: 16, color: '#FFB800' }} />;
    return <ErrorIcon sx={{ fontSize: 16, color: '#E5484D' }} />;
  };

  const sampleColumns = hasSamples
    ? Object.keys(rule.sample_violations[0]).filter(k => k !== '__index')
    : [];

  return (
    <>
      <TableRow
        sx={{
          backgroundColor: rule.violation_count > 0 ? '#FFF5F5' : 'transparent',
          '&:hover': { backgroundColor: '#F8F8F8' },
        }}
      >
        <TableCell sx={{ width: 40, p: 0.5 }}>
          {hasSamples && (
            <IconButton size="small" onClick={() => setOpen(!open)}>
              {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
          )}
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {getStatusIcon(rule.compliance_rate)}
            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
              {rule.name}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          {rule.type === 'if_then' && rule.condition ? (
            <Box sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#555', maxWidth: 300 }}>
              <Typography component="span" sx={{ fontFamily: 'inherit', fontSize: 'inherit', color: '#888' }}>SI </Typography>
              <Typography component="span" sx={{ fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600 }}>{rule.condition}</Typography>
              <Typography component="span" sx={{ fontFamily: 'inherit', fontSize: 'inherit', color: '#888' }}> → </Typography>
              <Typography component="span" sx={{ fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600 }}>{rule.assertion}</Typography>
            </Box>
          ) : (
            <Typography
              variant="body2"
              sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#555', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={rule.expression}
            >
              {rule.expression}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Chip
            label={rule.type === 'if_then' ? 'SI...ENTONCES' : 'Violacion'}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 22 }}
          />
        </TableCell>
        <TableCell align="right">
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.8rem',
              fontWeight: rule.violation_count > 0 ? 600 : 400,
              color: rule.violation_count > 0 ? '#E5484D' : '#999',
            }}
          >
            {rule.error ? 'Error' : rule.violation_count.toLocaleString()}
          </Typography>
        </TableCell>
        <TableCell>
          {rule.compliance_rate !== null && !rule.error ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
              <LinearProgress
                variant="determinate"
                value={rule.compliance_rate * 100}
                sx={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#F0F0F0',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    backgroundColor: getColor(rule.compliance_rate),
                  },
                }}
              />
              <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 42, textAlign: 'right' }}>
                {(rule.compliance_rate * 100).toFixed(1)}%
              </Typography>
            </Box>
          ) : (
            <Typography variant="caption" color="error">
              {rule.error || '-'}
            </Typography>
          )}
        </TableCell>
      </TableRow>

      {/* Expandable sample violations */}
      {hasSamples && (
        <TableRow>
          <TableCell sx={{ py: 0 }} colSpan={6}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ m: 1.5, p: 1.5, backgroundColor: '#FAFAFA', borderRadius: 1, border: '1px solid #EEE' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, mb: 1, display: 'block', color: '#666' }}>
                  Filas que violan la regla (muestra de {Math.min(5, rule.violation_count)}):
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {sampleColumns.map(col => (
                          <TableCell key={col} sx={{ fontWeight: 600, fontSize: '0.7rem', py: 0.5 }}>
                            {col}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rule.sample_violations.map((row, i) => (
                        <TableRow key={i}>
                          {sampleColumns.map(col => (
                            <TableCell key={col} sx={{ fontSize: '0.7rem', py: 0.5, fontFamily: 'monospace' }}>
                              {row[col] === null ? <em style={{ color: '#999' }}>null</em> : String(row[col])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

const LogicalConsistencyDetail: React.FC<LogicalConsistencyDetailProps> = ({ data }) => {
  if (!data || !data.rules || data.rules.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No se configuraron reglas de consistencia logica.
        </Typography>
      </Box>
    );
  }

  const overallPct = (data.overall_compliance * 100).toFixed(1);

  const getColor = (val: number): string => {
    if (val >= 0.98) return '#00B37E';
    if (val >= 0.95) return '#34D399';
    if (val >= 0.90) return '#FBB024';
    if (val >= 0.80) return '#FB923C';
    return '#EF4444';
  };

  return (
    <Box>
      {/* Score global */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, color: getColor(data.overall_compliance), lineHeight: 1 }}
        >
          {overallPct}%
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
            Cumplimiento de reglas logicas
          </Typography>
          <LinearProgress
            variant="determinate"
            value={data.overall_compliance * 100}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: '#F0F0F0',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                backgroundColor: getColor(data.overall_compliance),
              },
            }}
          />
        </Box>
      </Box>

      {/* Insight */}
      <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
        {data.rules_with_violations === 0
          ? `Las ${data.rules_evaluated} reglas evaluadas se cumplen correctamente.`
          : `${data.rules_with_violations} de ${data.rules_evaluated} reglas presentan violaciones. Expande cada regla para ver las filas afectadas.`}
      </Typography>

      {/* Rules table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 40 }} />
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Regla</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Expresion</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Tipo</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }} align="right">Violaciones</TableCell>
              <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem' }}>Cumplimiento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.rules.map((rule, idx) => (
              <RuleRow key={idx} rule={rule} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default LogicalConsistencyDetail;
