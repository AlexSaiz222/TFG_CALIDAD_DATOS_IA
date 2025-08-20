import React, { useState } from 'react';
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
} from '@mui/material';
import { Visibility, VisibilityOff, Person, Lock } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading, error } = useAuth();
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleMouseDownPassword = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(formData.username, formData.password);
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Paper
          elevation={4}
          sx={{
            padding: { xs: 3, sm: 5 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            borderRadius: '12px',
            background: 'linear-gradient(145deg, #ffffff, #f9fafb)',
            boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.06)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Decorative element */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '4px',
              background: 'linear-gradient(90deg, #00B37E, #00B3A6, #00A3B3)',
            }}
          />
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, mt: 1 }}>
            <Image
              src="/images/logo.png"
              alt="Data Quality Platform Logo"
              width={50}
              height={50}
              style={{ marginRight: '12px' }}
            />
            <Typography 
              component="h1" 
              variant="h4" 
              sx={{ 
                fontWeight: 600, 
                color: '#1A1A1A',
                fontFamily: '"Segoe UI", "Trebuchet MS", "Helvetica", sans-serif',
              }}
            >
              DATAQUAL
            </Typography>
          </Box>
          
          <Typography 
            component="h2" 
            variant="h5" 
            sx={{ 
              mb: 3, 
              color: '#333333',
              fontWeight: 500,
              position: 'relative',
              '&:after': {
                content: '""',
                position: 'absolute',
                bottom: '-8px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '40px',
                height: '3px',
                backgroundColor: '#00B37E',
                borderRadius: '2px',
              }
            }}
          >
            Welcome Back
          </Typography>

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                width: '100%', 
                mb: 3,
                borderRadius: '8px',
                '& .MuiAlert-icon': {
                  color: '#E5484D'
                }
              }}
            >
              {error}
            </Alert>
          )}

          <Box 
            component="form" 
            onSubmit={handleSubmit} 
            sx={{ 
              mt: 2, 
              width: '100%',
              maxWidth: '400px',
            }}
          >
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="Username"
              name="username"
              autoComplete="username"
              autoFocus
              value={formData.username}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person sx={{ color: '#555555' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  '&.Mui-focused fieldset': {
                    borderColor: '#00B37E',
                  },
                },
                '& label.Mui-focused': {
                  color: '#00B37E',
                },
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock sx={{ color: '#555555' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleClickShowPassword}
                      onMouseDown={handleMouseDownPassword}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  '&.Mui-focused fieldset': {
                    borderColor: '#00B37E',
                  },
                },
                '& label.Mui-focused': {
                  color: '#00B37E',
                },
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{
                mt: 4,
                mb: 3,
                py: 1.5,
                backgroundColor: '#00B37E',
                borderRadius: '8px',
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '1rem',
                boxShadow: '0 4px 10px rgba(0, 179, 126, 0.2)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: '#00A070',
                  boxShadow: '0 6px 15px rgba(0, 179, 126, 0.3)',
                  transform: 'translateY(-2px)',
                },
              }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
            
            <Divider sx={{ my: 2, opacity: 0.6 }}>
              <Typography variant="body2" sx={{ color: '#777777', px: 1 }}>
                or
              </Typography>
            </Divider>
            
            <Box sx={{ mt: 1, textAlign: 'center' }}>
              <Link 
                href="/register" 
                style={{
                  color: '#00B37E',
                  textDecoration: 'none',
                }}
              >
                <Typography 
                  variant="body1"
                  sx={{
                    fontWeight: 500,
                    transition: 'all 0.2s',
                    '&:hover': {
                      color: '#00A070',
                      textDecoration: 'underline',
                    }
                  }}
                >
                  Create a new account
                </Typography>
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;
