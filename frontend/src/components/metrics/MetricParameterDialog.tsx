import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Typography,
  Box,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  IconButton,
  Grid,
  Chip,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { Metric, MetricConfig } from '../../types';

interface MetricParameterDialogProps {
  open: boolean;
  onClose: () => void;
  metric: Metric | null;
  metricConfig: MetricConfig | null;
  onSave: (updatedConfig: MetricConfig) => void;
}

// Helper function to determine input type based on parameter value
const getParameterType = (value: any): string => {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return 'integer';
    return 'float';
  }
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object' && value !== null) return 'object';
  return 'string';
};

const MetricParameterDialog: React.FC<MetricParameterDialogProps> = ({
  open,
  onClose,
  metric,
  metricConfig,
  onSave,
}) => {
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (metric && metricConfig) {
      setParameters({ ...metricConfig.parameters });
      setErrors({});
    }
  }, [metric, metricConfig]);

  const handleParameterChange = (paramName: string, value: any) => {
    setParameters((prev) => ({
      ...prev,
      [paramName]: value,
    }));
    
    // Clear error for this parameter
    if (errors[paramName]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[paramName];
        return newErrors;
      });
    }
  };

  const validateParameters = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!metric) return false;

    // Validate each parameter based on its type
    Object.entries(metric.parameters).forEach(([paramName, defaultValue]) => {
      const currentValue = parameters[paramName];
      const paramType = getParameterType(defaultValue);

      // Required check
      if (currentValue === undefined || currentValue === null || currentValue === '') {
        newErrors[paramName] = 'This field is required';
        isValid = false;
        return;
      }

      // Type-specific validations
      switch (paramType) {
        case 'integer':
        case 'float':
          if (typeof currentValue !== 'number' || isNaN(currentValue)) {
            newErrors[paramName] = `Must be a valid ${paramType}`;
            isValid = false;
          }
          break;
        case 'array':
          if (!Array.isArray(currentValue)) {
            newErrors[paramName] = 'Must be an array';
            isValid = false;
          }
          break;
        // Add more validations as needed
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSave = () => {
    if (!metric || !metricConfig) return;

    if (validateParameters()) {
      onSave({
        metric_id: metricConfig.metric_id,
        parameters,
      });
    }
  };

  const renderParameterInput = (paramName: string, defaultValue: any) => {
    const paramType = getParameterType(defaultValue);
    const value = parameters[paramName] !== undefined ? parameters[paramName] : defaultValue;
    const error = errors[paramName] || '';

    switch (paramType) {
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(value)}
                onChange={(e) => handleParameterChange(paramName, e.target.checked)}
                color="primary"
              />
            }
            label={paramName}
          />
        );
      case 'integer':
      case 'float':
        return (
          <TextField
            fullWidth
            label={paramName}
            type="number"
            value={value}
            onChange={(e) => {
              const newValue = paramType === 'integer' 
                ? parseInt(e.target.value, 10) 
                : parseFloat(e.target.value);
              handleParameterChange(paramName, newValue);
            }}
            error={!!error}
            helperText={error || `Enter a ${paramType} value`}
            InputProps={{
              inputProps: { 
                step: paramType === 'integer' ? 1 : 0.01 
              }
            }}
          />
        );
      case 'array':
        return (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {paramName}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {Array.isArray(value) && value.map((item, index) => (
                <Chip 
                  key={index} 
                  label={item.toString()} 
                  onDelete={() => {
                    const newArray = [...value];
                    newArray.splice(index, 1);
                    handleParameterChange(paramName, newArray);
                  }}
                />
              ))}
            </Box>
            {error && <FormHelperText error>{error}</FormHelperText>}
            {/* Add functionality to add items to array if needed */}
          </Box>
        );
      case 'object':
        return (
          <TextField
            fullWidth
            label={paramName}
            multiline
            rows={4}
            value={JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsedValue = JSON.parse(e.target.value);
                handleParameterChange(paramName, parsedValue);
              } catch (err) {
                // Handle JSON parse error
                setErrors((prev) => ({
                  ...prev,
                  [paramName]: 'Invalid JSON format',
                }));
              }
            }}
            error={!!error}
            helperText={error || 'Enter a valid JSON object'}
          />
        );
      default: // string
        return (
          <TextField
            fullWidth
            label={paramName}
            value={value}
            onChange={(e) => handleParameterChange(paramName, e.target.value)}
            error={!!error}
            helperText={error}
          />
        );
    }
  };

  if (!metric || !metricConfig) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Configure {metric.name} Parameters</Typography>
          <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            {metric.description || 'No description available'}
          </Typography>
          <Chip 
            label={metric.category} 
            size="small" 
            sx={{ 
              mt: 1,
              backgroundColor: '#F0F9F6', 
              color: '#00B37E',
              fontWeight: 500,
            }} 
          />
        </Box>

        <Grid container spacing={3}>
          {Object.entries(metric.parameters).map(([paramName, defaultValue]) => (
            <Grid item xs={12} sm={6} key={paramName}>
              {renderParameterInput(paramName, defaultValue)}
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          sx={{
            backgroundColor: '#00B37E',
            '&:hover': {
              backgroundColor: '#00A070',
            },
          }}
        >
          Save Parameters
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MetricParameterDialog;
