import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

interface QualityScoreGaugeProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

const QualityScoreGauge: React.FC<QualityScoreGaugeProps> = ({ 
  score, 
  size = 'medium',
  showLabel = true 
}) => {
  const normalizedScore = Math.min(100, Math.max(0, score));
  
  const getColor = (value: number): string => {
    if (value >= 80) return '#00B37E';
    if (value >= 60) return '#FFB800';
    return '#E5484D';
  };

  const getVerdict = (value: number): { label: string; description: string } => {
    if (value >= 90) return { label: 'Excelente', description: 'Dataset de alta calidad, listo para uso.' };
    if (value >= 80) return { label: 'Bueno', description: 'Calidad aceptable con mejoras menores posibles.' };
    if (value >= 60) return { label: 'Aceptable', description: 'Requiere atención en algunas métricas.' };
    if (value >= 40) return { label: 'Deficiente', description: 'Problemas significativos que corregir.' };
    return { label: 'Crítico', description: 'Calidad insuficiente, revisión urgente necesaria.' };
  };

  const getSize = (): { width: number; thickness: number; fontSize: string } => {
    switch (size) {
      case 'small':
        return { width: 80, thickness: 6, fontSize: '1rem' };
      case 'large':
        return { width: 180, thickness: 10, fontSize: '1.75rem' };
      default:
        return { width: 120, thickness: 8, fontSize: '1.25rem' };
    }
  };

  const { width, thickness, fontSize } = getSize();
  const color = getColor(normalizedScore);
  const verdict = getVerdict(normalizedScore);

  const containerSx: SxProps<Theme> = {
    position: 'relative',
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  return (
    // @ts-ignore - MUI Box sx type inference too complex
    <Box sx={containerSx}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant="determinate"
          value={100}
          size={width}
          thickness={thickness}
          sx={{
            color: '#EEEEEE',
            position: 'absolute',
          }}
        />
        <CircularProgress
          variant="determinate"
          value={normalizedScore}
          size={width}
          thickness={thickness}
          sx={{
            color: color,
            '& .MuiCircularProgress-circle': {
              strokeLinecap: 'round',
              transition: 'stroke-dashoffset 0.5s ease-in-out',
            },
          }}
        />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="h4"
            component="div"
            sx={{
              fontWeight: 700,
              fontSize: fontSize,
              color: color,
            }}
          >
            {`${Math.round(normalizedScore)}%`}
          </Typography>
        </Box>
      </Box>
      {showLabel && (
        <>
          <Typography
            variant="body2"
            sx={{
              mt: 1,
              color: '#555555',
              fontWeight: 500,
            }}
          >
            Quality Score
          </Typography>
          <Typography
            variant="subtitle2"
            sx={{
              mt: 0.5,
              color: color,
              fontWeight: 700,
              fontSize: size === 'large' ? '1rem' : '0.8rem',
            }}
          >
            {verdict.label}
          </Typography>
          {size === 'large' && (
            <Typography
              variant="caption"
              sx={{
                mt: 0.25,
                color: '#888',
                textAlign: 'center',
                maxWidth: 200,
              }}
            >
              {verdict.description}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
};

export default QualityScoreGauge;
