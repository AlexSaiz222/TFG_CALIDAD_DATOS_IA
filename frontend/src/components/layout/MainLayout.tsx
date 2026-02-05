import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { safeNavigate } from '../../utils/routeTransition';
import {
  AppBar,
  Box,
  CssBaseline,
  Divider,
  IconButton,
  ListItemIcon,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  CircularProgress,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';
import Sidebar, { DRAWER_WIDTH, COLLAPSED_WIDTH } from './Sidebar';

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

interface MainLayoutProps {
  children: React.ReactNode;
}

// Creamos un componente con estilos globales para los keyframes
const GlobalStyles = () => {
  return (
    <style jsx global>{`
      @keyframes shine {
        0%, 5% { background-position: -200% 0; }
        100% { background-position: 100% 0; }
      }
    `}</style>
  );
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();
  const { user, logout, isAuthenticated, loading: authLoading } = useAuth();
  const { isOpen: open, isCollapsed, toggleOpen, setOpen } = useSidebar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  }, [isMobile]);

  // Redirección explícita para usuarios no autenticados
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('MainLayout: Usuario no autenticado, redirigiendo a login...');
      // Use router.replace directly for auth redirects as they are critical
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  // Mostrar pantalla de carga mientras se verifica la autenticación
  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Si no está autenticado, no renderizar nada y esperar la redirección
  if (!isAuthenticated) {
    return null;
  }

  const handleDrawerToggle = () => {
    toggleOpen();
  };

  // Calculate sidebar width based on open and collapsed state
  const currentSidebarWidth = open ? (isCollapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH) : 0;

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
  };

  const handleProfileClick = () => {
    handleProfileMenuClose();
    safeNavigate('/profile');
  };

  // Ruta a la imagen del logo personalizada
  const logoPath = '/images/logo.png';

  return (
    <Box sx={{ display: 'flex', overflow: 'hidden' }}>
      <GlobalStyles />
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={(theme) => ({
          zIndex: theme.zIndex.drawer + 1,
          backgroundColor: '#FFFFFF',
          color: '#1A1A1A',
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
        })}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
            <Image
              src={logoPath}
              alt="Data Quality Platform Logo"
              width={35}
              height={35}
              style={{ marginRight: '10px' }}
            />
            <Box
              sx={{
                flexGrow: 1,
                position: 'relative',
                cursor: 'pointer',
                '&:hover .text-shine': {
                  animation: 'shine 5s linear infinite',
                  backgroundPosition: '-200%', /* Asegura que comienza completamente fuera */
                },
                '&:not(:hover) .text-shine': {
                  animation: 'none',
                  backgroundImage: 'none',
                  color: '#333333',
                  WebkitTextFillColor: '#333333',
                }
              }}
            >
              <Typography
                variant="h5"
                noWrap
                component="div"
                className="text-shine"
                sx={{
                  fontWeight: 700,
                  fontFamily: '"Segoe UI", "Trebuchet MS", "Helvetica", sans-serif',
                  color: '#333333',
                  backgroundImage: 'linear-gradient(90deg, #333333, #333333 40%, rgba(0,210,181,1) 45%, rgba(0,183,222,1) 50%, #333333 55%, #333333)',
                  backgroundSize: '300%',
                  backgroundPosition: '-200%',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  // Sin transición para no interferir con la animación
                }}
              >
                DATAQUAL
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Account settings">
            <IconButton
              onClick={handleProfileMenuOpen}
              size="small"
              sx={{ ml: 2 }}
              aria-controls="profile-menu"
              aria-haspopup="true"
            >
              <Avatar sx={{ 
                bgcolor: '#00B37E',
                boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.05)',
                }
              }}>
                {user?.first_name ? user.first_name[0] : user?.username ? user.username[0] : 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            id="profile-menu"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            PaperProps={{
              elevation: 3,
              sx: {
                overflow: 'visible',
                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.1))',
                mt: 1.5,
                borderRadius: '8px',
                minWidth: '180px',
                '& .MuiMenuItem-root': {
                  borderRadius: '4px',
                  margin: '2px 8px',
                  padding: '8px 16px',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 179, 126, 0.08)',
                  },
                },
              },
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={handleProfileClick}>
              <ListItemIcon>
                <PersonIcon fontSize="small" sx={{ color: '#00B37E' }} />
              </ListItemIcon>
              <Typography>Profile</Typography>
            </MenuItem>
            <Divider sx={{ my: 1 }} />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" sx={{ color: '#E5484D' }} />
              </ListItemIcon>
              <Typography>Logout</Typography>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Sidebar open={open} onToggle={handleDrawerToggle} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          pl: 6,
          pr: 3,
          paddingTop: 4,
          position: 'absolute',
          left: `${currentSidebarWidth}px`,
          width: `calc(100% - ${currentSidebarWidth + 24}px)`,
          transition: 'left 0.3s ease-in-out, width 0.3s ease-in-out',
        }}
      >
        <DrawerHeader />
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;
