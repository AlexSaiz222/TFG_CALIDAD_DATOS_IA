import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { authAPI } from '../services/api';
import { User, AuthState } from '../types';
import { RegisterUserData } from '../pages/register';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (userData: RegisterUserData) => Promise<void>;
  logout: () => void;
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
        return;
      }
      
      console.log('AuthContext: Token encontrado, verificando con backend...');
      try {
        // Get user profile
        console.log('AuthContext: Llamando a getProfile()...');
        const response = await authAPI.getProfile();
        console.log('AuthContext: Respuesta de getProfile:', response.data);
        
        if (response.data && response.data.user) {
          console.log('AuthContext: Usuario autenticado correctamente');
          setAuthState({
            isAuthenticated: true,
            user: response.data.user,
            loading: false,
            error: null,
          });
        } else {
          console.error('AuthContext: Respuesta de getProfile no contiene datos de usuario válidos');
          throw new Error('Invalid user data received');
        }
      } catch (error) {
        console.error('AuthContext: Error al verificar perfil:', error);
        // Clear invalid token
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: 'Session expired. Please login again.',
        });
      }
    };
    
    checkAuth();
  }, []);

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
    
    // Redirect to login
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        register,
        logout,
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
