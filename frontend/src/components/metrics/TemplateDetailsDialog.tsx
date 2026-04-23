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
  Grid,
} from '@mui/material';
import {
  Close as CloseIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { MetricTemplate } from '../../types';
import { getMetricMeta, GREEN, GREEN_HOVER } from '../../utils/metricColors';

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

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (value === true) return `✓ ${t('metrics.paramValues.enabled')}`;
    if (value === false) return `✗ ${t('metrics.paramValues.disabled')}`;
    if (Array.isArray(value)) {
      if (value.length === 0) return '— (auto)';
      if (typeof value[0] === 'object' && value[0] !== null) {
        if ('column' in value[0] && 'expected_type' in value[0])
          return (value as any[]).map((v) => `${v.column} (${v.expected_type})`).join(', ');
        if ('name' in value[0] && 'type' in value[0])
          return (value as any[]).map((v) => v.name).join(', ');
        return `${value.length}`;
      }
      return (value as unknown[]).join(', ');
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1.5, pt: 2.5, px: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1A1A1A', lineHeight: 1.3 }}>
              {template.name}
            </Typography>
            {template.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {template.description}
              </Typography>
            )}
          </Box>
          <IconButton
            edge="end"
            color="inherit"
            onClick={onClose}
            aria-label={t('metrics.templates.detailsDialog.closeAriaLabel')}
            sx={{ mt: -0.5 }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        <Typography
          variant="caption"
          sx={{ color: '#999', textTransform: 'uppercase', fontWeight: 600, mb: 2, display: 'block', letterSpacing: '0.08em' }}
        >
          {t('metrics.templates.detailsDialog.metricsTitle')} ({template.metrics?.length || 0})
        </Typography>

        {(!template.metrics || template.metrics.length === 0) ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            {t('metrics.templates.detailsDialog.noMetrics')}
          </Typography>
        ) : (
          <Grid container spacing={2}>
            {template.metrics.map((metric: any, index: number) => {
              const meta = getMetricMeta(metric.name);
              const IconComp = meta.icon;
              const params = metric.parameters ?? {};
              const paramEntries = Object.entries(params);

              return (
                <Grid item xs={12} sm={6} key={metric.id ?? metric.metric_id ?? index}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      borderColor: '#E8E8E8',
                      borderLeft: `3px solid ${meta.color}`,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 30, height: 30, borderRadius: '8px', backgroundColor: meta.bg, flexShrink: 0,
                      }}>
                        <IconComp size={16} color={meta.color} strokeWidth={1.8} />
                      </Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.3, flex: 1 }}>
                        {t(`metrics.labels.${metric.name}`, { defaultValue: meta.label })}
                      </Typography>
                      <Chip
                        label={t(`metrics.metricCategories.${meta.categoryKey}`, { defaultValue: meta.category })}
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

                    {paramEntries.length > 0 && (
                      <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: 1,
                      }}>
                        {paramEntries.map(([key, value]) => (
                          <Box key={key}>
                            <Typography variant="caption" sx={{ color: '#888', fontWeight: 500, display: 'block', lineHeight: 1.3 }}>
                              {t(`metrics.paramLabels.${key}`, { defaultValue: key })}
                            </Typography>
                            <Tooltip
                              title={typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : ''}
                              arrow
                              disableHoverListener={typeof value !== 'object' || value === null}
                            >
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
                                {formatValue(value)}
                              </Typography>
                            </Tooltip>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        )}
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
