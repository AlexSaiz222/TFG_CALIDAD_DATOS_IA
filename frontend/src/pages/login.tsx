// pages/login.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Divider,
  Fade,
  Tooltip,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { 
  Visibility, 
  VisibilityOff, 
  Person, 
  Lock, 
  Info,
  ArrowForward,
  Security
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  // Estados para el formulario
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formErrors, setFormErrors] = useState<{username?: string, password?: string}>({});
  const [animateSuccess, setAnimateSuccess] = useState(false);
  
  // Ya no necesitamos referencias para animación
  
  // Auth context y router
  const { login, loading, error } = useAuth();
  const router = useRouter();
  
  // Validación de campos
  const validateField = (name: string, value: string): string => {
    if (!value.trim()) {
      return name === 'username' ? 'El usuario es requerido' : 'La contraseña es requerida';
    }
    if (name === 'password' && value.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres';
    }
    return '';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Validación en tiempo real
    const error = validateField(name, value);
    setFormErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  const handleClickShowPassword = () => setShowPassword(prev => !prev);
  const handleMouseDownPassword = (e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault();
  const handleRememberMeChange = () => setRememberMe(prev => !prev);

  // Validación del formulario completo
  const validateForm = (): boolean => {
    const errors: {username?: string, password?: string} = {};
    const usernameError = validateField('username', formData.username);
    const passwordError = validateField('password', formData.password);
    
    if (usernameError) errors.username = usernameError;
    if (passwordError) errors.password = passwordError;
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      setAnimateSuccess(true);
      await login(formData.username, formData.password);
      // Si llegamos aquí, el login fue exitoso
      // La redirección la maneja el contexto de autenticación
    } catch (err) {
      setAnimateSuccess(false);
      // El error lo maneja el contexto de autenticación
    }
  };

  return (
    <Box
      sx={{
        minHeight: '90vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef2f6 100%)',
      }}
    >
      <Container component="main" maxWidth="sm">
        <div
          style={{ width: '100%', position: 'relative', zIndex: 1 }}
        >
          <Paper
            elevation={0}
            sx={{
              mx: 'auto',
              px: { xs: 2, sm: 4 },
              py: { xs: 2, sm: 3 },
              borderRadius: 3,
              width: '100%',
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(0,0,0,0.04)',
              boxShadow: '0 15px 35px rgba(0,0,0,0.1)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                boxShadow: '0 18px 40px rgba(0,0,0,0.12)',
                transform: 'translateY(-2px)',
              },
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                width: '6px',
                height: '100%',
                background: 'linear-gradient(180deg, #00B37E 0%, #00C8A5 100%)',
              }
            }}
          >
          {/* Header con logo y título en una fila */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            mb: 1.5,
            gap: 2
          }}>
            <Image
              src="/images/logo.png"
              alt="DATAQUAL"
              width={40}
              height={40}
              priority
              style={{ 
                filter: 'drop-shadow(0px 2px 4px rgba(0, 179, 126, 0.2))' 
              }}
            />
            <Box>
              <Typography
                component="h1"
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: '#1A1A1A',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                  mb: 0.2
                }}
              >
                Bienvenido de nuevo
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#555555',
                  display: 'block'
                }}
              >
                Accede a tu cuenta para gestionar tus proyectos
              </Typography>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <div>
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                margin="dense"
                required
                fullWidth
                id="username"
                name="username"
                label="Usuario o correo"
                autoComplete="username"
                autoFocus
                value={formData.username}
                onChange={handleChange}
                error={!!formErrors.username}
                helperText={formErrors.username}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person sx={{ color: formErrors.username ? '#E5484D' : '#6B7280', fontSize: '1.2rem' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 1,
                  '& .MuiInputBase-root': {
                    color: '#111827',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: 2,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: '#FFFFFF',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    },
                    '&.Mui-focused': {
                      backgroundColor: '#FFFFFF',
                      boxShadow: '0 0 0 2px rgba(0, 179, 126, 0.2)',
                    },
                  },
                  '& label': { 
                    color: '#6B7280',
                    fontWeight: 500,
                  },
                  '& label.Mui-focused': { 
                    color: '#00B37E',
                    fontWeight: 600,
                  },
                  '& .MuiOutlinedInput-notchedOutline': { 
                    borderColor: '#E5E7EB',
                    borderWidth: '1.5px',
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#D1D5DB',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#00B37E',
                    borderWidth: '2px',
                  },
                  '& .MuiFormHelperText-root': {
                    marginLeft: 0,
                    fontWeight: 500,
                  },
                }}
                inputProps={{
                  'aria-label': 'Usuario o correo electrónico',
                }}
              />

              <TextField
                margin="dense"
                required
                fullWidth
                id="password"
                name="password"
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                error={!!formErrors.password}
                helperText={formErrors.password}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: formErrors.password ? '#E5484D' : '#6B7280', fontSize: '1.2rem' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}>
                        <IconButton
                          aria-label={showPassword ? "ocultar contraseña" : "mostrar contraseña"}
                          onClick={handleClickShowPassword}
                          onMouseDown={handleMouseDownPassword}
                          edge="end"
                          sx={{ 
                            color: '#6B7280',
                            '&:hover': { color: '#00B37E' },
                          }}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 1,
                  '& .MuiInputBase-root': {
                    color: '#111827',
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: 2,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: '#FFFFFF',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    },
                    '&.Mui-focused': {
                      backgroundColor: '#FFFFFF',
                      boxShadow: '0 0 0 2px rgba(0, 179, 126, 0.2)',
                    },
                  },
                  '& label': { 
                    color: '#6B7280',
                    fontWeight: 500,
                  },
                  '& label.Mui-focused': { 
                    color: '#00B37E',
                    fontWeight: 600,
                  },
                  '& .MuiOutlinedInput-notchedOutline': { 
                    borderColor: '#E5E7EB',
                    borderWidth: '1.5px',
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#D1D5DB',
                  },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#00B37E',
                    borderWidth: '2px',
                  },
                  '& .MuiFormHelperText-root': {
                    marginLeft: 0,
                    fontWeight: 500,
                  },
                }}
                inputProps={{
                  'aria-label': 'Contraseña',
                }}
              />

            <Box
              sx={{
                mt: 0,
                mb: 0.5,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox 
                    checked={rememberMe} 
                    onChange={handleRememberMeChange} 
                    name="rememberMe" 
                    size="small"
                    sx={{
                      padding: '2px',
                      color: '#6B7280',
                      '&.Mui-checked': {
                        color: '#00B37E',
                      },
                    }}
                  />
                }
                label={
                  <Typography variant="caption" sx={{ color: '#555555' }}>
                    Recordarme
                  </Typography>
                }
                sx={{ mr: 1 }}
              />
              
              <Link
                href="/forgot-password"
                style={{ 
                  textDecoration: 'none', 
                  color: '#00B37E', 
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </Box>

            <div style={{ width: '100%' }}>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                endIcon={!loading && <ArrowForward />}
                sx={{
                  mt: 0.5,
                  py: 0.8,
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '0.9rem',
                  letterSpacing: 0.2,
                  borderRadius: 2.5,
                  background: 'linear-gradient(135deg, #00B37E 0%, #00C8A5 100%)',
                  color: '#FFFFFF',
                  boxShadow: '0 6px 14px rgba(0,179,126,0.25)',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: -100,
                    width: '70px',
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.2)',
                    transform: 'skewX(-15deg)',
                    transition: 'all 0.6s ease',
                    opacity: 0,
                  },
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 20px rgba(0,179,126,0.35)',
                    filter: 'brightness(1.05)',
                    background: 'linear-gradient(135deg, #00A070 0%, #00BFAE 100%)',
                    '&::before': {
                      left: '120%',
                      opacity: 0.7,
                    }
                  },
                  '&:active': { transform: 'translateY(0)' },
                  '&.Mui-disabled': {
                    background: 'linear-gradient(135deg, #9FE7D3 0%, #B3F0E6 100%)',
                    color: 'rgba(255, 255, 255, 0.8)',
                  },
                }}
                aria-label="Iniciar sesión"
              >
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} color="inherit" />
                    <span>Iniciando sesión...</span>
                  </Box>
                ) : 'Iniciar sesión'}
              </Button>
            </div>

            <Box sx={{ position: 'relative', my: 1 }}>
              <Divider sx={{ borderColor: 'rgba(0,0,0,0.08)' }} />
            </Box>

            <Box sx={{ textAlign: 'center', mb: 0.5 }}>
              <div>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ color: '#4B5563' }}>
                    ¿No tienes cuenta?
                  </Typography>
                  <Link
                    href="/register"
                    style={{
                      color: '#00B37E',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontSize: '0.75rem'
                    }}
                  >
                    Crear cuenta
                  </Link>
                </Box>
              </div>
            </Box>
          </Box>
          </div>
        </Paper>
      </div>
      </Container>
    </Box>
  );
};

export default Login;
