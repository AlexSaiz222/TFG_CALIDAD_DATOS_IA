import React from 'react';
import { Box, Paper, Typography, Chip, Grid } from '@mui/material';

interface BadgeConfig {
  label: string;
  bg: string;
  color: string;
}

interface ExecutiveMetricCardProps {
  title: string;
  value: string;
  badge: BadgeConfig;
  insight: string;
  onClickDetail: () => void;
}

const ExecutiveMetricCard: React.FC<ExecutiveMetricCardProps> = ({
  title,
  value,
  badge,
  insight,
  onClickDetail,
}) => {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Paper
        elevation={0}
        onClick={onClickDetail}
        sx={{
          p: 3,
          border: '1px solid #EEEEEE',
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': {
            borderColor: '#1976d2',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          },
          height: '100%',
        }}
      >
        {/* Header con badge */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#333', fontSize: '0.875rem' }}>
            {title}
          </Typography>
          <Chip
            label={badge.label}
            size="small"
            sx={{
              backgroundColor: badge.bg,
              color: badge.color,
              fontWeight: 500,
              fontSize: '0.7rem',
              height: 20,
            }}
          />
        </Box>

        {/* Valor principal */}
        <Typography variant="h3" sx={{ fontWeight: 700, color: badge.color, mb: 1.5, lineHeight: 1 }}>
          {value}
        </Typography>

        {/* Hallazgo clave */}
        <Typography variant="body2" sx={{ color: '#555', mb: 2, fontSize: '0.875rem', minHeight: '2.5em' }}>
          {insight}
        </Typography>

        {/* CTA */}
        <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 500, fontSize: '0.75rem' }}>
          Ver detalle →
        </Typography>
      </Paper>
    </Grid>
  );
};

export default ExecutiveMetricCard;
