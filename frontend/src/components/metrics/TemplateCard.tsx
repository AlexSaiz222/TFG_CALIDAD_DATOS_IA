import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  CardActionArea,
  Typography,
  Chip,
  Box,
  IconButton,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as TemplateIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { MetricTemplate } from '../../types';
import { getMetricMeta, GREEN, GREEN_HOVER } from '../../utils/metricColors';

export type TemplateCardMode = 'manage' | 'select' | 'apply';

interface TemplateCardProps {
  template: MetricTemplate;
  mode: TemplateCardMode;
  selected?: boolean;
  onSelect?: (template: MetricTemplate) => void;
  onEdit?: (template: MetricTemplate) => void;
  onDuplicate?: (template: MetricTemplate) => void;
  onDelete?: (template: MetricTemplate) => void;
  onApply?: (template: MetricTemplate) => void;
  onViewDetails?: (template: MetricTemplate) => void;
  onExport?: (template: MetricTemplate) => void;
}

export default function TemplateCard({
  template,
  mode,
  selected = false,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onApply,
  onViewDetails,
  onExport,
}: TemplateCardProps) {
  const { t } = useTranslation();
  const metricCount = template.metrics?.length || 0;

  // --- MODE: select (project creation wizard) ---
  if (mode === 'select') {
    return (
      <Card
        variant="outlined"
        sx={{
          height: '100%',
          borderColor: selected ? GREEN : '#E0E0E0',
          borderWidth: selected ? 2 : 1,
          transition: 'all 0.2s',
          position: 'relative',
          '&:hover': {
            borderColor: GREEN,
            boxShadow: '0 2px 8px rgba(0,179,126,0.08)',
          },
        } as any}
      >
        <CardActionArea
          onClick={() => onSelect?.(template)}
          sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' } as any}
        >
          {/* @ts-ignore — TS2590: MUI Box type inference too complex when lucide-react types are in scope */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, width: '100%' }}>
            <TemplateIcon sx={{ color: selected ? GREEN : '#999', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1, lineHeight: 1.3 }}>
              {template.name}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.4 }}>
            {template.description || t('metrics.templates.card.noDescription')}
          </Typography>
          <Chip
            label={t('metrics.templates.card.metricCount', { count: metricCount })}
            size="small"
            sx={{ backgroundColor: 'rgba(0,179,126,0.1)', color: GREEN, fontWeight: 500 }}
          />
          {selected && (
            <CheckCircleIcon
              sx={{ position: 'absolute', top: 8, right: 8, color: GREEN, fontSize: 20 }}
            />
          )}
        </CardActionArea>
      </Card>
    );
  }

  // --- MODE: apply (metrics configure page) ---
  if (mode === 'apply') {
    return (
      <Card
        elevation={0}
        sx={{
          height: '100%',
          border: '1px solid #E0E0E0',
          borderRadius: 2,
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: GREEN,
            boxShadow: '0 4px 12px rgba(0,179,126,0.1)',
          },
        }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>
              {template.name}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              minHeight: 40,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {template.description || t('metrics.templates.card.noDescription')}
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
            {template.metrics?.slice(0, 3).map((metric: any, idx: number) => {
              const meta = getMetricMeta(metric.name);
              return (
                <Chip
                  key={metric.id ?? metric.metric_id ?? idx}
                  label={meta.label}
                  size="small"
                  sx={{
                    backgroundColor: meta.bg,
                    color: meta.color,
                    fontWeight: 500,
                    fontSize: '0.7rem',
                  }}
                />
              );
            })}
            {metricCount > 3 && (
              <Chip
                label={`+${metricCount - 3}`}
                size="small"
                sx={{ backgroundColor: '#F5F5F5', color: '#666', fontWeight: 500, fontSize: '0.7rem' }}
              />
            )}
          </Box>
        </CardContent>
        <CardActions sx={{ px: 2, pb: 2, pt: 0, gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onApply?.(template)}
            sx={{
              borderColor: GREEN,
              color: GREEN,
              textTransform: 'none',
              '&:hover': { borderColor: GREEN_HOVER, backgroundColor: 'rgba(0,179,126,0.04)' },
            }}
          >
            {t('metrics.templates.card.applyTemplate')}
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => onViewDetails?.(template)}
            sx={{
              color: '#666',
              textTransform: 'none',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' },
            }}
          >
            {t('metrics.templates.card.details')}
          </Button>
        </CardActions>
      </Card>
    );
  }

  // --- MODE: manage (settings page, default) ---
  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        border: '1px solid #E0E0E0',
        borderRadius: 2,
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: GREEN,
          boxShadow: '0 4px 12px rgba(0,179,126,0.1)',
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A', lineHeight: 1.3 }}>
            {template.name}
          </Typography>
        </Box>

        {template.description && (
          <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
            {template.description}
          </Typography>
        )}

        <Typography
          variant="caption"
          sx={{ color: '#999', textTransform: 'uppercase', fontWeight: 600, mb: 1, display: 'block' }}
        >
          {t('metrics.templates.card.metricsLabel', { count: metricCount })}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {template.metrics?.slice(0, 4).map((metric: any, idx: number) => {
            const meta = getMetricMeta(metric.name);
            return (
              <Chip
                key={metric.id ?? metric.metric_id ?? idx}
                label={meta.label}
                size="small"
                sx={{
                  backgroundColor: meta.bg,
                  color: meta.color,
                  fontWeight: 500,
                  fontSize: '0.7rem',
                }}
              />
            );
          })}
          {metricCount > 4 && (
            <Chip
              label={`+${metricCount - 4}`}
              size="small"
              sx={{ backgroundColor: '#F5F5F5', color: '#666', fontWeight: 500, fontSize: '0.7rem' }}
            />
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
        <Tooltip title={t('metrics.templates.card.editTooltip')}>
          <IconButton
            size="small"
            onClick={() => onEdit?.(template)}
            sx={{ color: '#666', '&:hover': { color: GREEN } }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('metrics.templates.card.duplicateTooltip')}>
          <IconButton
            size="small"
            onClick={() => onDuplicate?.(template)}
            sx={{ color: '#666', '&:hover': { color: GREEN } }}
          >
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('metrics.templates.card.exportTooltip')}>
          <IconButton
            size="small"
            onClick={() => onExport?.(template)}
            sx={{ color: '#666', '&:hover': { color: GREEN } }}
          >
            <FileDownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('metrics.templates.card.deleteTooltip')}>
          <IconButton
            size="small"
            onClick={() => onDelete?.(template)}
            sx={{ color: '#666', '&:hover': { color: '#E5484D' } }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}
