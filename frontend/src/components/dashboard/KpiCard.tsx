import React from 'react';
import { Box, Card, CardContent, Typography, Chip, Divider } from '@mui/material';

interface KpiCardProps {
  title: string;
  value: string | number;
  chipLabel: string;
  chipColor: string;
  icon: React.ReactNode;
  iconBgColor: string;
  footer?: React.ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  chipLabel,
  chipColor,
  icon,
  iconBgColor,
  footer,
}) => {
  return (
    <Card
      sx={{
        position: 'relative',
        pt: 3,
        borderRadius: 3,
        border: '1px solid #EEEEEE',
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        overflow: 'visible',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      {/* Floating icon */}
      <Box
        sx={{
          position: 'absolute',
          top: -16,
          left: 20,
          width: 52,
          height: 52,
          borderRadius: 2,
          backgroundColor: iconBgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0px 4px 12px ${iconBgColor}66`,
          color: '#FFFFFF',
        }}
      >
        {icon}
      </Box>
      <CardContent sx={{ pt: 2.5, pb: footer ? 1 : 2, '&:last-child': { pb: footer ? 1 : 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="body2" sx={{ color: '#888', fontWeight: 500, mt: 0.5 }}>
            {title}
          </Typography>
          <Chip
            label={chipLabel}
            size="small"
            sx={{
              backgroundColor: `${chipColor}15`,
              color: chipColor,
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 22,
            }}
          />
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#1A1A1A', mb: 0.5 }}>
          {value}
        </Typography>
        {footer && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {footer}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default KpiCard;
