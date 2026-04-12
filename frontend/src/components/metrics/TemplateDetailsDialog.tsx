import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  Divider,
  Paper,
  Chip,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { MetricTemplate } from '../../types';
import { getMetricMeta, formatParamValue, GREEN, GREEN_HOVER } from '../../utils/metricColors';

/** Human-readable labels for common parameter keys */
const PARAM_LABELS: Record<string, string> = {
  threshold: 'Umbral',
  columns: 'Columnas',
  method: 'Método',
  factor: 'Factor',
  auto_detect: 'Auto-detección',
  auto_detect_types: 'Auto-detección de tipos',
  staleness_threshold_days: 'Días de obsolescencia',
  max_cardinality: 'Cardinalidad máxima',
  imbalance_threshold_high: 'Umbral alto',
  imbalance_threshold_low: 'Umbral bajo',
  rules: 'Reglas',
};

function paramLabel(key: string): string {
  return PARAM_LABELS[key] ?? key;
}

interface TemplateDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  template: MetricTemplate | null;
}

export default function TemplateDetailsDialog({
  open,
  onClose,
  template,
}: TemplateDetailsDialogProps) {
  const router = useRouter();

  if (!template) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            {template.name}
          </Typography>
          <IconButton edge="end" color="inherit" onClick={onClose} aria-label="cerrar">
            <CloseIcon />
          </IconButton>
        </Box>
        {template.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {template.description}
          </Typography>
        )}
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ px: 3, py: 2 }}>
        <Typography
          variant="caption"
          sx={{ color: '#999', textTransform: 'uppercase', fontWeight: 600, mb: 1.5, display: 'block' }}
        >
          Métricas incluidas ({template.metrics?.length || 0})
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {template.metrics?.map((metric: any, index: number) => {
            const meta = getMetricMeta(metric.name);
            const IconComp = meta.icon;
            const params = metric.parameters ?? {};
            const paramEntries = Object.entries(params);

            return (
              <Paper
                key={metric.id ?? metric.metric_id ?? index}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  borderColor: '#E8E8E8',
                  borderLeft: `3px solid ${meta.color}`,
                }}
              >
                {/* Header: icon + name + category */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: paramEntries.length > 0 ? 1.5 : 0 }}>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: '8px', backgroundColor: meta.bg, flexShrink: 0,
                  }}>
                    <IconComp size={15} color={meta.color} strokeWidth={1.8} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                      {meta.label}
                    </Typography>
                  </Box>
                  <Chip
                    label={meta.category}
                    size="small"
                    sx={{
                      backgroundColor: meta.bg,
                      color: meta.color,
                      fontWeight: 500,
                      fontSize: '0.65rem',
                      height: 20,
                      flexShrink: 0,
                    }}
                  />
                </Box>

                {/* Parameters */}
                {paramEntries.length > 0 && (
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                    gap: 1,
                    pl: 0.5,
                  }}>
                    {paramEntries.map(([key, value]) => (
                      <Box key={key} sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ color: '#888', fontWeight: 500, display: 'block', lineHeight: 1.3 }}>
                          {paramLabel(key)}
                        </Typography>
                        <Tooltip title={typeof value === 'object' ? JSON.stringify(value, null, 2) : ''} arrow
                          disableHoverListener={typeof value !== 'object'}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              color: '#1A1A1A',
                              lineHeight: 1.4,
                              wordBreak: 'break-word',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {formatParamValue(value)}
                          </Typography>
                        </Tooltip>
                      </Box>
                    ))}
                  </Box>
                )}
              </Paper>
            );
          })}

          {(!template.metrics || template.metrics.length === 0) && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Esta plantilla no incluye ninguna métrica.
            </Typography>
          )}
        </Box>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
        <Button
          size="small"
          startIcon={<SettingsIcon />}
          onClick={() => { onClose(); router.push('/settings/templates'); }}
          sx={{ color: '#666', textTransform: 'none', '&:hover': { color: GREEN } }}
        >
          Gestionar plantillas
        </Button>
        <Button
          onClick={onClose}
          variant="contained"
          disableElevation
          sx={{
            backgroundColor: GREEN,
            color: '#FFFFFF',
            '&:hover': { backgroundColor: GREEN_HOVER },
          }}
        >
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
