import React from 'react';
import { Box, Button, Tooltip } from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { safeNavigate } from '../../../utils/routeTransition';

interface QuickActionsProps {
  isCollapsed?: boolean;
}

const QuickActions: React.FC<QuickActionsProps> = ({ isCollapsed = false }) => {
  const actions = [
    {
      id: 'new-project',
      label: 'Nuevo Proyecto',
      shortLabel: 'Proyecto',
      icon: <AddIcon />,
      path: '/projects/new',
      color: '#00B37E',
    },
    {
      id: 'upload-dataset',
      label: 'Subir Dataset',
      shortLabel: 'Dataset',
      icon: <CloudUploadIcon />,
      path: '/datasets/upload',
      color: '#3B82F6',
    },
  ];

  if (isCollapsed) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          p: 1,
          borderBottom: '1px solid #E5E5E5',
        }}
      >
        {actions.map((action) => (
          <Tooltip key={action.id} title={action.label} placement="right" arrow>
            <Button
              variant="contained"
              onClick={() => safeNavigate(action.path)}
              sx={{
                minWidth: 40,
                width: 40,
                height: 40,
                p: 0,
                backgroundColor: action.color,
                '&:hover': {
                  backgroundColor: action.color,
                  filter: 'brightness(0.9)',
                },
              }}
            >
              {action.icon}
            </Button>
          </Tooltip>
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 2,
        borderBottom: '1px solid #E5E5E5',
      }}
    >
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="contained"
          startIcon={action.icon}
          onClick={() => safeNavigate(action.path)}
          fullWidth
          sx={{
            backgroundColor: action.color,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.85rem',
            py: 1,
            borderRadius: '8px',
            boxShadow: 'none',
            '&:hover': {
              backgroundColor: action.color,
              filter: 'brightness(0.9)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            },
          }}
        >
          {action.label}
        </Button>
      ))}
    </Box>
  );
};

export default QuickActions;
