/**
 * SmartMetricConfigDialog
 * Metric-specific configuration dialogs with user-friendly UX for all 7 metrics.
 * Replaces the generic parameter dialog with guided, plain-language controls.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Slider, Chip, Divider,
  FormControlLabel, Switch, Radio, RadioGroup, FormControl,
  TextField, IconButton, Tooltip, Collapse, Alert,
  ToggleButton, ToggleButtonGroup, Paper, List, ListItem,
  ListItemText, ListItemSecondaryAction, useMediaQuery, useTheme, Tab, Tabs,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
  AutoFixHigh as AutoIcon,
  AddCircleOutline as AddRuleIcon,
  Bolt as BoltIcon,
  Code as CodeIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import LogicalConsistencyRuleEditor, { LogicalRule } from './LogicalConsistencyRuleEditor';
import { getIconMeta } from './MetricIcon';
import JsonParameterEditor from './JsonParameterEditor';

const GREEN = '#00B37E';
const GREEN_LIGHT = '#F0F9F6';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

interface SectionBannerProps {
  metricName: string;
  title: string;
  description: string;
  autoDetect?: boolean;
}
const SectionBanner: React.FC<SectionBannerProps> = ({ metricName, title, description, autoDetect }) => {
  const meta = getIconMeta(metricName);
  const IconComp = meta.icon;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, borderRadius: 10,
          backgroundColor: meta.bg, flexShrink: 0,
        }}>
          <IconComp size={20} color={meta.color} strokeWidth={1.8} />
        </div>
        <Typography variant="h6" fontWeight={600}>{title}</Typography>
      </div>
      <Typography variant="body2" color="text.secondary" sx={{ pl: 0.5 }}>{description}</Typography>
      {autoDetect && (
        <Box display="flex" alignItems="center" gap={0.5} mt={1}
          sx={{ px: 1.5, py: 0.5, bgcolor: GREEN_LIGHT, borderRadius: 1, width: 'fit-content' }}>
          <AutoIcon sx={{ fontSize: 16, color: GREEN }} />
          <Typography variant="caption" fontWeight={500} color={GREEN}>
            Funciona automáticamente sin configuración adicional
          </Typography>
        </Box>
      )}
    </div>
  );
};

interface ThresholdSliderProps {
  label: string;
  value: number;          // 0–1
  onChange: (v: number) => void;
  presets?: number[];
  helpText?: string;
  invert?: boolean;       // true = lower is better (outlier direction)
}
const ThresholdSlider: React.FC<ThresholdSliderProps> = ({
  label, value, onChange, presets = [0.80, 0.90, 0.95, 0.99], helpText, invert,
}) => {
  const pct = Math.round(value * 100);
  const color = invert
    ? (value <= 0.05 ? GREEN : value <= 0.10 ? '#FFB800' : '#E5484D')
    : (value >= 0.95 ? GREEN : value >= 0.80 ? '#FFB800' : '#E5484D');

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Typography variant="subtitle2">{label}</Typography>
        <Typography variant="h6" fontWeight={700} color={color}>{pct}%</Typography>
      </div>
      <Slider
        value={value}
        onChange={(_, v) => onChange(v as number)}
        min={0.5} max={1.0} step={0.01}
        sx={{ color: GREEN }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {presets.map(p => (
          <Chip
            key={p}
            label={`${Math.round(p * 100)}%`}
            size="small"
            onClick={() => onChange(p)}
            variant={value === p ? 'filled' : 'outlined'}
            sx={value === p
              ? { bgcolor: GREEN, color: '#fff', fontWeight: 600 }
              : { cursor: 'pointer' }}
          />
        ))}
      </div>
      {helpText && <Typography variant="caption" color="text.secondary" mt={0.5} display="block">{helpText}</Typography>}
    </div>
  );
};

interface AdvancedSectionProps { children: React.ReactNode; }
const AdvancedSection: React.FC<AdvancedSectionProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  return (
    // @ts-ignore — TS2590: MUI Box type inference too complex when lucide-react types are in scope
    <Box mt={2}>
      <Divider />
      <Box mt={1.5}>
        <Button
          size="small"
          endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setOpen(!open)}
          sx={{ color: 'text.secondary', textTransform: 'none', px: 0 }}
        >
          Opciones avanzadas
        </Button>
        <Collapse in={open}>
          <Box mt={1.5}>{children}</Box>
        </Collapse>
      </Box>
    </Box>
  );
};

// Simple tag-input for column lists
interface ColumnTagInputProps {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  helpText?: string;
}
const ColumnTagInput: React.FC<ColumnTagInputProps> = ({ label, value, onChange, helpText }) => {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setInput('');
  };
  
  // Ensure value is always an array of strings (filter out any objects that might come from JSON sync)
  const safeValue = (value || []).filter((v: any) => typeof v === 'string') as string[];
  
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>{label}</Typography>
      <Box display="flex" gap={1} mb={1}>
        <TextField
          size="small" fullWidth
          value={input}
          placeholder="Nombre de columna…"
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <Button size="small" variant="outlined" onClick={add}
          sx={{ borderColor: GREEN, color: GREEN, minWidth: 48 }}>+</Button>
      </Box>
      <Box display="flex" flexWrap="wrap" gap={0.5}>
        {safeValue.map(col => (
          <Chip key={col} label={col} size="small" onDelete={() => onChange(safeValue.filter(c => c !== col))} />
        ))}
        {safeValue.length === 0 && (
          <Typography variant="caption" color="text.disabled">
            {helpText || 'Vacío = se comprueban todas las columnas automáticamente'}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Metric-specific config panels
// ─────────────────────────────────────────────────────────────────────────────

// ---------- COMPLETENESS ----------
const CompletenessConfig: React.FC<{ params: any; onChange: (p: any) => void }> = ({ params, onChange }) => {
  const threshold = params.threshold ?? 0.95;
  const columns: string[] = params.columns ?? [];
  
  React.useEffect(() => {
    const needsUpdate = params.threshold === undefined || params.columns === undefined;
    if (needsUpdate) {
      onChange({ threshold: params.threshold ?? 0.95, columns: params.columns ?? [], ...params });
    }
  }, []);
  
  return (
    <Box>
      <SectionBanner
        metricName="completeness"
        title="Completitud"
        description="Detecta columnas con valores nulos o faltantes. Analiza todas las columnas del dataset y alerta cuando la proporción de datos faltantes supera el umbral configurado."
        autoDetect
      />
      <ThresholdSlider
        label="Mínimo de valores presentes requerido"
        value={threshold}
        onChange={v => onChange({ ...params, threshold: v })}
        presets={[0.80, 0.90, 0.95, 0.99]}
        helpText="Se emitirá una alerta si la completitud global cae por debajo de este umbral."
      />
      <AdvancedSection>
        <ColumnTagInput
          label="Revisar solo estas columnas (opcional)"
          value={columns}
          onChange={v => onChange({ ...params, columns: v })}
        />
      </AdvancedSection>
    </Box>
  );
};

// ---------- UNIQUENESS ----------
const UniquenessConfig: React.FC<{ params: any; onChange: (p: any) => void }> = ({ params, onChange }) => {
  const threshold = params.threshold ?? 1.0;
  const columns: string[] = params.columns ?? [];
  
  React.useEffect(() => {
    const needsUpdate = params.threshold === undefined || params.columns === undefined;
    if (needsUpdate) {
      onChange({ threshold: params.threshold ?? 1.0, columns: params.columns ?? [], ...params });
    }
  }, []);
  
  return (
    <Box>
      <SectionBanner
        metricName="uniqueness"
        title="Unicidad"
        description="Detecta filas completamente duplicadas en el dataset. También identifica columnas con poca variabilidad (ej: una columna que siempre tiene el mismo valor)."
        autoDetect
      />
      <ThresholdSlider
        label="Proporción mínima de unicidad requerida"
        value={threshold}
        onChange={v => onChange({ ...params, threshold: v })}
        presets={[0.90, 0.95, 0.99, 1.0]}
        helpText="1.0 = no se permite ningún duplicado. 0.95 = permite hasta un 5% de duplicados."
      />
      <AdvancedSection>
        <ColumnTagInput
          label="Columnas que deben ser completamente únicas (ej: IDs)"
          value={columns}
          onChange={v => onChange({ ...params, columns: v })}
          helpText="Vacío = se aplica la detección global al dataset completo"
        />
      </AdvancedSection>
    </Box>
  );
};

// ---------- OUTLIERS ----------
const SENSITIVITY_PRESETS = [
  { label: 'Permisivo', factor: 3.0, hint: 'Solo detecta outliers extremos' },
  { label: 'Normal', factor: 1.5, hint: 'Balance recomendado para la mayoría de datasets' },
  { label: 'Estricto', factor: 1.0, hint: 'Detecta valores moderadamente alejados' },
  { label: 'Muy estricto', factor: 0.5, hint: 'Detecta cualquier desviación notable' },
];
const OutliersConfig: React.FC<{ params: any; onChange: (p: any) => void }> = ({ params, onChange }) => {
  const method = params.method ?? 'iqr';
  const factor = params.factor ?? 1.5;
  const columns: string[] = params.columns ?? [];
  const activeSensitivity = SENSITIVITY_PRESETS.find(p => p.factor === factor);
  
  React.useEffect(() => {
    const needsUpdate = params.method === undefined || params.factor === undefined || params.columns === undefined;
    if (needsUpdate) {
      onChange({ method: params.method ?? 'iqr', factor: params.factor ?? 1.5, columns: params.columns ?? [], ...params });
    }
  }, []);
  
  return (
    <Box>
      <SectionBanner
        metricName="outliers"
        title="Detección de valores atípicos"
        description="Detecta valores que se alejan anormalmente del resto en columnas numéricas. No requiere configuración previa: analiza todas las columnas numéricas automáticamente."
        autoDetect
      />

      <Typography variant="subtitle2" gutterBottom>Método de detección</Typography>
      <RadioGroup value={method} onChange={e => onChange({ ...params, method: e.target.value })}>
        <Paper variant="outlined" sx={{ p: 1.5, mb: 1, cursor: 'pointer', borderColor: method === 'iqr' ? GREEN : 'divider' }}>
          <FormControlLabel value="iqr" control={<Radio size="small" sx={{ color: GREEN, '&.Mui-checked': { color: GREEN } }} />}
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>IQR — Rango intercuartílico <Chip label="Recomendado" size="small" sx={{ ml: 1, bgcolor: GREEN_LIGHT, color: GREEN, height: 18, fontSize: '0.65rem' }} /></Typography>
                <Typography variant="caption" color="text.secondary">Funciona bien con datos asimétricos o con distribuciones no normales. Ideal para la mayoría de casos.</Typography>
              </Box>
            }
          />
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, cursor: 'pointer', borderColor: method === 'zscore' ? GREEN : 'divider' }}>
          <FormControlLabel value="zscore" control={<Radio size="small" sx={{ color: GREEN, '&.Mui-checked': { color: GREEN } }} />}
            label={
              <Box>
                <Typography variant="body2" fontWeight={600}>Z-Score — Desviación estándar</Typography>
                <Typography variant="caption" color="text.secondary">Adecuado cuando los datos siguen una distribución normal (en forma de campana).</Typography>
              </Box>
            }
          />
        </Paper>
      </RadioGroup>

      <Box mt={2.5} mb={1}>
        <Typography variant="subtitle2" gutterBottom>Sensibilidad de detección</Typography>
        <Box display="flex" gap={1} flexWrap="wrap">
          {SENSITIVITY_PRESETS.map(p => (
            <Tooltip key={p.factor} title={p.hint} arrow>
              <Chip
                label={p.label}
                onClick={() => onChange({ ...params, factor: p.factor })}
                variant={factor === p.factor ? 'filled' : 'outlined'}
                sx={factor === p.factor
                  ? { bgcolor: GREEN, color: '#fff', fontWeight: 600, cursor: 'pointer' }
                  : { cursor: 'pointer' }}
              />
            </Tooltip>
          ))}
        </Box>
        {activeSensitivity && (
          <Typography variant="caption" color="text.secondary" mt={0.5} display="block">
            {activeSensitivity.hint}
          </Typography>
        )}
      </Box>

      <AdvancedSection>
        <ColumnTagInput
          label="Analizar solo estas columnas numéricas (opcional)"
          value={columns}
          onChange={v => onChange({ ...params, columns: v })}
        />
      </AdvancedSection>
    </Box>
  );
};

// ---------- SYNTACTIC ACCURACY ----------
const FORMAT_OPTIONS = [
  { value: 'email', label: 'Correo electrónico' },
  { value: 'phone_es', label: 'Teléfono (España)' },
  { value: 'phone_intl', label: 'Teléfono internacional' },
  { value: 'date_iso', label: 'Fecha ISO (YYYY-MM-DD)' },
  { value: 'date_eu', label: 'Fecha europea (DD/MM/YYYY)' },
  { value: 'dni_es', label: 'DNI / NIE (España)' },
  { value: 'postal_code_es', label: 'Código postal (España)' },
  { value: 'integer', label: 'Número entero' },
  { value: 'decimal', label: 'Número decimal' },
  { value: 'url', label: 'URL' },
  { value: 'uuid', label: 'UUID' },
  { value: 'ip_v4', label: 'Dirección IP (v4)' },
  { value: 'credit_card', label: 'Tarjeta de crédito' },
];
const SyntacticAccuracyConfig: React.FC<{ params: any; onChange: (p: any) => void }> = ({ params, onChange }) => {
  const autoDetect = params.auto_detect_types !== false;
  const threshold = params.threshold ?? 0.95;
  const columnRules: Array<{ column: string; expected_type: string }> = params.columns ?? [];
  const [newCol, setNewCol] = useState('');
  const [newType, setNewType] = useState('email');
  
  React.useEffect(() => {
    const needsUpdate = params.auto_detect_types === undefined || params.threshold === undefined || params.columns === undefined;
    if (needsUpdate) {
      onChange({ auto_detect_types: params.auto_detect_types !== false, threshold: params.threshold ?? 0.95, columns: params.columns ?? [], ...params });
    }
  }, []);

  const addRule = () => {
    if (!newCol.trim()) return;
    onChange({ ...params, columns: [...columnRules, { column: newCol.trim(), expected_type: newType }] });
    setNewCol('');
  };
  const removeRule = (i: number) => {
    onChange({ ...params, columns: columnRules.filter((_, idx) => idx !== i) });
  };

  return (
    <Box>
      <SectionBanner
        metricName="syntactic_accuracy"
        title="Precisión sintáctica"
        description="Verifica que los valores de las columnas cumplan un formato esperado: emails válidos, números de teléfono, fechas, DNIs, códigos postales, etc."
        autoDetect
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderColor: autoDetect ? GREEN : 'divider', bgcolor: autoDetect ? GREEN_LIGHT : 'transparent' }}>
        <FormControlLabel
          control={
            <Switch
              checked={autoDetect}
              onChange={e => onChange({ ...params, auto_detect_types: e.target.checked })}
              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: GREEN }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: GREEN } }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={600}>Detectar formatos automáticamente</Typography>
              <Typography variant="caption" color="text.secondary">
                Analiza el contenido de cada columna e identifica automáticamente emails, teléfonos, fechas, IDs y más.
              </Typography>
            </Box>
          }
        />
      </Paper>

      <ThresholdSlider
        label="Conformidad mínima requerida por columna"
        value={threshold}
        onChange={v => onChange({ ...params, threshold: v })}
        presets={[0.80, 0.90, 0.95, 1.0]}
        helpText="Si menos del X% de los valores de una columna cumplen el formato esperado, se genera una alerta."
      />

      <AdvancedSection>
        <Typography variant="subtitle2" gutterBottom>Reglas de formato adicionales (opcional)</Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
          Especifica el formato esperado para columnas concretas, complementando la detección automática.
        </Typography>
        <Box display="flex" gap={1} mb={1.5} alignItems="flex-start">
          <TextField size="small" label="Columna" value={newCol}
            onChange={e => setNewCol(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRule()}
            sx={{ flex: 1 }} />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <TextField select size="small" label="Formato esperado" value={newType}
              onChange={e => setNewType(e.target.value)}
              SelectProps={{ native: true }}>
              {FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </TextField>
          </FormControl>
          <Button size="small" variant="outlined" onClick={addRule}
            sx={{ borderColor: GREEN, color: GREEN, whiteSpace: 'nowrap', height: 40 }}>
            Añadir
          </Button>
        </Box>
        {columnRules.length > 0 && (
          <List dense disablePadding>
            {columnRules.map((r, i) => (
              <ListItem key={i} disableGutters sx={{ py: 0.5 }}>
                <ListItemText
                  primary={<Typography variant="body2"><strong>{r.column}</strong> → {FORMAT_OPTIONS.find(o => o.value === r.expected_type)?.label ?? r.expected_type}</Typography>}
                />
                <ListItemSecondaryAction>
                  <IconButton size="small" edge="end" onClick={() => removeRule(i)}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </AdvancedSection>
    </Box>
  );
};

// ---------- CLASS BALANCE ----------
const ClassBalanceConfig: React.FC<{ params: any; onChange: (p: any) => void }> = ({ params, onChange }) => {
  const autoDetect = params.auto_detect !== false;
  const thresholdHigh = params.imbalance_threshold_high ?? 0.90;
  const thresholdLow = params.imbalance_threshold_low ?? 0.05;
  const columns: string[] = params.columns ?? [];
  
  React.useEffect(() => {
    const needsUpdate = 
      params.auto_detect === undefined ||
      params.imbalance_threshold_high === undefined ||
      params.imbalance_threshold_low === undefined ||
      params.max_cardinality === undefined ||
      params.columns === undefined;
    
    if (needsUpdate) {
      onChange({
        auto_detect: params.auto_detect !== false,
        imbalance_threshold_high: params.imbalance_threshold_high ?? 0.90,
        imbalance_threshold_low: params.imbalance_threshold_low ?? 0.05,
        max_cardinality: params.max_cardinality ?? 50,
        columns: params.columns ?? [],
        ...params,
      });
    }
  }, []);
  
  return (
    <Box>
      <SectionBanner
        metricName="class_balance"
        title="Equilibrio de clases"
        description="Detecta cuando una categoría domina los datos de forma desproporcionada. Por ejemplo: un campo 'Estado' donde el 98% de los registros son 'Activo' puede indicar un problema de calidad."
        autoDetect
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderColor: autoDetect ? GREEN : 'divider', bgcolor: autoDetect ? GREEN_LIGHT : 'transparent' }}>
        <FormControlLabel
          control={
            <Switch
              checked={autoDetect}
              onChange={e => onChange({ ...params, auto_detect: e.target.checked })}
              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: GREEN }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: GREEN } }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={600}>Detectar columnas categóricas automáticamente</Typography>
              <Typography variant="caption" color="text.secondary">
                Analiza todas las columnas con pocos valores únicos (textos, booleanos, códigos).
              </Typography>
            </Box>
          }
        />
      </Paper>

      <ThresholdSlider
        label="Alerta si una clase supera el % de los datos"
        value={thresholdHigh}
        onChange={v => onChange({ ...params, imbalance_threshold_high: v })}
        presets={[0.70, 0.80, 0.90, 0.95]}
        helpText="Una clase que representa más del X% del total se considera dominante."
      />
      <ThresholdSlider
        label="Alerta si una clase representa menos del % de los datos"
        value={thresholdLow}
        onChange={v => onChange({ ...params, imbalance_threshold_low: v })}
        presets={[0.01, 0.05, 0.10, 0.20]}
        helpText="Una clase con presencia inferior al X% se considera infrarrepresentada."
      />

      <AdvancedSection>
        <Box mb={2}>
          <Typography variant="subtitle2" gutterBottom>Máximo de valores únicos para considerar categórico</Typography>
          <ToggleButtonGroup exclusive size="small"
            value={String(params.max_cardinality ?? 50)}
            onChange={(_, v) => { if (v) onChange({ ...params, max_cardinality: Number(v) }); }}
            sx={{ flexWrap: 'wrap' }}>
            {[10, 20, 50, 100].map(n => (
              <ToggleButton key={n} value={String(n)} sx={{ fontSize: '0.8rem', '&.Mui-selected': { bgcolor: GREEN_LIGHT, color: GREEN, fontWeight: 600 } }}>
                {n} valores
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        <ColumnTagInput
          label="Analizar solo estas columnas (opcional)"
          value={columns}
          onChange={v => onChange({ ...params, columns: v })}
        />
      </AdvancedSection>
    </Box>
  );
};

// ---------- TIMELINESS ----------
const STALENESS_PRESETS = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '1 año', days: 365 },
];
const TimelinessConfig: React.FC<{ params: any; onChange: (p: any) => void }> = ({ params, onChange }) => {
  const autoDetect = params.auto_detect !== false;
  const staleness = params.staleness_threshold_days ?? 30;
  const columns: string[] = params.columns ?? [];
  const isCustom = !STALENESS_PRESETS.some(p => p.days === staleness);
  
  // Ensure all default parameters are set (fix for default values not appearing in JSON)
  React.useEffect(() => {
    const needsUpdate = 
      params.staleness_threshold_days === undefined ||
      params.auto_detect === undefined ||
      params.columns === undefined;
    
    if (needsUpdate) {
      onChange({
        auto_detect: params.auto_detect !== false,
        columns: params.columns ?? [],
        staleness_threshold_days: params.staleness_threshold_days ?? 30,
        ...params,
      });
    }
  }, []);
  return (
    <Box>
      <SectionBanner
        metricName="timeliness"
        title="Actualidad de datos"
        description="Detecta si las columnas de fecha contienen datos desactualizados. Por ejemplo: si la última fecha registrada es más antigua de lo esperado, puede indicar que los datos no se están actualizando correctamente."
        autoDetect
      />

      <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderColor: autoDetect ? GREEN : 'divider', bgcolor: autoDetect ? GREEN_LIGHT : 'transparent' }}>
        <FormControlLabel
          control={
            <Switch checked={autoDetect}
              onChange={e => onChange({ ...params, auto_detect: e.target.checked })}
              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: GREEN }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: GREEN } }}
            />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={600}>Detectar columnas de fecha automáticamente</Typography>
              <Typography variant="caption" color="text.secondary">
                Identifica columnas con fechas (timestamp, date, datetime) sin necesidad de indicarlas manualmente.
              </Typography>
            </Box>
          }
        />
      </Paper>

      <Typography variant="subtitle2" gutterBottom>Considerar datos desactualizados después de</Typography>
      <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
        {STALENESS_PRESETS.map(p => (
          <Chip
            key={p.days} label={p.label}
            onClick={() => onChange({ ...params, staleness_threshold_days: p.days })}
            variant={staleness === p.days ? 'filled' : 'outlined'}
            sx={staleness === p.days
              ? { bgcolor: GREEN, color: '#fff', fontWeight: 600, cursor: 'pointer' }
              : { cursor: 'pointer' }}
          />
        ))}
        <Chip
          label="Personalizado"
          variant={isCustom ? 'filled' : 'outlined'}
          sx={isCustom ? { bgcolor: GREEN, color: '#fff', fontWeight: 600 } : {}}
        />
      </Box>
      {isCustom && (
        <Box display="flex" alignItems="center" gap={1} mt={1}>
          <TextField
            size="small" type="number" label="Días"
            value={staleness}
            onChange={e => onChange({ ...params, staleness_threshold_days: Math.max(1, parseInt(e.target.value) || 30) })}
            sx={{ width: 120 }}
            inputProps={{ min: 1 }}
          />
          <Typography variant="body2" color="text.secondary">días sin actualización = alerta</Typography>
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" mt={1} display="block">
        Si el valor más reciente de una columna de fecha tiene más de este tiempo, se generará una alerta.
      </Typography>

      <AdvancedSection>
        <ColumnTagInput
          label="Revisar solo estas columnas de fecha (opcional)"
          value={columns}
          onChange={v => onChange({ ...params, columns: v })}
          helpText="Vacío = se detectan y comprueban todas las columnas de fecha automáticamente"
        />
      </AdvancedSection>
    </Box>
  );
};

// ---------- LOGICAL CONSISTENCY ----------
const RULE_TEMPLATES = [
  {
    category: 'Valores',
    rules: [
      { name: 'Sin valores negativos', type: 'violation' as const, expression: 'mi_columna < 0', hint: 'Detecta valores menores que cero. Reemplaza "mi_columna" con el nombre de tu columna.' },
      { name: 'Campo obligatorio', type: 'violation' as const, expression: 'mi_columna != mi_columna', hint: 'Detecta registros donde el campo está vacío (NaN != NaN es true). Reemplaza "mi_columna" con el nombre de tu columna.' },
      { name: 'Rango de valores', type: 'violation' as const, expression: 'mi_columna < 0 or mi_columna > 1000', hint: 'Detecta valores fuera de un rango esperado. Ajusta los límites y el nombre de la columna.' },
    ],
  },
  {
    category: 'Fechas',
    rules: [
      { name: 'Fecha fin posterior a inicio', type: 'violation' as const, expression: 'fecha_fin < fecha_inicio', hint: 'La fecha de fin debe ser posterior a la de inicio.' },
    ],
  },
  {
    category: 'Reglas SI…ENTONCES',
    rules: [
      { name: 'Si activo, campo requerido', type: 'if_then' as const, condition: 'estado == "activo"', assertion: 'campo_requerido == campo_requerido', hint: 'Si el estado es "activo", el campo indicado debe estar relleno (campo == campo es false para NaN).' },
      { name: 'Si cantidad > 0, precio > 0', type: 'if_then' as const, condition: 'cantidad > 0', assertion: 'precio > 0', hint: 'Si hay una cantidad, debe existir un precio.' },
      { name: 'Si pagado, importe positivo', type: 'if_then' as const, condition: 'estado == "pagado"', assertion: 'importe > 0', hint: 'Si el estado es "pagado", el importe debe ser mayor que cero.' },
    ],
  },
];

const LogicalConsistencyConfig: React.FC<{ params: any; onChange: (p: any) => void }> = ({ params, onChange }) => {
  const rules: LogicalRule[] = params.rules ?? [];
  const [templateOpen, setTemplateOpen] = useState(false);

  const addTemplateRule = (template: typeof RULE_TEMPLATES[0]['rules'][0]) => {
    const newRule: LogicalRule = template.type === 'violation'
      ? { name: template.name, type: 'violation', expression: template.expression }
      : { name: template.name, type: 'if_then', condition: (template as any).condition, assertion: (template as any).assertion };
    onChange({ ...params, rules: [...rules, newRule] });
  };

  return (
    <Box>
      <SectionBanner
        metricName="logical_consistency"
        title="Consistencia lógica"
        description="Verifica que los datos cumplan reglas de negocio definidas por ti. Puedes detectar contradicciones como &quot;fecha de fin antes que fecha de inicio&quot;, &quot;campo obligatorio vacío si está activo&quot;, o cualquier condición específica de tu dominio."
      />

      {/* Rule templates (SonarQube-style) */}
      <Box mb={2}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <BoltIcon sx={{ fontSize: 18, color: '#FFB800' }} />
          <Typography variant="subtitle2">Plantillas de reglas rápidas</Typography>
          <Tooltip title="Añade reglas predefinidas con un clic y personalízalas a continuación" arrow>
            <InfoIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'help' }} />
          </Tooltip>
        </Box>

        {RULE_TEMPLATES.map(group => (
          <Box key={group.category} mb={1.5}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.5}>
              {group.category}
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={0.75}>
              {group.rules.map(rule => (
                <Tooltip key={rule.name} title={rule.hint} arrow placement="top">
                  <Chip
                    icon={<AddRuleIcon />}
                    label={rule.name}
                    size="small"
                    onClick={() => addTemplateRule(rule)}
                    variant="outlined"
                    sx={{ cursor: 'pointer', '&:hover': { borderColor: GREEN, color: GREEN, bgcolor: GREEN_LIGHT } }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>
        ))}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Rule editor */}
      <Typography variant="subtitle2" gutterBottom>
        Reglas configuradas
        {rules.length > 0 && (
          <Chip label={rules.length} size="small" sx={{ ml: 1, height: 18, fontSize: '0.7rem', bgcolor: GREEN_LIGHT, color: GREEN }} />
        )}
      </Typography>

      {rules.length === 0 && (
        <Alert severity="info" sx={{ mb: 2, fontSize: '0.85rem' }}>
          Aún no hay reglas. Usa las plantillas de arriba para añadir reglas rápidamente, o crea una personalizada con "Agregar regla".
        </Alert>
      )}

      <LogicalConsistencyRuleEditor
        rules={rules}
        onChange={updatedRules => onChange({ ...params, rules: updatedRules })}
      />
    </Box>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main dialog
// ─────────────────────────────────────────────────────────────────────────────

interface SmartMetricConfigDialogProps {
  open: boolean;
  onClose: () => void;
  metric: any | null;
  onSave: (updatedMetric: any) => void;
}

const SmartMetricConfigDialog: React.FC<SmartMetricConfigDialogProps> = ({
  open, onClose, metric, onSave,
}) => {
  const [params, setParams] = useState<Record<string, any>>({});
  const [jsonValid, setJsonValid] = useState(true);
  const [mobileTab, setMobileTab] = useState(0); // 0 = visual, 1 = JSON
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    if (metric) {
      setParams({ ...(metric.parameters ?? {}) });
      setJsonValid(true);
      setMobileTab(0);
    }
  }, [metric]);

  const handleJsonValidation = useCallback((isValid: boolean) => {
    setJsonValid(isValid);
  }, []);

  if (!metric) return null;

  const handleSave = () => {
    onSave({ ...metric, parameters: params });
  };

  const renderContent = () => {
    switch (metric.name) {
      case 'completeness':
        return <CompletenessConfig params={params} onChange={setParams} />;
      case 'uniqueness':
        return <UniquenessConfig params={params} onChange={setParams} />;
      case 'outliers':
        return <OutliersConfig params={params} onChange={setParams} />;
      case 'syntactic_accuracy':
        return <SyntacticAccuracyConfig params={params} onChange={setParams} />;
      case 'class_balance':
        return <ClassBalanceConfig params={params} onChange={setParams} />;
      case 'timeliness':
        return <TimelinessConfig params={params} onChange={setParams} />;
      case 'logical_consistency':
        return <LogicalConsistencyConfig params={params} onChange={setParams} />;
      default:
        return (
          <Alert severity="info">
            Esta métrica no requiere configuración adicional.
          </Alert>
        );
    }
  };

  const jsonEditor = (
    <JsonParameterEditor
      value={params}
      onChange={setParams}
      onValidationChange={handleJsonValidation}
      metricName={metric.name}
      height="100%"
    />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { borderRadius: 2, height: isSmall ? '85vh' : '80vh', maxHeight: '85vh' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, flexShrink: 0 }}>
        <Typography variant="h6" fontWeight={600}>Configurar métrica</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!jsonValid && (
            <Chip
              label="JSON inválido"
              size="small"
              color="error"
              variant="outlined"
              sx={{ height: 24, fontSize: '0.7rem' }}
            />
          )}
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>
      <Divider />

      {/* Mobile: tabs to switch between visual and JSON */}
      {isSmall && (
        <Tabs
          value={mobileTab}
          onChange={(_, v) => setMobileTab(v)}
          sx={{
            minHeight: 40, flexShrink: 0,
            '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontSize: '0.85rem' },
            '& .Mui-selected': { color: GREEN },
            '& .MuiTabs-indicator': { bgcolor: GREEN },
          }}
        >
          <Tab icon={<TuneIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Visual" />
          <Tab icon={<CodeIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="JSON" />
        </Tabs>
      )}

      {/* Content area */}
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden', flex: 1, minHeight: 0 }}>
        {isSmall ? (
          // Mobile: one panel at a time
          mobileTab === 0 ? (
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
              {renderContent()}
            </Box>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {jsonEditor}
            </Box>
          )
        ) : (
          // Desktop: split-view
          <>
            {/* Left panel — visual form */}
            <Box sx={{
              flex: '0 0 70%', maxWidth: '70%', overflow: 'auto', p: 3,
              borderRight: '1px solid', borderColor: 'divider',
            }}>
              {renderContent()}
            </Box>
            {/* Right panel — JSON editor */}
            <Box sx={{
              flex: '0 0 30%', maxWidth: '30%', display: 'flex', flexDirection: 'column',
              minHeight: 0, bgcolor: '#FAFAFA',
            }}>
              {jsonEditor}
            </Box>
          </>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 3, py: 2, flexShrink: 0 }}>
        <Button onClick={onClose} color="inherit">Cancelar</Button>
        <Button onClick={handleSave} variant="contained" disabled={!jsonValid}
          sx={{ bgcolor: GREEN, color: '#FFFFFF', '&:hover': { bgcolor: '#00A070' }, '&.Mui-disabled': { bgcolor: '#E0E0E0' } }}>
          Guardar configuración
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SmartMetricConfigDialog;
