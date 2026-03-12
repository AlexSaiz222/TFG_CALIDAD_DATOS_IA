import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { authAPI } from '../services/api';
import { User, AuthState } from '../types';
import type { RegisterUserData } from '../types/auth';

// Constants for auth caching
const AUTH_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterUserData) => Promise<void>;
  logout: () => void;
  updateProfile: (userData: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null,
  });
  
  const router = useRouter();

  // Check if user is authenticated on initial load
  useEffect(() => {
    const checkAuth = async () => {
      console.log('AuthContext: Verificando autenticación...');
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.log('AuthContext: No hay token en localStorage');
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: null,
        });
        
        // Si no estamos en la página de login, redirigir automáticamente
        if (typeof window !== 'undefined' && 
            !window.location.pathname.includes('/login') && 
            !window.location.pathname.includes('/register') &&
            !window.location.pathname.includes('/auth')) {
          console.log('AuthContext: Redirigiendo a auth por falta de token...');
          router.replace('/auth');
        }
        return;
      }
      
      // Check if we have a cached auth that's still valid
      const lastAuthCheck = localStorage.getItem('lastAuthCheck');
      const cachedUser = localStorage.getItem('user');
      const now = Date.now();
      
      // Only use cache if it exists and is recent enough
      if (lastAuthCheck && cachedUser) {
        const lastCheckTime = parseInt(lastAuthCheck, 10);
        if (now - lastCheckTime < AUTH_CACHE_DURATION) {
          console.log('AuthContext: Usando datos de autenticación en caché');
          try {
            const user = JSON.parse(cachedUser);
            setAuthState({
              isAuthenticated: true,
              user,
              loading: false,
              error: null,
            });
            return; // Skip the API call
          } catch (e) {
            console.error('AuthContext: Error al parsear usuario en caché:', e);
            // Continue with API call if cache parsing fails
          }
        } else {
          console.log('AuthContext: Caché de autenticación expirado, verificando con backend...');
        }
      }
      
      console.log('AuthContext: Token encontrado, verificando con backend...');
      try {
        // Get user profile
        console.log('AuthContext: Llamando a getProfile()...');
        const response = await authAPI.getProfile();
        console.log('AuthContext: Respuesta de getProfile:', response.data);
        
        // Verificar la estructura de la respuesta y extraer los datos del usuario
        let userData = null;
        
        if (response.data && response.data.success === true) {
          // Caso 1: Estructura anidada con data.data.user (estructura actual)
          if (response.data.data && response.data.data.user) {
            console.log('AuthContext: Usuario autenticado correctamente (estructura anidada)');
            userData = response.data.data.user;
          } 
          // Caso 2: Estructura con data.user (estructura esperada originalmente)
          else if (response.data.user) {
            console.log('AuthContext: Usuario autenticado correctamente (estructura plana)');
            userData = response.data.user;
          }
          // Caso 3: El usuario está directamente en data.data (otra posible estructura)
          else if (response.data.data && typeof response.data.data === 'object') {
            console.log('AuthContext: Usuario autenticado correctamente (data directa)');
            userData = response.data.data;
          } else {
            console.error('AuthContext: Respuesta de getProfile no contiene datos de usuario válidos');
            console.error('AuthContext: Estructura de respuesta:', JSON.stringify(response.data));
            throw new Error('Invalid user data received');
          }
          
          // Update auth state with user data
          setAuthState({
            isAuthenticated: true,
            user: userData,
            loading: false,
            error: null,
          });
          
          // Cache the authentication data
          localStorage.setItem('lastAuthCheck', now.toString());
          localStorage.setItem('user', JSON.stringify(userData));
          
        } else {
          console.error('AuthContext: Respuesta de getProfile no contiene datos de usuario válidos');
          console.error('AuthContext: Estructura de respuesta:', JSON.stringify(response.data));
          throw new Error('Invalid user data received');
        }
      } catch (error) {
        console.error('AuthContext: Error al verificar perfil:', error);
        // Clear invalid token and cache
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('lastAuthCheck');
        
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: 'Session expired. Please login again.',
        });
        
        // Redirigir a login si no estamos ya en la página de login
        if (typeof window !== 'undefined' && 
            !window.location.pathname.includes('/login') && 
            !window.location.pathname.includes('/register') &&
            !window.location.pathname.includes('/auth')) {
          console.log('AuthContext: Redirigiendo a auth por error de autenticación...');
          router.replace('/auth');
        }
      }
    };
    
    checkAuth();
  }, [router]);

  // Login function
  const login = async (username: string, password: string) => {
    console.log('AuthContext: Iniciando login para usuario:', username);
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('AuthContext: Enviando solicitud de login...');
      const response = await authAPI.login(username, password);
      console.log('AuthContext: Respuesta de login recibida:', response.data ? 'Datos recibidos' : 'Sin datos');
      
      if (!response.data || !response.data.token) {
        console.error('AuthContext: Respuesta de login no contiene token');
        throw new Error('Invalid login response - no token received');
      }
      
      const { token, user } = response.data;
      
      // Save token and user to localStorage
      console.log('AuthContext: Guardando token y datos de usuario en localStorage');
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      console.log('AuthContext: Actualizando estado de autenticación');
      setAuthState({
        isAuthenticated: true,
        user,
        loading: false,
        error: null,
      });
      
      // Usar await para la redirección para evitar problemas de navegación asíncrona
      console.log('AuthContext: Redirigiendo a dashboard...');
      try {
        await router.push('/dashboard');
        console.log('AuthContext: Redirección completada');
      } catch (navError) {
        console.error('AuthContext: Error en la navegación:', navError);
      }
    } catch (error: any) {
      console.error('AuthContext: Error durante login:', error);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.response?.data?.message || 'Login failed. Please check your credentials.',
      }));
    }
  };

  // Register function
  const register = async (userData: RegisterUserData) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await authAPI.register(userData);
      const { token, user } = response.data;
      
      // Save token and user to localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      setAuthState({
        isAuthenticated: true,
        user,
        loading: false,
        error: null,
      });
      
      // Usar await para la redirección para evitar problemas de navegación asíncrona
      console.log('AuthContext: Redirigiendo a dashboard desde registro...');
      try {
        await router.push('/dashboard');
        console.log('AuthContext: Redirección desde registro completada');
      } catch (navError) {
        console.error('AuthContext: Error en la navegación desde registro:', navError);
      }
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.response?.data?.message || 'Registration failed. Please try again.',
      }));
    }
  };

  // Logout function
  const logout = () => {
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Reset auth state
    setAuthState({
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null,
    });
    
    // Redirect to auth
    router.push('/auth');
  };

  // Update profile function
  const updateProfile = async (userData: any) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('AuthContext: Actualizando perfil de usuario...');
      const response = await authAPI.updateProfile(userData);
      console.log('AuthContext: Respuesta de actualización de perfil:', response.data);
      
      // Extract user data from response
      let updatedUser = null;
      
      if (response.data && response.data.success === true) {
        // Case 1: Nested structure with data.user
        if (response.data.data && response.data.data.user) {
          updatedUser = response.data.data.user;
        }
        // Case 2: Structure with data.user
        else if (response.data && 'user' in response.data) {
          updatedUser = (response.data as any).user;
        }
        // Case 3: User directly in data.data
        else if (response.data.data && typeof response.data.data === 'object') {
          updatedUser = response.data.data;
        }
      }
      
      if (!updatedUser) {
        console.error('AuthContext: Respuesta de actualización no contiene datos de usuario válidos');
        throw new Error('Invalid user data received');
      }
      
      // Update localStorage with new user data
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Update auth state
      setAuthState({
        isAuthenticated: true,
        user: updatedUser,
        loading: false,
        error: null,
      });
      
      return updatedUser;
    } catch (error: any) {
      console.error('AuthContext: Error al actualizar perfil:', error);
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.response?.data?.message || 'Failed to update profile',
      }));
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
