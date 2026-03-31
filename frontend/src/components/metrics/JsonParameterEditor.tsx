/**
 * JsonParameterEditor
 * Monaco-based JSON editor for metric parameters with validation,
 * auto-format, and per-metric schema hints.
 */
import React, { useRef, useCallback, useEffect, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import {
  Box, Typography, IconButton, Tooltip, Chip, Alert,
} from '@mui/material';
import {
  FormatAlignLeft as FormatIcon,
  ContentCopy as CopyIcon,
  Lightbulb as LightbulbIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

const GREEN = '#00B37E';

// ─────────────────────────────────────────────────────────────────────────────
// Per-metric JSON examples (derived from docs/metricas)
// ─────────────────────────────────────────────────────────────────────────────

export const METRIC_PARAMETER_EXAMPLES: Record<string, { example: Record<string, any>; description: string }> = {
  completeness: {
    example: {
      threshold: 0.95,
      columns: ['nombre', 'email', 'telefono'],
      weight: 1.0,
    },
    description: 'threshold: mínimo de completitud (0–1). columns: vacío = todas. weight: peso en Quality Score.',
  },
  uniqueness: {
    example: {
      threshold: 1.0,
      columns: ['user_id', 'transaction_id'],
      weight: 1.0,
    },
    description: 'threshold: unicidad mínima de filas (1.0 = sin duplicados). columns: columnas que deben ser únicas.',
  },
  outliers: {
    example: {
      method: 'iqr',
      factor: 1.5,
      columns: ['precio', 'edad', 'ingresos'],
      weight: 1.0,
    },
    description: 'method: "iqr" o "zscore". factor: sensibilidad (1.5 normal, 3.0 permisivo). columns: vacío = todas numéricas.',
  },
  syntactic_accuracy: {
    example: {
      auto_detect_types: true,
      threshold: 0.95,
      columns: [
        { column: 'email', expected_type: 'email' },
        { column: 'telefono', expected_type: 'phone_es' },
      ],
      weight: 1.0,
    },
    description: 'auto_detect_types: detectar formatos automáticamente. columns: reglas columna→formato. Tipos: email, phone_es, phone_intl, date_iso, date_eu, dni_es, postal_code_es, integer, decimal, url, uuid, ip_v4, credit_card.',
  },
  class_balance: {
    example: {
      auto_detect: true,
      columns: ['estado', 'categoria'],
      max_cardinality: 50,
      imbalance_threshold_high: 0.90,
      imbalance_threshold_low: 0.05,
      weight: 1.0,
    },
    description: 'auto_detect: detectar columnas categóricas. max_cardinality: máx. valores únicos para considerar categórico. imbalance_threshold_high/low: umbrales de desequilibrio.',
  },
  timeliness: {
    example: {
      auto_detect: true,
      columns: ['fecha_registro', 'fecha_actualizacion'],
      staleness_threshold_days: 30,
      weight: 1.0,
    },
    description: 'auto_detect: detectar columnas de fecha. staleness_threshold_days: días sin actualización = alerta.',
  },
  logical_consistency: {
    example: {
      rules: [
        {
          name: 'Fecha pago si pagado',
          type: 'if_then',
          condition: "estado == 'pagado'",
          assertion: 'fecha_pago == fecha_pago',
        },
        {
          name: 'Sin precios negativos',
          type: 'violation',
          expression: 'precio < 0',
        },
      ],
      weight: 1.0,
    },
    description: 'rules: lista de reglas. Tipo "if_then": condition + assertion. Tipo "violation": expression (filas que violan la regla).',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface JsonParameterEditorProps {
  value: Record<string, any>;
  onChange: (params: Record<string, any>) => void;
  onValidationChange?: (isValid: boolean) => void;
  metricName?: string;
  height?: string | number;
}

const JsonParameterEditor: React.FC<JsonParameterEditorProps> = ({
  value,
  onChange,
  onValidationChange,
  metricName,
  height = '100%',
}) => {
  const editorRef = useRef<any>(null);
  const isInternalUpdate = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Serialize current params to JSON string for the editor
  const jsonString = JSON.stringify(value, null, 2);

  // Keep a ref to the latest JSON string from the form to detect external changes
  const lastExternalJson = useRef(jsonString);

  // When value changes externally (from the form), update editor content
  useEffect(() => {
    const newJson = JSON.stringify(value, null, 2);
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (editorRef.current && newJson !== lastExternalJson.current) {
      const currentValue = editorRef.current.getValue();
      // Only update if editor content is valid and differs
      if (currentValue !== newJson) {
        lastExternalJson.current = newJson;
        editorRef.current.setValue(newJson);
      }
    }
  }, [value]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleEditorChange = useCallback((newValue: string | undefined) => {
    if (!newValue) return;
    try {
      const parsed = JSON.parse(newValue);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        setError('El JSON debe ser un objeto { }');
        onValidationChange?.(false);
        return;
      }
      
      // Validate threshold values (must be 0-1)
      if ('threshold' in parsed) {
        const t = parsed.threshold;
        if (typeof t === 'number' && (t < 0 || t > 1)) {
          setError('threshold debe estar entre 0 y 1');
          onValidationChange?.(false);
          return;
        }
      }
      
      // Validate imbalance thresholds
      if ('imbalance_threshold_high' in parsed) {
        const t = parsed.imbalance_threshold_high;
        if (typeof t === 'number' && (t < 0 || t > 1)) {
          setError('imbalance_threshold_high debe estar entre 0 y 1');
          onValidationChange?.(false);
          return;
        }
      }
      if ('imbalance_threshold_low' in parsed) {
        const t = parsed.imbalance_threshold_low;
        if (typeof t === 'number' && (t < 0 || t > 1)) {
          setError('imbalance_threshold_low debe estar entre 0 y 1');
          onValidationChange?.(false);
          return;
        }
      }
      
      // Validate factor (outliers)
      if ('factor' in parsed) {
        const f = parsed.factor;
        if (typeof f === 'number' && (f < 0 || f > 10)) {
          setError('factor debe estar entre 0 y 10');
          onValidationChange?.(false);
          return;
        }
      }
      
      // Validate weight
      if ('weight' in parsed) {
        const w = parsed.weight;
        if (typeof w === 'number' && (w < 0 || w > 2)) {
          setError('weight debe estar entre 0 y 2');
          onValidationChange?.(false);
          return;
        }
      }
      
      setError(null);
      onValidationChange?.(true);
      isInternalUpdate.current = true;
      lastExternalJson.current = JSON.stringify(parsed, null, 2);
      onChange(parsed);
    } catch (e: any) {
      const msg = e.message?.replace(/^JSON\.parse: /, '') || 'JSON inválido';
      setError(msg);
      onValidationChange?.(false);
    }
  }, [onChange, onValidationChange]);

  const handleFormat = () => {
    if (editorRef.current) {
      try {
        const current = editorRef.current.getValue();
        const parsed = JSON.parse(current);
        const formatted = JSON.stringify(parsed, null, 2);
        editorRef.current.setValue(formatted);
      } catch {
        // Can't format invalid JSON
      }
    }
  };

  const handleCopy = async () => {
    if (editorRef.current) {
      const text = editorRef.current.getValue();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleLoadExample = () => {
    if (!metricName || !METRIC_PARAMETER_EXAMPLES[metricName]) return;
    const example = METRIC_PARAMETER_EXAMPLES[metricName].example;
    const formatted = JSON.stringify(example, null, 2);
    if (editorRef.current) {
      editorRef.current.setValue(formatted);
    }
    setError(null);
    onValidationChange?.(true);
    onChange(example);
  };

  const hint = metricName ? METRIC_PARAMETER_EXAMPLES[metricName] : null;

  return (
    // @ts-ignore — TS2590: MUI Box type inference too complex when lucide-react types are in scope
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: '#FAFAFA', flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mr: 1 }}>
            JSON
          </Typography>
          <Chip label="parameters" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#E8F5E9', color: GREEN }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          {hint && (
            <Tooltip title="Cargar ejemplo para esta métrica" arrow>
              <IconButton size="small" onClick={handleLoadExample} sx={{ fontSize: 12 }}>
                <LightbulbIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Formatear JSON" arrow>
            <IconButton size="small" onClick={handleFormat}>
              <FormatIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={copied ? '¡Copiado!' : 'Copiar al portapapeles'} arrow>
            <IconButton size="small" onClick={handleCopy}>
              {copied ? <CheckIcon fontSize="small" sx={{ color: GREEN }} /> : <CopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Hint bar */}
      {hint && (
        <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#F5F5F5', borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4, display: 'block' }}>
            {hint.description}
          </Typography>
        </Box>
      )}

      {/* Monaco Editor */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Editor
          height={height}
          language="json"
          theme="vs"
          value={jsonString}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            renderWhitespace: 'none',
            folding: true,
            bracketPairColorization: { enabled: true },
            formatOnPaste: true,
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
            padding: { top: 8, bottom: 8 },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
          }}
        />
      </Box>

      {/* Error bar */}
      {error && (
        <Alert severity="error" sx={{ borderRadius: 0, py: 0.25, px: 1.5, fontSize: '0.75rem', flexShrink: 0 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default JsonParameterEditor;
