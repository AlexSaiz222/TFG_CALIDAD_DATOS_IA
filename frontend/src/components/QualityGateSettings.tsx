import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Slider,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Save as SaveIcon,
  RestartAlt as RestartAltIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { projectsAPI } from '../services/api';
import { useTranslation } from 'react-i18next';

// ─── paleta ───────────────────────────────────────────────────────────────
const GREEN  = '#00B37E';
const ORANGE = '#FFB800';
const RED    = '#E5484D';
const GRAY   = '#888888';

interface QualityGateThresholds {
  min_score: number;
  max_critical_issues: number;
  max_new_issues: number;
}

interface QualityGateSettingsProps {
  projectId: number;
  onThresholdsLoaded?: (t: QualityGateThresholds) => void;
}

const DEFAULT: QualityGateThresholds = {
  min_score: 70,
  max_critical_issues: 0,
  max_new_issues: 10,
};

// ─── rule card ────────────────────────────────────────────────────────────
interface RuleCardProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  operator: string;
  strictness: { label: string; color: string };
  disabled: boolean;
  onChange: (v: number) => void;
  sliderColor?: string;
}

const RuleCard: React.FC<RuleCardProps> = ({
  label, description, value, min, max, step = 1,
  unit, operator, strictness, disabled, onChange, sliderColor,
}) => {
  const color = sliderColor || strictness.color;

  return (
    <Box sx={{
      border: '1px solid #EEEEEE',
      borderRadius: 2,
      p: 2.5,
      backgroundColor: '#fff',
      transition: 'border-color 0.15s',
      '&:hover': { borderColor: '#D0D0D0' },
    }}>
      {/* Top row: label + value + strictness badge */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.75 }}>
        <Box>
          <Tooltip title={description} placement="top-start" enterDelay={400}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#1A1A1A', cursor: 'default' }}>
              {label}
            </Typography>
          </Tooltip>
          <Typography sx={{ fontSize: '0.72rem', color: '#AAAAAA', mt: 0.25 }}>
            {description}
          </Typography>
        </Box>

        {/* Value pill */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, ml: 2 }}>
          <Box sx={{
            px: 1.25, py: 0.3,
            borderRadius: '6px',
            backgroundColor: `${strictness.color}12`,
            border: `1px solid ${strictness.color}30`,
          }}>
            <Typography sx={{
              fontSize: '0.7rem', fontWeight: 700,
              color: strictness.color, letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {strictness.label}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Condition display: operator + big value */}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 2, mt: 1.5 }}>
        <Typography sx={{ fontSize: '0.95rem', color: '#AAAAAA', fontWeight: 400 }}>
          {operator}
        </Typography>
        <Typography sx={{
          fontSize: '2rem', fontWeight: 700, lineHeight: 1,
          color, fontVariantNumeric: 'tabular-nums',
        }}>
          {value}
        </Typography>
        {unit && (
          <Typography sx={{ fontSize: '1rem', color: '#AAAAAA', fontWeight: 400 }}>
            {unit}
          </Typography>
        )}
      </Box>

      {/* Slider + input */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Slider
          value={value}
          onChange={(_, v) => onChange(v as number)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          sx={{
            color,
            height: 4,
            '& .MuiSlider-thumb': {
              width: 16, height: 16,
              boxShadow: 'none',
              '&:hover, &.Mui-focusVisible': {
                boxShadow: `0 0 0 6px ${color}25`,
              },
            },
            '& .MuiSlider-rail': { opacity: 0.2 },
          }}
        />
        <TextField
          value={value}
          onChange={e => { const n = Number(e.target.value); if (!isNaN(n)) onChange(n); }}
          disabled={disabled}
          type="number"
          size="small"
          inputProps={{ min, max, step }}
          sx={{
            width: 68, flexShrink: 0,
            '& input': { textAlign: 'center', fontSize: '0.82rem', py: '5px' },
            '& fieldset': { borderColor: '#E8E8E8' },
          }}
        />
      </Box>
    </Box>
  );
};

