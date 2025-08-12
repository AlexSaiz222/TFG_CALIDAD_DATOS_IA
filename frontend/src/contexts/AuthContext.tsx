import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/router';
import { authAPI } from '../services/api';
import { User, AuthState } from '../types';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
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
      const token = localStorage.getItem('token');
      
      if (!token) {
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
          error: null,
        });
        return;
      }
      
      try {
        // Get user profile
        const response = await authAPI.getProfile();
        setAuthState({
          isAuthenticated: true,
          user: response.data,
          loading: false,
          error: null,
        });
      } catch (error) {
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
    setAuthState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await authAPI.login(username, password);
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
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error: any) {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: error.response?.data?.message || 'Login failed. Please check your credentials.',
      }));
    }
  };

  // Register function
  const register = async (userData: any) => {
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
      
      // Redirect to dashboard
      router.push('/dashboard');
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
