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
import { useTranslation } from 'react-i18next';
import { MetricTemplate } from '../../types';
import { getMetricMeta, formatParamValue, GREEN, GREEN_HOVER } from '../../utils/metricColors';

/** Mapping from parameter key to i18n path suffix for projects.paramHelp */
const PARAM_LABEL_KEYS: Record<string, string> = {
  threshold: 'threshold',
  columns: 'columns',
  method: 'method',
  factor: 'factor',
  auto_detect: 'auto_detect',
  auto_detect_types: 'auto_detect_types',
  staleness_threshold_days: 'staleness_threshold_days',
  max_cardinality: 'max_cardinality',
  imbalance_threshold_high: 'imbalance_threshold_high',
  imbalance_threshold_low: 'imbalance_threshold_low',
  rules: 'rules',
};

/** Fallback labels used when no i18n translation key is available */
const PARAM_LABELS_FALLBACK: Record<string, string> = {
  threshold: 'Threshold',
  columns: 'Columns',
  method: 'Method',
  factor: 'Factor',
  auto_detect: 'Auto-detection',
  auto_detect_types: 'Auto-detection of types',
  staleness_threshold_days: 'Staleness days',
  max_cardinality: 'Max cardinality',
  imbalance_threshold_high: 'High threshold',
  imbalance_threshold_low: 'Low threshold',
  rules: 'Rules',
};

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
  const { t } = useTranslation();

  if (!template) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            {template.name}
          </Typography>
          <IconButton edge="end" color="inherit" onClick={onClose} aria-label={t('metrics.templates.detailsDialog.closeAriaLabel')}>
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
          {t('metrics.templates.detailsDialog.metricsTitle')} ({template.metrics?.length || 0})
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
                          {PARAM_LABELS_FALLBACK[key] ?? key}
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
              {t('metrics.templates.detailsDialog.noMetrics')}
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
          {t('metrics.templates.title')}
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
          {t('metrics.templates.detailsDialog.cancelButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
