import axios from 'axios';
import { RegisterUserData } from '../pages/register';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      // Asegurar que el token se envía correctamente
      // Asignar el token al header Authorization
      // Usar la forma más compatible con diferentes versiones de Axios
      config.headers = config.headers || {};
      // @ts-ignore - Ignorar error de tipado, esto funciona en runtime
      config.headers['Authorization'] = `Bearer ${token}`;
      
      // Log para depuración
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
      console.log('Token enviado:', `Bearer ${token.substring(0, 10)}...`);
    } else {
      console.log(`API Request sin token: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error('Error en interceptor de solicitud:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
api.interceptors.response.use(
  (response) => {
    // Log de respuestas exitosas para depuración
    console.log(`API Response Success: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  (error) => {
    // No procesar errores si no hay respuesta (problemas de red, CORS, etc.)
    if (!error.response) {
      console.error('Error de red o CORS:', error.message);
      return Promise.reject(error);
    }
    
    // Log detallado del error para depuración
    console.error(`API Error ${error.response.status}: ${error.config.method?.toUpperCase()} ${error.config.url}`);
    console.error('Datos de error:', error.response.data);
    
    // Handle 401 Unauthorized errors (token expired)
    if (error.response.status === 401) {
      // Only clear storage and redirect if we're not already on the login page
      // and if the request was NOT for auth/refresh or auth/me endpoints
      const isAuthEndpoint = error.config.url?.includes('/auth/me') || error.config.url?.includes('/auth/refresh');
      const isLoginPage = window.location.pathname === '/login';
      
      console.log('Detalles de error 401:', {
        url: error.config.url,
        isAuthEndpoint,
        isLoginPage,
        currentPath: window.location.pathname
      });
      
      // Solo redirigir si NO estamos en la página de login y si NO es un endpoint de autenticación
      // que falló por razones normales (como token expirado durante verificación)
      if (!isAuthEndpoint && !isLoginPage) {
        console.log('Sesión expirada o token inválido, redirigiendo a login');
        
        // Mostrar mensaje de error en consola para depuración
        console.error('Error de autenticación:', error.response?.data || 'No hay datos de respuesta');
        
        // Clear local storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Use router for navigation instead of direct location change
        // This will preserve React state and prevent full page reload
        if (typeof window !== 'undefined') {
          // Store the current URL to redirect back after login
          localStorage.setItem('redirectAfterLogin', window.location.pathname);
          
          // Añadir mensaje de error para mostrar en la página de login
          localStorage.setItem('loginError', 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
          
          // Usar setTimeout para evitar problemas de redirección inmediata
          setTimeout(() => {
            window.location.href = '/login';
          }, 500); // Aumentar el tiempo para evitar problemas de redirección
        }
      } else {
        console.log('Error 401 en endpoint de autenticación o ya en página de login, no redirigiendo');
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username: string, password: string) => 
    api.post('/auth/login', { username, password }),
  
  register: (userData: RegisterUserData) => 
    api.post('/auth/register', userData),
  
  refreshToken: () => 
    api.post('/auth/refresh'),
  
  getProfile: () => {
    // Obtener el token manualmente para asegurar que se envía correctamente
    const token = localStorage.getItem('token');
    return api.get('/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  },
};

// Projects API
export const projectsAPI = {
  getProjects: async () => {
    try {
      // Obtener el token manualmente para asegurar que se envía correctamente
      const token = localStorage.getItem('token');
      const res = await api.get('/projects', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      // El backend devuelve { success, projects: [...] }
      // Asegurarnos de que siempre devolvemos un array
      const projects = res.data?.projects;
      if (Array.isArray(projects)) {
        return projects;
      }
      console.error('API response for projects is not an array:', res.data);
      return [];
    } catch (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
  },
  
  getProject: (id: number) => {
    const token = localStorage.getItem('token');
    return api.get(`/projects/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  },
  
  createProject: (projectData: any) => 
    api.post('/projects', projectData),
  
  updateProject: (id: number, projectData: any) => 
    api.put(`/projects/${id}`, projectData),
  
  deleteProject: (id: number) => 
    api.delete(`/projects/${id}`),
};

// Datasets API
export const datasetsAPI = {
  getDatasets: (projectId: number) => 
    api.get(`/projects/${projectId}/datasets`),
  
  getDataset: (id: number) => 
    api.get(`/datasets/${id}`),
  
  uploadDataset: (projectId: number, formData: FormData) => 
    api.post(`/projects/${projectId}/datasets/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  
  previewDataset: (id: number) => 
    api.get(`/datasets/${id}/preview`),
  
  deleteDataset: (id: number) => 
    api.delete(`/datasets/${id}`),
};

// Metrics API
export const metricsAPI = {
  getMetrics: () => 
    api.get('/metrics'),
  
  getMetricTemplates: () => 
    api.get('/metric-templates'),
  
  getMetricTemplate: (id: number) => 
    api.get(`/metric-templates/${id}`),
  
  createMetricTemplate: (templateData: any) => 
    api.post('/metric-templates', templateData),
  
  updateMetricTemplate: (id: number, templateData: any) => 
    api.put(`/metric-templates/${id}`, templateData),
  
  deleteMetricTemplate: (id: number) => 
    api.delete(`/metric-templates/${id}`),
};

// Evaluations API
export const evaluationsAPI = {
  getEvaluations: (datasetId: number) => 
    api.get(`/datasets/${datasetId}/evaluations`),
  
  getEvaluation: (id: number) => 
    api.get(`/evaluations/${id}`),
  
  createEvaluation: (datasetId: number, metricsConfig: any) => 
    api.post(`/datasets/${datasetId}/evaluations`, { metrics_config: metricsConfig }),
  
  getIssues: (evaluationId: number) => 
    api.get(`/evaluations/${evaluationId}/issues`),
};

export default api;
