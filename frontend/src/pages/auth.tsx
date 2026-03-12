import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Grid,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Person,
  Lock,
  ArrowForward,
  Email,
  Business,
  Badge,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import type { RegisterUserData } from '../types/auth';

// Estilos comunes para los campos de texto - Diseño Premium SaaS
const textFieldStyles = {
  '& .MuiInputBase-root': {
    color: '#1F2937',
    backgroundColor: '#FAFAFA',
    borderRadius: '12px',
    minHeight: '56px',
    fontSize: '1rem',
    transition: 'background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out',
    '&:hover': {
      backgroundColor: '#FFFFFF',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    },
    '&.Mui-focused': {
      backgroundColor: '#FFFFFF',
      boxShadow: '0 0 0 4px rgba(0, 179, 126, 0.12), 0 4px 12px rgba(0,0,0,0.08)',
    },
  },
  '& label': {
    color: '#4B5563',
    fontWeight: 500,
    fontSize: '0.95rem',
  },
  '& label.Mui-focused': {
    color: '#00B37E',
    fontWeight: 600,
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#E5E7EB',
    borderWidth: '1.5px',
    borderRadius: '12px',
  },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#00B37E',
    borderWidth: '1.5px',
  },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#00B37E',
    borderWidth: '2px',
  },
  '& .MuiFormHelperText-root': {
    marginLeft: 0,
    marginTop: '8px',
    fontWeight: 500,
    fontSize: '0.85rem',
  },
  '& .MuiInputBase-input::placeholder': {
    color: '#9CA3AF',
    opacity: 1,
  },
};

const AuthPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();
  const { login, register, loading, error } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (router.query.mode === 'register') {
      setIsLogin(false);
    }
  }, [router.query.mode]);

  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginErrors, setLoginErrors] = useState<{ username?: string; password?: string }>({});

  const [registerData, setRegisterData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    organization: '',
  });
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});

  const toggleAuthMode = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsLogin(!isLogin);
      setIsAnimating(false);
    }, 150);
  };

  const validateLoginField = (name: string, value: string): string => {
    if (!value.trim()) {
      return name === 'username' ? 'El usuario es requerido' : 'La contraseña es requerida';
    }
    if (name === 'password' && value.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres';
    }
    return '';
  };

  const handleLoginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
    const error = validateLoginField(name, value);
    setLoginErrors((prev) => ({ ...prev, [name]: error }));
  };

  const validateLoginForm = (): boolean => {
    const errors: { username?: string; password?: string } = {};
    const usernameError = validateLoginField('username', loginData.username);
    const passwordError = validateLoginField('password', loginData.password);
    if (usernameError) errors.username = usernameError;
    if (passwordError) errors.password = passwordError;
    setLoginErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLoginForm()) return;
    try {
      await login(loginData.username, loginData.password);
    } catch (err) {
      // Error manejado por el contexto
    }
  };

  const handleRegisterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
    if (registerErrors[name]) {
      setRegisterErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateRegisterForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!registerData.username.trim()) {
      errors.username = 'El nombre de usuario es requerido';
    } else if (registerData.username.length < 3) {
      errors.username = 'El nombre de usuario debe tener al menos 3 caracteres';
    }

    if (!registerData.email.trim()) {
      errors.email = 'El email es requerido';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(registerData.email)) {
      errors.email = 'El email no es válido';
    }

    if (!registerData.password) {
      errors.password = 'La contraseña es requerida';
    } else if (registerData.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    if (!registerData.confirmPassword) {
      errors.confirmPassword = 'Confirma tu contraseña';
    } else if (registerData.password !== registerData.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setRegisterErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegisterForm()) return;

    const { confirmPassword, ...userData } = registerData;
    try {
      await register(userData as RegisterUserData);
    } catch (err) {
      // Error manejado por el contexto
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        backgroundColor: '#F8FAFC',
        overflow: 'hidden',
      }}
    >
      {/* Panel izquierdo - Degradado moderno y vivo */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          width: '55%',
          background: 'linear-gradient(165deg, #00D4AA 0%, #00B37E 25%, #00A67E 50%, #008866 75%, #006B52 100%)',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          p: 6,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Imagen de fondo - esfera de datos */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: '10%',
            bottom: 0,
            backgroundImage: `url('/images/imagen-data.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.4,
            filter: 'contrast(8) brightness(1.5)',
          }}
        />

        {/* Capa de blur expandida a todo el panel */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.12)',
            backdropFilter: 'blur(0.8px)',
            zIndex: 0,
          }}
        />

        {/* Contenido principal Minimalista */}
        <Box 
          sx={{ 
            position: 'relative', 
            zIndex: 1, 
            maxWidth: '85%',
          }}
        > 
          
          {/* TÍTULO GRANDE */}
          <Typography
            variant="h1"
            component="h1"
            sx={{
              fontWeight: 900,
              lineHeight: 1,
              fontSize: { md: '5rem', lg: '6rem' },
              letterSpacing: '-0.05em',
              fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
              mb: 2.5,
            }}
          >
            <Box
              component="span"
              sx={{
                color: '#FFFFFF',
                textShadow: '0 0 30px rgba(255, 255, 255, 0.25), 0 0 60px rgba(255, 255, 255, 0.15), 0 4px 12px rgba(0, 0, 0, 0.4)',
              }}
            >
              Data
            </Box>
            <Box
              component="span"
              sx={{
                color: '#39FF14',
                textShadow: '0 0 15px rgba(57, 255, 20, 0.4), 0 0 30px rgba(57, 255, 20, 0.2), 0 4px 12px rgba(0, 0, 0, 0.3)',
              }}
            >
              Qual
            </Box>
          </Typography>

          {/* DESCRIPCIÓN justificada con mejor contraste */}
          <Typography
            variant="h5"
            sx={{
              color: '#FFFFFF',
              fontWeight: 600,
              lineHeight: 1.5,
              fontSize: { md: '1.5rem', lg: '1.65rem' },
              fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
              maxWidth: '100%',
              letterSpacing: '0.02em',
              textAlign: 'justify',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
            }}
          >
            Gestión inteligente de la calidad de los datos
          </Typography>

        </Box>

        {/* Curva de transición derecha - Onda pequeña y luego onda grande */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 300,
            height: '100%',
            zIndex: 2,
            transform: 'translateX(1px)', 
          }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 300 1000"
            preserveAspectRatio="none"
            style={{ display: 'block' }}
          >
            <path
              d="M300,0 
                 L200,0 
                 C 250,150 150,250 200,400 
                 C 280,600 0,800 150,1000 
                 L300,1000 
                 Z"
              fill="#FFFFFF"
            />
          </svg>
        </Box>
      </Box>

      {/* Panel derecho - Formularios */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          p: { xs: 3, sm: 4, md: 6 },
          backgroundColor: '#FFFFFF',
          position: 'relative',
        }}
      >
        {/* Selector de modo (móvil y desktop) */}
        {/* Tabs de navegación - Diseño más integrado */}
        <Box
          sx={{
            position: 'absolute',
            top: 28,
            right: 28,
            display: 'flex',
            gap: 0.5,
            backgroundColor: '#F3F4F6',
            borderRadius: '14px',
            p: 0.75,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <Button
            onClick={() => !isLogin && toggleAuthMode()}
            sx={{
              px: 3.5,
              py: 1.25,
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.9rem',
              textTransform: 'none',
              backgroundColor: isLogin ? '#FFFFFF' : 'transparent',
              color: isLogin ? '#00B37E' : '#6B7280',
              boxShadow: isLogin ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              transition: 'background-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease',
              '&:hover': {
                backgroundColor: isLogin ? '#FFFFFF' : 'rgba(0, 179, 126, 0.08)',
                color: isLogin ? '#00B37E' : '#00B37E',
              },
            }}
          >
            Iniciar sesión
          </Button>
          <Button
            onClick={() => isLogin && toggleAuthMode()}
            sx={{
              px: 3.5,
              py: 1.25,
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.9rem',
              textTransform: 'none',
              backgroundColor: !isLogin ? '#FFFFFF' : 'transparent',
              color: !isLogin ? '#00B37E' : '#6B7280',
              boxShadow: !isLogin ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              transition: 'background-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease',
              '&:hover': {
                backgroundColor: !isLogin ? '#FFFFFF' : 'rgba(0, 179, 126, 0.08)',
                color: !isLogin ? '#00B37E' : '#00B37E',
              },
            }}
          >
            Registrarse
          </Button>
        </Box>

        {/* Logo móvil */}
        {isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 4 }}>
            <Image src="/images/logo.png" alt="DATAQUAL" width={40} height={40} priority />
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1A1A1A' }}>
              DATAQUAL
            </Typography>
          </Box>
        )}

        {/* Contenedor del formulario con animación */}
        <Box
          sx={{
            width: '100%',
            maxWidth: isLogin ? 400 : 500,
            opacity: isAnimating ? 0 : 1,
            transform: isAnimating ? 'translateY(10px)' : 'translateY(0)',
            transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
          }}
        >
          {/* Título del formulario - Jerarquía visual mejorada */}
          <Box sx={{ mb: 5, textAlign: 'center' }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: '#111827',
                mb: 1.5,
                fontSize: { xs: '1.75rem', sm: '2rem', md: '2.25rem' },
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              {isLogin ? 'Bienvenido de nuevo' : 'Crear cuenta'}
            </Typography>
            <Typography 
              variant="body1" 
              sx={{ 
                color: '#6B7280',
                fontSize: '1.05rem',
                lineHeight: 1.5,
              }}
            >
              {isLogin
                ? 'Accede a tu cuenta para gestionar tus proyectos'
                : 'Únete a DataQual'}
            </Typography>
          </Box>

          {/* Mensaje de error */}
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* Formulario de Login */}
          {isLogin ? (
            <Box component="form" onSubmit={handleLoginSubmit} noValidate>
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                name="username"
                label="Usuario o correo"
                placeholder="usuario@ejemplo.com…"
                autoComplete="username"
                spellCheck={false}
                autoFocus
                value={loginData.username}
                onChange={handleLoginChange}
                error={!!loginErrors.username}
                helperText={loginErrors.username}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person sx={{ color: loginErrors.username ? '#E5484D' : '#6B7280' }} />
                    </InputAdornment>
                  ),
                }}
                sx={textFieldStyles}
              />

              <TextField
                margin="normal"
                required
                fullWidth
                id="password"
                name="password"
                label="Contraseña"
                type={showLoginPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={loginData.password}
                onChange={handleLoginChange}
                error={!!loginErrors.password}
                helperText={loginErrors.password}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: loginErrors.password ? '#E5484D' : '#6B7280' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={showLoginPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                        <IconButton
                          aria-label={showLoginPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          edge="end"
                          sx={{ color: '#6B7280', '&:hover': { color: '#00B37E' } }}
                        >
                          {showLoginPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                sx={textFieldStyles}
              />

              {/* Fila Recordarme / Olvidé contraseña - Mejor espaciado */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2.5, mb: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberMe}
                      onChange={() => setRememberMe(!rememberMe)}
                      sx={{
                        color: '#9CA3AF',
                        padding: '8px',
                        '&.Mui-checked': { color: '#00B37E' },
                        '& .MuiSvgIcon-root': { fontSize: '1.25rem' },
                      }}
                    />
                  }
                  label={
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#4B5563', 
                        fontSize: '0.9rem',
                        fontWeight: 500,
                      }}
                    >
                      Recordarme
                    </Typography>
                  }
                />
                <Typography
                  component="a"
                  href="/forgot-password"
                  variant="body2"
                  sx={{
                    color: '#00B37E',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    transition: 'color 0.2s ease',
                    '&:hover': { 
                      color: '#009966',
                      textDecoration: 'underline',
                    },
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </Typography>
              </Box>

              {/* Botón principal - Más prominente */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                endIcon={!loading && <ArrowForward />}
                sx={{
                  mt: 1,
                  py: 1.75,
                  fontWeight: 700,
                  textTransform: 'none',
                  fontSize: '1.05rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #00B37E 0%, #00A070 100%)',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 14px rgba(0,179,126,0.35)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 8px 25px rgba(0,179,126,0.45)',
                  },
                  '&.Mui-disabled': {
                    background: 'linear-gradient(135deg, #9FE7D3 0%, #B3F0E6 100%)',
                    color: 'rgba(255, 255, 255, 0.8)',
                  },
                }}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} color="inherit" />
                    <span>Iniciando sesión…</span>
                  </Box>
                ) : (
                  'Iniciar sesión'
                )}
              </Button>

              {/* Enlace secundario - Mejor espaciado */}
              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#6B7280',
                    fontSize: '0.95rem',
                  }}
                >
                  ¿No tienes cuenta?{' '}
                  <Typography
                    component="button"
                    type="button"
                    onClick={toggleAuthMode}
                    sx={{
                      color: '#00B37E',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      transition: 'color 0.2s ease',
                      '&:hover': { 
                        color: '#009966',
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    Crear cuenta
                  </Typography>
                </Typography>
              </Box>
            </Box>
          ) : (
            /* Formulario de Registro */
            <Box component="form" onSubmit={handleRegisterSubmit} noValidate>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    id="username"
                    name="username"
                    label="Nombre de usuario"
                    placeholder="tu_usuario…"
                    autoComplete="username"
                    spellCheck={false}
                    autoFocus
                    value={registerData.username}
                    onChange={handleRegisterChange}
                    error={!!registerErrors.username}
                    helperText={registerErrors.username}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person sx={{ color: registerErrors.username ? '#E5484D' : '#6B7280' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={textFieldStyles}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    id="email"
                    name="email"
                    type="email"
                    label="Correo electrónico"
                    placeholder="correo@ejemplo.com…"
                    autoComplete="email"
                    spellCheck={false}
                    value={registerData.email}
                    onChange={handleRegisterChange}
                    error={!!registerErrors.email}
                    helperText={registerErrors.email}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Email sx={{ color: registerErrors.email ? '#E5484D' : '#6B7280' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={textFieldStyles}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    id="password"
                    name="password"
                    label="Contraseña"
                    type={showRegisterPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={registerData.password}
                    onChange={handleRegisterChange}
                    error={!!registerErrors.password}
                    helperText={registerErrors.password}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: registerErrors.password ? '#E5484D' : '#6B7280' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showRegisterPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                            edge="end"
                            sx={{ color: '#6B7280', '&:hover': { color: '#00B37E' } }}
                          >
                            {showRegisterPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={textFieldStyles}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    id="confirmPassword"
                    name="confirmPassword"
                    label="Confirmar contraseña"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={registerData.confirmPassword}
                    onChange={handleRegisterChange}
                    error={!!registerErrors.confirmPassword}
                    helperText={registerErrors.confirmPassword}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: registerErrors.confirmPassword ? '#E5484D' : '#6B7280' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                            sx={{ color: '#6B7280', '&:hover': { color: '#00B37E' } }}
                          >
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={textFieldStyles}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="first_name"
                    name="first_name"
                    label="Nombre"
                    autoComplete="given-name"
                    value={registerData.first_name}
                    onChange={handleRegisterChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Badge sx={{ color: '#6B7280' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={textFieldStyles}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    id="last_name"
                    name="last_name"
                    label="Apellidos"
                    autoComplete="family-name"
                    value={registerData.last_name}
                    onChange={handleRegisterChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Badge sx={{ color: '#6B7280' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={textFieldStyles}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    id="organization"
                    name="organization"
                    label="Organización (opcional)"
                    autoComplete="organization"
                    value={registerData.organization}
                    onChange={handleRegisterChange}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Business sx={{ color: '#6B7280' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={textFieldStyles}
                  />
                </Grid>
              </Grid>

              {/* Botón de registro - Consistente con login */}
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                endIcon={!loading && <ArrowForward />}
                sx={{
                  mt: 4,
                  py: 1.75,
                  fontWeight: 700,
                  textTransform: 'none',
                  fontSize: '1.05rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #00B37E 0%, #00A070 100%)',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 14px rgba(0,179,126,0.35)',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 8px 25px rgba(0,179,126,0.45)',
                  },
                  '&.Mui-disabled': {
                    background: 'linear-gradient(135deg, #9FE7D3 0%, #B3F0E6 100%)',
                    color: 'rgba(255, 255, 255, 0.8)',
                  },
                }}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} color="inherit" />
                    <span>Creando cuenta…</span>
                  </Box>
                ) : (
                  'Crear cuenta'
                )}
              </Button>

              {/* Enlace secundario - Consistente con login */}
              <Box sx={{ mt: 4, textAlign: 'center' }}>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: '#6B7280',
                    fontSize: '0.95rem',
                  }}
                >
                  ¿Ya tienes cuenta?{' '}
                  <Typography
                    component="button"
                    type="button"
                    onClick={toggleAuthMode}
                    sx={{
                      color: '#00B37E',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      transition: 'color 0.2s ease',
                      '&:hover': { 
                        color: '#009966',
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    Iniciar sesión
                  </Typography>
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default AuthPage;