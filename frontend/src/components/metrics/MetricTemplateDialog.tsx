import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  IconButton,
  Divider,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { MetricConfig } from '../../types';

interface MetricTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  metrics: MetricConfig[];
  mode: 'save' | 'load';
  title?: string;
  initialName?: string;
  initialDescription?: string;
}

const MetricTemplateDialog: React.FC<MetricTemplateDialogProps> = ({
  open,
  onClose,
  onSave,
  metrics,
  mode,
  title,
  initialName = '',
  initialDescription = '',
}) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [nameError, setNameError] = useState('');

  const handleSave = () => {
    // Validate name
    if (!name.trim()) {
      setNameError('Template name is required');
      return;
    }
    
    onSave(name, description);
    onClose();
  };

  const dialogTitle = title || (mode === 'save' ? 'Save as Template' : 'Load Template');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{dialogTitle}</Typography>
          <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="Template Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameError('');
            }}
            margin="normal"
            error={!!nameError}
            helperText={nameError}
            disabled={mode === 'load'}
          />
          <TextField
            fullWidth
            label="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            margin="normal"
            multiline
            rows={3}
            disabled={mode === 'load'}
          />
          
          {mode === 'save' && metrics.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                This template will include {metrics.length} metric configuration{metrics.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}
        </Box>
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
          {mode === 'save' ? 'Save Template' : 'Load Template'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MetricTemplateDialog;
