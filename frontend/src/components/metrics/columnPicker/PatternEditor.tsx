import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Box, Typography, Chip, IconButton,
} from '@mui/material';
import { Close as CloseIcon, Check as CheckIcon, Clear as ClearIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { patternsAPI } from '../../../services/api';
import { ValidationPattern } from '../../../types';

interface PatternEditorProps {
  open: boolean;
  onClose: () => void;
  onSaved: (pattern: ValidationPattern) => void;
  initial?: Partial<ValidationPattern>;
}

const PatternEditor: React.FC<PatternEditorProps> = ({ open, onClose, onSaved, initial }) => {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [regex, setRegex] = useState(initial?.regex ?? '');
  const [testInput, setTestInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  let regexValid = true;
  let compiledRe: RegExp | null = null;
  try {
    if (regex) compiledRe = new RegExp(regex);
  } catch {
    regexValid = false;
  }

  const testLines = testInput.split('\n').filter(l => l.trim());

  const handleSave = async () => {
    if (!name.trim() || !regex.trim() || !regexValid) return;
    setSaving(true);
    setError('');
    try {
      const payload = { name, description, regex };
      const res: any = isEdit && initial?.id
        ? await patternsAPI.update(initial.id, payload)
        : await patternsAPI.create(payload);
      const saved: ValidationPattern = res?.data?.pattern;
      onSaved(saved);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t('patternEditor.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography fontWeight={600}>{isEdit ? t('patternEditor.titleEdit') : t('patternEditor.titleCreate')}</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} pt={1}>
          <TextField
            label={t('patternEditor.nameLabel')}
            value={name}
            onChange={e => setName(e.target.value)}
            size="small"
            fullWidth
            required
          />
          <TextField
            label={t('patternEditor.descriptionLabel')}
            value={description}
            onChange={e => setDescription(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
          />
          <TextField
            label={t('patternEditor.regexLabel')}
            value={regex}
            onChange={e => setRegex(e.target.value)}
            size="small"
            fullWidth
            required
            error={!!regex && !regexValid}
            helperText={!!regex && !regexValid ? t('patternEditor.invalidRegex') : ''}
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
          />
          <Box>
            <Typography variant="subtitle2" gutterBottom>{t('patternEditor.testTitle')}</Typography>
            <TextField
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              placeholder={t('patternEditor.testPlaceholder')}
              size="small"
              fullWidth
              multiline
              rows={3}
              InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
            />
            {compiledRe && testLines.length > 0 && (
              <Box mt={1} display="flex" flexWrap="wrap" gap={0.5}>
                {testLines.map((line, i) => {
                  const match = compiledRe!.test(line);
                  return (
                    <Chip
                      key={i}
                      label={line}
                      size="small"
                      icon={match ? <CheckIcon sx={{ fontSize: 14 }} /> : <ClearIcon sx={{ fontSize: 14 }} />}
                      sx={{
                        bgcolor: match ? '#E8F5E9' : '#FFEBEE',
                        color: match ? '#2E7D32' : '#C62828',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                      }}
                    />
                  );
                })}
              </Box>
            )}
          </Box>
          {error && <Typography variant="caption" color="error">{error}</Typography>}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">{t('patternEditor.cancel')}</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim() || !regex.trim() || !regexValid || saving}
          sx={{ bgcolor: '#00B37E', '&:hover': { bgcolor: '#00A070' } }}
        >
          {saving ? t('patternEditor.saving') : t('patternEditor.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PatternEditor;
