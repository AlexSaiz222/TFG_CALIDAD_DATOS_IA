import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';

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
  const normalizedScore = Math.min(100, Math.max(0, score * 100));
  
  const getColor = (value: number): string => {
    if (value >= 80) return '#00B37E';
    if (value >= 60) return '#FFB800';
    return '#E5484D';
  };

  const getSize = (): { width: number; thickness: number; fontSize: string } => {
    switch (size) {
      case 'small':
        return { width: 80, thickness: 6, fontSize: '1.25rem' };
      case 'large':
        return { width: 180, thickness: 10, fontSize: '2.5rem' };
      default:
        return { width: 120, thickness: 8, fontSize: '1.75rem' };
    }
  };

  const { width, thickness, fontSize } = getSize();
  const color = getColor(normalizedScore);

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
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
      )}
    </Box>
  );
};

export default QualityScoreGauge;
