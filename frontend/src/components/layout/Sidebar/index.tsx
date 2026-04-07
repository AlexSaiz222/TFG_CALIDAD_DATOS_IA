import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  List,
  IconButton,
  Typography,
  Avatar,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Dashboard as DashboardIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Storage as StorageIcon,
  FileUpload as FileUploadIcon,
  Add as AddIcon,
  Assessment as AssessmentIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  PostAdd as PostAddIcon,
  List as ListIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import SidebarItemComponent from './SidebarItem';
import RecentItems from './RecentItems';
import { SidebarItem } from './types';
import { useSidebar } from '../../../contexts/SidebarContext';
import { projectsAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { safeNavigate } from '../../../utils/routeTransition';

const DRAWER_WIDTH    = 240;
const COLLAPSED_WIDTH = 56;

// ─── section label ─────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ label: string; collapsed: boolean }> = ({ label, collapsed }) => {
  if (collapsed) {
    return <Box sx={{ height: 1, mx: 1, my: 1, backgroundColor: '#EBEBEB' }} />;
  }
  return (
    <Box sx={{ px: 2.5, pt: 2, pb: 0.75 }}>
      <Typography sx={{
        fontSize: '0.62rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
        color: '#BBBBBB',
      }}>
        {label}
      </Typography>
    </Box>
  );
};

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ open, onToggle }) => {
  const theme      = useTheme();
  const isMobile   = useMediaQuery(theme.breakpoints.down('md'));
  const { isCollapsed, toggleCollapsed, setCollapsed } = useSidebar();
  const { isAuthenticated, user, logout } = useAuth();
  const [projects, setProjects] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile, setCollapsed]);

  useEffect(() => {
    if (!isAuthenticated) return;
    projectsAPI.getProjects()
      .then(res => {
        let list: Array<{ id: number; name: string }> = [];
        if (res?.data?.data?.projects)               list = res.data.data.projects;
        else if (res?.data?.projects)                list = res.data.projects;
        else if (Array.isArray(res?.data?.data))     list = res.data.data;
        else if (Array.isArray(res?.data))           list = res.data;
        else if (Array.isArray(res))                 list = res as any;
        setProjects(list.slice(0, 8));
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const projectChildren: SidebarItem[] = [
    {
      id: 'projects-all',
      text: 'Ver todos',
      icon: <ListIcon />,
      path: '/projects',
      isControl: true,
      children: projects.length > 0
        ? projects.map(p => ({
            id: `project-${p.id}`,
            text: p.name,
            icon: <FolderOpenIcon />,
            path: `/projects/${p.id}`,
          }))
        : undefined,
    },
    {
      id: 'projects-new',
      text: 'Nuevo proyecto',
      icon: <AddIcon />,
      path: '/projects/new',
    },
  ];

  const datasetChildren: SidebarItem[] = [
    { id: 'datasets-all',    text: 'Todos los datasets', icon: <ListIcon />,       path: '/datasets',        isControl: true },
    { id: 'datasets-upload', text: 'Subir dataset',      icon: <FileUploadIcon />, path: '/datasets/upload' },
  ];

  const mainItems: SidebarItem[] = [
    { id: 'dashboard', text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { id: 'projects',  text: 'Proyectos', icon: <FolderIcon />,    children: projectChildren },
    { id: 'datasets',  text: 'Datasets',  icon: <StorageIcon />,   children: datasetChildren },
    {
      id: 'analysis', text: 'Análisis', icon: <AssessmentIcon />,
      children: [{
        id: 'analysis-history', text: 'Historial', icon: <HistoryIcon />, path: '/evaluations',
      }],
    },
  ];

  const systemItems: SidebarItem[] = [
    {
      id: 'settings', text: 'Configuración', icon: <SettingsIcon />,
      children: [
        { id: 'settings-profile',   text: 'Perfil',     icon: <PersonIcon />,  path: '/profile' },
        { id: 'settings-templates', text: 'Plantillas', icon: <PostAddIcon />, path: '/settings/templates' },
      ],
    },
  ];

  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : user?.username ?? 'Usuario';

  const initials = displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: isCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: isCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: '#F4F5F7',
          borderRight: '1px solid #E8E8E8',
          transition: 'width 0.25s ease-in-out',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* ── Top: aligns with AppBar ── */}
      <Box sx={{
        display: 'flex',
        justifyContent: isCollapsed ? 'center' : 'flex-end',
        alignItems: 'center',
        px: isCollapsed ? 0.5 : 1,
        minHeight: 56,
        borderBottom: '1px solid #E8E8E8',
        flexShrink: 0,
      }}>
        <Tooltip title={isCollapsed ? 'Expandir panel' : 'Colapsar panel'} placement="right">
          <IconButton
            onClick={toggleCollapsed}
            size="small"
            sx={{
              borderRadius: '7px',
              width: 30, height: 30,
              color: '#AAAAAA',
              '&:hover': { backgroundColor: 'rgba(0,179,126,0.08)', color: '#00B37E' },
            }}
          >
            {isCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Scrollable nav area ── */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        {/* Main nav items */}
        <List component="nav" disablePadding>
          {mainItems.map(item => (
            <SidebarItemComponent key={item.id} item={item} isCollapsed={isCollapsed} />
          ))}
        </List>

        {/* Separator + system items */}
        <SectionLabel label="Sistema" collapsed={isCollapsed} />
        <List component="nav" disablePadding>
          {systemItems.map(item => (
            <SidebarItemComponent key={item.id} item={item} isCollapsed={isCollapsed} />
          ))}
        </List>

        {/* Recent items */}
        <RecentItems isCollapsed={isCollapsed} />
      </Box>

      {/* ── User profile footer ── */}
      {isCollapsed ? (
        <Box sx={{
          py: 1.5,
          display: 'flex', justifyContent: 'center',
          borderTop: '1px solid #E8E8E8',
          flexShrink: 0,
        }}>
          <Tooltip title={displayName} placement="right">
            <Avatar sx={{
              width: 30, height: 30, fontSize: '0.7rem', fontWeight: 700,
              backgroundColor: '#00B37E',
              cursor: 'pointer',
            }}>
              {initials}
            </Avatar>
          </Tooltip>
        </Box>
      ) : (
        <Box sx={{
          px: 1.5, py: 1.25,
          borderTop: '1px solid #E8E8E8',
          display: 'flex', alignItems: 'center', gap: 1,
          flexShrink: 0,
        }}>
          <Avatar sx={{
            width: 30, height: 30, fontSize: '0.72rem', fontWeight: 700,
            backgroundColor: '#00B37E', flexShrink: 0,
          }}>
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{
              fontSize: '0.8rem', fontWeight: 600, color: '#1A1A1A',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {displayName}
            </Typography>
            {user?.email && (
              <Typography sx={{
                fontSize: '0.68rem', color: '#AAAAAA',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user.email}
              </Typography>
            )}
          </Box>
          <Tooltip title="Cerrar sesión">
            <IconButton
              size="small"
              onClick={logout}
              sx={{
                flexShrink: 0, p: 0.5,
                color: '#CCCCCC',
                '&:hover': { color: '#E5484D', backgroundColor: 'rgba(229,72,77,0.08)' },
              }}
            >
              <LogoutIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Drawer>
  );
};

export default Sidebar;
export { DRAWER_WIDTH, COLLAPSED_WIDTH };
