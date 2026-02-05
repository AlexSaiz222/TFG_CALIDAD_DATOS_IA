import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Skeleton,
  Divider,
} from '@mui/material';
import {
  Folder as FolderIcon,
  Storage as StorageIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { safeNavigate } from '../../../utils/routeTransition';
import { projectsAPI, datasetsAPI } from '../../../services/api';

interface HoverMenuItem {
  id: number;
  name: string;
  path: string;
}

interface HoverMenuProps {
  type: 'projects' | 'datasets';
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

const HoverMenu: React.FC<HoverMenuProps> = ({ type, anchorEl, onClose }) => {
  const [items, setItems] = useState<HoverMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        if (type === 'projects') {
          const res = await projectsAPI.getProjects();
          const projects = res.data?.data?.projects || res.data?.projects || [];
          setItems(
            projects.slice(0, 8).map((p: any) => ({
              id: p.id,
              name: p.name,
              path: `/projects/${p.id}`,
            }))
          );
        } else {
          // For datasets, we need to fetch from all projects or use a different approach
          // For now, show empty with option to go to datasets page
          setItems([]);
        }
      } catch (error) {
        console.error('Error fetching items:', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    if (anchorEl) {
      fetchItems();
    }
  }, [type, anchorEl]);

  if (!anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();
  const isProjects = type === 'projects';

  return (
    <Paper
      elevation={8}
      onMouseLeave={onClose}
      sx={{
        position: 'fixed',
        left: rect.right + 4,
        top: rect.top,
        minWidth: 220,
        maxWidth: 280,
        maxHeight: 400,
        overflowY: 'auto',
        zIndex: 1300,
        borderRadius: '8px',
        border: '1px solid #E5E5E5',
      }}
    >
      <Box sx={{ p: 1.5, borderBottom: '1px solid #E5E5E5' }}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, color: '#333', fontSize: '0.85rem' }}
        >
          {isProjects ? 'Proyectos recientes' : 'Datasets recientes'}
        </Typography>
      </Box>

      <List disablePadding sx={{ py: 0.5 }}>
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <ListItem key={i} sx={{ py: 0.5, px: 1 }}>
                <Skeleton variant="rectangular" width="100%" height={32} sx={{ borderRadius: 1 }} />
              </ListItem>
            ))}
          </>
        ) : items.length === 0 ? (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              color: '#999',
              py: 2,
              px: 1,
            }}
          >
            {isProjects ? 'No hay proyectos' : 'No hay datasets'}
          </Typography>
        ) : (
          items.map((item) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                onClick={() => {
                  safeNavigate(item.path);
                  onClose();
                }}
                sx={{
                  py: 0.75,
                  px: 1.5,
                  mx: 0.5,
                  borderRadius: '6px',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 179, 126, 0.08)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 28,
                    color: isProjects ? '#00B37E' : '#3B82F6',
                  }}
                >
                  {isProjects ? (
                    <FolderIcon sx={{ fontSize: '1rem' }} />
                  ) : (
                    <StorageIcon sx={{ fontSize: '1rem' }} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.name}
                  primaryTypographyProps={{
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    color: '#555',
                    noWrap: true,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))
        )}
      </List>

      <Divider />

      <ListItem disablePadding>
        <ListItemButton
          onClick={() => {
            safeNavigate(isProjects ? '/projects/new' : '/datasets/upload');
            onClose();
          }}
          sx={{
            py: 1,
            px: 1.5,
            '&:hover': {
              backgroundColor: isProjects ? 'rgba(0, 179, 126, 0.08)' : 'rgba(59, 130, 246, 0.08)',
            },
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 28,
              color: isProjects ? '#00B37E' : '#3B82F6',
            }}
          >
            <AddIcon sx={{ fontSize: '1rem' }} />
          </ListItemIcon>
          <ListItemText
            primary={isProjects ? 'Nuevo proyecto' : 'Subir dataset'}
            primaryTypographyProps={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: isProjects ? '#00B37E' : '#3B82F6',
            }}
          />
        </ListItemButton>
      </ListItem>
    </Paper>
  );
};

export default HoverMenu;
