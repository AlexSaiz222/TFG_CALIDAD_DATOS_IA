import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Slider,
  TextField,
  Button,
  Paper,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Save as SaveIcon,
  RestartAlt as RestartAltIcon,
  Security as SecurityIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { projectsAPI } from '../services/api';

const GREEN = '#00B37E';
const GREEN_HOVER = '#00A070';
const ORANGE = '#FFB800';
const RED = '#E5484D';

interface QualityGateThresholds {
  min_score: number;
  max_critical_issues: number;
  max_new_issues: number;
}

interface QualityGateSettingsProps {
  projectId: number;
  onThresholdsLoaded?: (thresholds: QualityGateThresholds) => void;
}

const DEFAULT_THRESHOLDS: QualityGateThresholds = {
  min_score: 70,
  max_critical_issues: 0,
  max_new_issues: 10,
};

const THRESHOLD_LABELS: Record<string, { label: string; description: string; unit: string }> = {
  min_score: {
    label: 'Score mínimo',
    description: 'Puntuación mínima que debe alcanzar el dataset para aprobar',
    unit: '%',
  },
  max_critical_issues: {
    label: 'Máx. issues críticos',
    description: 'Número máximo de issues críticos permitidos antes de fallar',
    unit: '',
  },
  max_new_issues: {
    label: 'Máx. nuevos issues',
    description: 'Número máximo de nuevos issues permitidos por análisis',
    unit: '',
  },
};

const QualityGateSettings: React.FC<QualityGateSettingsProps> = ({ projectId, onThresholdsLoaded }) => {
  const [thresholds, setThresholds] = useState<QualityGateThresholds>(DEFAULT_THRESHOLDS);
  const [originalThresholds, setOriginalThresholds] = useState<QualityGateThresholds>(DEFAULT_THRESHOLDS);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load current Quality Gate config
  useEffect(() => {
    const loadQualityGate = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await projectsAPI.getQualityGate(projectId);
        const data = response.data?.data || response.data;
        if (data && data.thresholds) {
          const loaded = { ...DEFAULT_THRESHOLDS, ...data.thresholds };
          setThresholds(loaded);
          setOriginalThresholds(loaded);
          setIsActive(data.is_active !== false);
          onThresholdsLoaded?.(loaded);
        }
      } catch (err: any) {
        console.error('Error loading Quality Gate:', err);
        setError('No se pudo cargar la configuración del Quality Gate');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadQualityGate();
    }
  }, [projectId]);

  // Track changes
  useEffect(() => {
    const changed = JSON.stringify(thresholds) !== JSON.stringify(originalThresholds);
    setHasChanges(changed);
  }, [thresholds, originalThresholds]);

  const handleSliderChange = (key: string) => (_event: Event, value: number | number[]) => {
    setSuccessMessage(null);
    setThresholds(prev => ({ ...prev, [key]: value as number }));
  };

  const handleInputChange = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setSuccessMessage(null);
    const value = Number(event.target.value);
    if (!isNaN(value)) {
      setThresholds(prev => ({ ...prev, [key]: value }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await projectsAPI.updateQualityGate(projectId, thresholds, { is_active: isActive });
      setOriginalThresholds({ ...thresholds });
      setSuccessMessage('Quality Gate guardado correctamente');
      onThresholdsLoaded?.(thresholds);
    } catch (err: any) {
      console.error('Error saving Quality Gate:', err);
      setError(err.response?.data?.message || 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setThresholds({ ...DEFAULT_THRESHOLDS });
    setSuccessMessage(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: GREEN }} />
      </Box>
    );
  }

  const renderSliderField = (key: string, min: number, max: number, step: number = 1) => {
    const config = THRESHOLD_LABELS[key];
    const value = (thresholds as any)[key];
    const isPercentage = config.unit === '%';

    // Determine color based on how strict the threshold is
    const getColor = () => {
      if (!isPercentage) return GREEN;
      if (value >= 90) return RED;
      if (value >= 70) return ORANGE;
      return GREEN;
    };

    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 2,
          border: '1px solid #EEEEEE',
          transition: 'border-color 0.2s ease',
          '&:hover': { borderColor: GREEN },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Tooltip title={config.description} placement="top">
            <Typography variant="subtitle1" sx={{ fontWeight: 600, cursor: 'help' }}>
              {config.label}
            </Typography>
          </Tooltip>
          <Chip
            label={`${value}${config.unit}`}
            size="small"
            sx={{
              backgroundColor: `${getColor()}15`,
              color: getColor(),
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          />
        </Box>
        <Typography variant="body2" sx={{ color: '#777777', mb: 2, fontSize: '0.8rem' }}>
          {config.description}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Slider
            value={value}
            onChange={handleSliderChange(key)}
            min={min}
            max={max}
            step={step}
            disabled={!isActive}
            sx={{
              color: getColor(),
              '& .MuiSlider-thumb': {
                width: 20,
                height: 20,
                '&:hover': { boxShadow: `0 0 0 8px ${getColor()}20` },
              },
            }}
          />
          <TextField
            value={value}
            onChange={handleInputChange(key)}
            disabled={!isActive}
            type="number"
            size="small"
            inputProps={{ min, max, step }}
            sx={{ width: 80 }}
          />
        </Box>
      </Paper>
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <SecurityIcon sx={{ color: GREEN, fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Configuración del Quality Gate
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={isActive}
              onChange={(e) => { setIsActive(e.target.checked); setHasChanges(true); }}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: GREEN },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: GREEN },
              }}
            />
          }
          label={isActive ? 'Activo' : 'Desactivado'}
        />
      </Box>

      {/* Description */}
      <Alert
        severity="info"
        icon={<InfoIcon />}
        sx={{
          mb: 3,
          borderRadius: 2,
          backgroundColor: 'rgba(0, 179, 126, 0.05)',
          border: '1px solid rgba(0, 179, 126, 0.2)',
          '& .MuiAlert-icon': { color: GREEN },
        }}
      >
        Define los umbrales mínimos que debe cumplir un dataset para superar el Quality Gate.
        Los análisis que no cumplan estos criterios serán marcados como <strong>FAILED</strong> o <strong>WARNING</strong>.
      </Alert>

      {/* Feedback messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert
          severity="success"
          icon={<CheckCircleIcon />}
          sx={{ mb: 2, borderRadius: 2 }}
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}

      {/* Threshold sliders */}
      <Grid container spacing={2.5} sx={{ opacity: isActive ? 1 : 0.5 }}>
        <Grid item xs={12} md={6}>
          {renderSliderField('min_score', 0, 100)}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderSliderField('max_critical_issues', 0, 50)}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderSliderField('max_new_issues', 0, 100)}
        </Grid>
      </Grid>

      {/* Action buttons */}
      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={handleResetDefaults}
          disabled={saving}
          sx={{
            borderColor: '#CCCCCC',
            color: '#555555',
            '&:hover': { borderColor: '#999999', backgroundColor: '#FAFAFA' },
          }}
        >
          Restaurar valores por defecto
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !hasChanges}
          sx={{
            backgroundColor: GREEN,
            color: '#FFFFFF',
            '&:hover': { backgroundColor: GREEN_HOVER },
            '&.Mui-disabled': { backgroundColor: '#E0E0E0' },
          }}
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </Box>
    </Box>
  );
};

export default QualityGateSettings;