// ─── main component ────────────────────────────────────────────────────────
const QualityGateSettings: React.FC<QualityGateSettingsProps> = ({
  projectId,
  onThresholdsLoaded,
}) => {
  const { t } = useTranslation();
  const [thresholds, setThresholds]         = useState<QualityGateThresholds>(DEFAULT);
  const [original, setOriginal]             = useState<QualityGateThresholds>(DEFAULT);
  const [isActive, setIsActive]             = useState(true);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── strictness helpers (inside component to close over t) ────────────
  const scoreStrictness = (v: number): { label: string; color: string } => {
    if (v >= 85) return { label: t('qualityGate.settings.strict'),    color: RED    };
    if (v >= 60) return { label: t('qualityGate.settings.moderate'),  color: ORANGE };
    return              { label: t('qualityGate.settings.permissive'), color: GREEN  };
  };
  const criticalStrictness = (v: number): { label: string; color: string } => {
    if (v === 0) return { label: t('qualityGate.settings.strict'),    color: RED    };
    if (v <= 3)  return { label: t('qualityGate.settings.moderate'),  color: ORANGE };
    return              { label: t('qualityGate.settings.permissive'), color: GREEN  };
  };
  const newIssuesStrictness = (v: number): { label: string; color: string } => {
    if (v <= 3)  return { label: t('qualityGate.settings.strict'),    color: RED    };
    if (v <= 15) return { label: t('qualityGate.settings.moderate'),  color: ORANGE };
    return              { label: t('qualityGate.settings.permissive'), color: GREEN  };
  };

  // Load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await projectsAPI.getQualityGate(projectId);
        const data = res.data?.data || res.data;
        if (data?.thresholds) {
          const loaded = { ...DEFAULT, ...data.thresholds };
          setThresholds(loaded);
          setOriginal(loaded);
          setIsActive(data.is_active !== false);
          onThresholdsLoaded?.(loaded);
        }
      } catch {
        setError(t('qualityGate.settings.saveError'));
      } finally {
        setLoading(false);
      }
    };
    if (projectId) load();
  }, [projectId]);

  const set = (key: keyof QualityGateThresholds) => (v: number) => {
    setSuccessMessage(null);
    setThresholds(prev => ({ ...prev, [key]: v }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await projectsAPI.updateQualityGate(projectId, thresholds, { is_active: isActive });
      setOriginal({ ...thresholds });
      setSuccessMessage(t('qualityGate.settings.saveSuccess'));
      onThresholdsLoaded?.(thresholds);
    } catch (err: any) {
      setError(err.response?.data?.message || t('qualityGate.settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const isDirty = JSON.stringify(thresholds) !== JSON.stringify(original);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: GREEN }} size={28} />
      </Box>
    );
  }

  const s0 = scoreStrictness(thresholds.min_score);
  const s1 = criticalStrictness(thresholds.max_critical_issues);
  const s2 = newIssuesStrictness(thresholds.max_new_issues);

  return (
    <Box>
      {/* ── Header ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        mb: 3,
      }}>
        <Box>
          <Typography sx={{ fontSize: '0.78rem', color: GRAY, mt: 0.25 }}>
            {t('qualityGate.settings.subtitle')}
          </Typography>
        </Box>

        {/* Active toggle — minimal pill */}
        <Box
          onClick={() => setIsActive(v => !v)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.75,
            px: 1.5, py: 0.6,
            borderRadius: '20px',
            border: `1.5px solid ${isActive ? GREEN : '#DDD'}`,
            backgroundColor: isActive ? `${GREEN}10` : '#FAFAFA',
            cursor: 'pointer',
            transition: 'all 0.15s',
            '&:hover': { borderColor: isActive ? '#00A070' : '#BBBBBB' },
          }}
        >
          <Box sx={{
            width: 7, height: 7, borderRadius: '50%',
            backgroundColor: isActive ? GREEN : '#BBBBBB',
            transition: 'background-color 0.15s',
          }} />
          <Typography sx={{
            fontSize: '0.75rem', fontWeight: 600,
            color: isActive ? GREEN : '#AAAAAA',
          }}>
            {isActive ? t('common.active') : t('common.inactive')}
          </Typography>
        </Box>
      </Box>

      {/* ── Logic summary: "Pasa si Score ≥ 70% AND …" ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1,
        mb: 3, px: 2, py: 1.5,
        borderRadius: 2,
        border: '1px solid #EEEEEE',
        backgroundColor: '#FAFAFA',
        opacity: isActive ? 1 : 0.45,
      }}>
        <Typography sx={{ fontSize: '0.72rem', color: '#AAAAAA', mr: 0.5 }}>
          {t('qualityGate.settings.passIf')}
        </Typography>

        {[
          { text: t('qualityGate.settings.scoreCondition', { value: thresholds.min_score }),         color: s0.color },
          { text: t('qualityGate.settings.criticalCondition', { value: thresholds.max_critical_issues }), color: s1.color },
          { text: t('qualityGate.settings.newIssuesCondition', { value: thresholds.max_new_issues }),    color: s2.color },
        ].map(({ text, color }, i) => (
          <React.Fragment key={text}>
            <Box sx={{
              px: 1.25, py: 0.3,
              borderRadius: '6px',
              backgroundColor: `${color}12`,
              border: `1px solid ${color}35`,
            }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color }}>
                {text}
              </Typography>
            </Box>
            {i < 2 && (
              <Typography sx={{ fontSize: '0.68rem', color: '#CCCCCC', fontWeight: 600 }}>
                {t('qualityGate.settings.and')}
              </Typography>
            )}
          </React.Fragment>
        ))}
      </Box>

      {/* ── Feedback ── */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert
          severity="success"
          icon={<CheckCircleIcon fontSize="small" />}
          sx={{ mb: 2, borderRadius: 2 }}
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}

      {/* ── Rule cards ── */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 2,
        opacity: isActive ? 1 : 0.45,
        mb: 3,
      }}>
        <RuleCard
          label={t('qualityGate.settings.scoreLabel')}
          description={t('qualityGate.settings.scoreDesc')}
          value={thresholds.min_score}
          min={0} max={100}
          unit="%" operator="≥"
          strictness={s0}
          disabled={!isActive}
          onChange={set('min_score')}
        />
        <RuleCard
          label={t('qualityGate.settings.criticalLabel')}
          description={t('qualityGate.settings.criticalDesc')}
          value={thresholds.max_critical_issues}
          min={0} max={50}
          unit="" operator="≤"
          strictness={s1}
          disabled={!isActive}
          onChange={set('max_critical_issues')}
        />
        <RuleCard
          label={t('qualityGate.settings.newIssuesLabel')}
          description={t('qualityGate.settings.newIssuesDesc')}
          value={thresholds.max_new_issues}
          min={0} max={100}
          unit="" operator="≤"
          strictness={s2}
          disabled={!isActive}
          onChange={set('max_new_issues')}
        />
      </Box>

      {/* ── Actions ── */}
      <Box sx={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        pt: 2, borderTop: '1px solid #F0F0F0',
      }}>
        <Button
          size="small"
          startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />}
          onClick={() => { setThresholds({ ...DEFAULT }); setSuccessMessage(null); }}
          disabled={saving}
          sx={{
            color: '#AAAAAA', fontSize: '0.78rem', textTransform: 'none',
            '&:hover': { color: '#555', backgroundColor: '#F5F5F5' },
          }}
        >
          {t('qualityGate.settings.resetButton')}
        </Button>

        <Button
          variant="contained"
          size="small"
          startIcon={
            saving
              ? <CircularProgress size={14} color="inherit" />
              : <SaveIcon sx={{ fontSize: 16 }} />
          }
          onClick={handleSave}
          disabled={saving || !isDirty}
          sx={{
            backgroundColor: GREEN,
            color: '#fff',
            fontSize: '0.82rem',
            textTransform: 'none',
            fontWeight: 600,
            px: 2.5,
            boxShadow: 'none',
            '&:hover': { backgroundColor: '#00A070', boxShadow: 'none' },
            '&.Mui-disabled': { backgroundColor: '#E8E8E8', color: '#AAAAAA' },
          }}
        >
          {saving ? t('common.loading') : t('qualityGate.settings.saveButton')}
        </Button>
      </Box>
    </Box>
  );
};

export default QualityGateSettings;
