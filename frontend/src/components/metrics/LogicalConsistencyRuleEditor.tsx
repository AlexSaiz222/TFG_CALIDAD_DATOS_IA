import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  AccountTree as RuleIcon,
} from '@mui/icons-material';

export interface LogicalRule {
  name: string;
  type: 'violation' | 'if_then';
  expression?: string;
  condition?: string;
  assertion?: string;
}

interface RuleFormState {
  name: string;
  type: 'violation' | 'if_then';
  expression: string;
  condition: string;
  assertion: string;
}

const emptyForm = (): RuleFormState => ({
  name: '',
  type: 'violation',
  expression: '',
  condition: '',
  assertion: '',
});

const formToRule = (f: RuleFormState): LogicalRule => {
  if (f.type === 'violation') {
    return { name: f.name, type: 'violation', expression: f.expression };
  }
  return { name: f.name, type: 'if_then', condition: f.condition, assertion: f.assertion };
};

const ruleToForm = (r: LogicalRule): RuleFormState => ({
  name: r.name,
  type: r.type,
  expression: r.expression ?? '',
  condition: r.condition ?? '',
  assertion: r.assertion ?? '',
});

const validateForm = (f: RuleFormState): Record<string, string> => {
  const errs: Record<string, string> = {};
  if (!f.name.trim()) errs.name = 'El nombre es obligatorio';
  if (f.type === 'violation') {
    if (!f.expression.trim()) errs.expression = 'La expresión es obligatoria';
  } else {
    if (!f.condition.trim()) errs.condition = 'La condición es obligatoria';
    if (!f.assertion.trim()) errs.assertion = 'La aserción es obligatoria';
  }
  return errs;
};

interface Props {
  rules: LogicalRule[];
  onChange: (rules: LogicalRule[]) => void;
}

