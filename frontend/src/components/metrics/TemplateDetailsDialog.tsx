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
  Grid,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { MetricTemplate } from '../../types';
import { categoryColor, GREEN } from '../../utils/metricColors';

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
  if (!template) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            Detalles de plantilla: {template.name}
          </Typography>
          <IconButton edge="end" color="inherit" onClick={onClose} aria-label="cerrar">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ p: 0 }}>
        {template.description && (
          <Box sx={{ px: 3, pt: 2, pb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {template.description}
            </Typography>
          </Box>
        )}
        
        <Box sx={{ p: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#1A1A1A', textTransform: 'uppercase' }}>
            Métricas incluidas ({template.metrics?.length || 0})
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {template.metrics?.map((metric: any, index: number) => {
              const colors = categoryColor(metric.category);
              const hasParams = metric.parameters && Object.keys(metric.parameters).length > 0;
              
              return (
                <Paper
                  key={metric.id ?? metric.metric_id ?? index}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    borderColor: '#E0E0E0',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: hasParams ? 1.5 : 0 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: colors.bg,
                        mr: 1.5,
                      }}
                    />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {metric.name}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        ml: 1.5, 
                        px: 1, 
                        py: 0.25, 
                        borderRadius: 1, 
                        backgroundColor: colors.bg, 
                        color: colors.fg,
                        fontWeight: 500,
                        fontSize: '0.65rem'
                      }}
                    >
                      {metric.category}
                    </Typography>
                  </Box>
                  
                  {hasParams && (
                    <Box sx={{ pl: 2.5 }}>
                      <Typography variant="caption" sx={{ color: '#666', mb: 0.5, display: 'block', fontWeight: 500 }}>
                        PARÁMETROS APLICADOS:
                      </Typography>
                      <Grid container spacing={1}>
                        {Object.entries(metric.parameters).map(([key, value]) => (
                          <Grid item xs={12} sm={6} key={key}>
                            <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                              <Typography variant="caption" sx={{ color: '#666', fontWeight: 500, mr: 1 }}>
                                {key}:
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </Typography>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Box>
          {(!template.metrics || template.metrics.length === 0) && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Esta plantilla no incluye ninguna métrica.
            </Typography>
          )}
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2 }}>
        <Button 
          onClick={onClose} 
          variant="contained" 
          disableElevation
          sx={{
            backgroundColor: GREEN,
            '&:hover': {
              backgroundColor: '#00A070',
            },
          }}
        >
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