const LogicalConsistencyRuleEditor: React.FC<Props> = ({ rules, onChange }) => {
  const [formOpen, setFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const openAddForm = () => {
    setEditingIndex(null);
    setForm(emptyForm());
    setFormErrors({});
    setFormOpen(true);
  };

  const openEditForm = (index: number) => {
    setEditingIndex(index);
    setForm(ruleToForm(rules[index]));
    setFormErrors({});
    setFormOpen(true);
  };

  const cancelForm = () => {
    setFormOpen(false);
    setEditingIndex(null);
    setForm(emptyForm());
    setFormErrors({});
  };

  const handleFormChange = (field: keyof RuleFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveForm = () => {
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    const rule = formToRule(form);
    if (editingIndex !== null) {
      const updated = [...rules];
      updated[editingIndex] = rule;
      onChange(updated);
    } else {
      onChange([...rules, rule]);
    }
    cancelForm();
  };

  const handleDelete = (index: number) => {
    const updated = rules.filter((_, i) => i !== index);
    onChange(updated);
    if (formOpen && editingIndex === index) cancelForm();
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
        <Typography variant="subtitle2" color="text.secondary">
          Reglas de consistencia ({rules.length})
        </Typography>
        {!formOpen && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={openAddForm}
            variant="outlined"
            sx={{ borderColor: '#00B37E', color: '#00B37E', '&:hover': { borderColor: '#00A070', backgroundColor: '#F0F9F6' } }}
          >
            Agregar regla
          </Button>
        )}
      </Box>

      {/* Rule list */}
      {rules.length === 0 && !formOpen && (
        <Box
          sx={{
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            p: 3,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          <RuleIcon sx={{ mb: 1, opacity: 0.4, fontSize: 32 }} />
          <Typography variant="body2">
            Sin reglas configuradas. Agrega una regla para evaluar consistencia lógica.
          </Typography>
        </Box>
      )}

      <Box display="flex" flexDirection="column" gap={1}>
        {rules.map((rule, index) => (
          <Card key={index} variant="outlined" sx={{ borderRadius: 1 }}>
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box flex={1} minWidth={0}>
                  <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {rule.name}
                    </Typography>
                    <Chip
                      label={rule.type === 'violation' ? 'Violación' : 'SI…ENTONCES'}
                      size="small"
                      sx={{
                        fontSize: '0.65rem',
                        height: 18,
                        backgroundColor: rule.type === 'violation' ? '#FFF3E0' : '#E8F5E9',
                        color: rule.type === 'violation' ? '#E65100' : '#2E7D32',
                      }}
                    />
                  </Box>
                  {rule.type === 'violation' ? (
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }} noWrap>
                      {rule.expression}
                    </Typography>
                  ) : (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }} noWrap>
                        <strong>SI</strong> {rule.condition}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }} noWrap>
                        <strong>ENTONCES</strong> {rule.assertion}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box display="flex" alignItems="center" ml={1}>
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => openEditForm(index)} disabled={formOpen}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <IconButton size="small" onClick={() => handleDelete(index)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Inline add/edit form */}
      <Collapse in={formOpen} unmountOnExit>
        <Card
          variant="outlined"
          sx={{ mt: rules.length > 0 ? 1.5 : 0, borderColor: '#00B37E', borderRadius: 1 }}
        >
          <CardContent sx={{ pb: '12px !important' }}>
            <Typography variant="subtitle2" gutterBottom>
              {editingIndex !== null ? 'Editar regla' : 'Nueva regla'}
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box display="flex" flexDirection="column" gap={2}>
              {/* Name */}
              <TextField
                label="Nombre de la regla"
                size="small"
                fullWidth
                value={form.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                error={!!formErrors.name}
                helperText={formErrors.name || 'Identificador legible para esta regla'}
                placeholder="Ej: precio_no_negativo"
              />

              {/* Type */}
              <FormControl size="small" fullWidth>
                <InputLabel>Tipo de regla</InputLabel>
                <Select
                  label="Tipo de regla"
                  value={form.type}
                  onChange={(e) => handleFormChange('type', e.target.value as 'violation' | 'if_then')}
                >
                  <MenuItem value="violation">
                    <Box>
                      <Typography variant="body2">Violación directa</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Expresión que selecciona filas inválidas
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="if_then">
                    <Box>
                      <Typography variant="body2">SI… ENTONCES</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Condición que implica una aserción
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
                <FormHelperText>
                  {form.type === 'violation'
                    ? 'Usa expresiones de pandas (ej: precio < 0)'
                    : 'Violación = filas donde condición es verdadera pero aserción es falsa'}
                </FormHelperText>
              </FormControl>

              {/* Violation: expression */}
              {form.type === 'violation' && (
                <TextField
                  label="Expresión"
                  size="small"
                  fullWidth
                  value={form.expression}
                  onChange={(e) => handleFormChange('expression', e.target.value)}
                  error={!!formErrors.expression}
                  helperText={formErrors.expression || 'Expresión pandas que devuelve filas inválidas'}
                  placeholder="Ej: precio < 0"
                  InputProps={{ sx: { fontFamily: 'monospace' } }}
                />
              )}

              {/* IF-THEN: condition + assertion */}
              {form.type === 'if_then' && (
                <>
                  <TextField
                    label="Condición (SI)"
                    size="small"
                    fullWidth
                    value={form.condition}
                    onChange={(e) => handleFormChange('condition', e.target.value)}
                    error={!!formErrors.condition}
                    helperText={formErrors.condition || 'Expresión que activa la regla'}
                    placeholder="Ej: estado == 'Fallecido'"
                    InputProps={{ sx: { fontFamily: 'monospace' } }}
                  />
                  <TextField
                    label="Aserción (ENTONCES)"
                    size="small"
                    fullWidth
                    value={form.assertion}
                    onChange={(e) => handleFormChange('assertion', e.target.value)}
                    error={!!formErrors.assertion}
                    helperText={formErrors.assertion || 'Lo que debe cumplirse si la condición es verdadera'}
                    placeholder="Ej: proxima_cita.isna()"
                    InputProps={{ sx: { fontFamily: 'monospace' } }}
                  />
                </>
              )}
            </Box>

            <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
              <Button size="small" startIcon={<CloseIcon />} onClick={cancelForm}>
                Cancelar
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<CheckIcon />}
                onClick={handleSaveForm}
                sx={{
                  backgroundColor: '#00B37E',
                  color: '#FFFFFF',
                  '&:hover': { backgroundColor: '#00A070' },
                }}
              >
                {editingIndex !== null ? 'Guardar cambios' : 'Añadir regla'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Collapse>
    </Box>
  );
};

export default LogicalConsistencyRuleEditor;
