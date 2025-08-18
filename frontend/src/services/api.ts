import axios from 'axios';
import type { RegisterUserData } from '../types/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
  login: (username: string, password: string) => {
    console.log('Intentando login en: /api/auth/login');
    return api.post('/api/auth/login', { username, password });
  },
  
  register: (userData: RegisterUserData) => 
    api.post('/api/auth/register', userData),
  
  refreshToken: () => 
    api.post('/api/auth/refresh'),
  
  getProfile: () => {
    // Obtener el token manualmente para asegurar que se envía correctamente
    const token = localStorage.getItem('token');
    return api.get('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  },
  
  updateProfile: (userData: any) => {
    // Obtener el token manualmente para asegurar que se envía correctamente
    const token = localStorage.getItem('token');
    
    // Call the real PUT /api/auth/me endpoint to update the user profile
    return api.put('/api/auth/me', userData, {
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
      console.log('API: Solicitando proyectos...');
      const res = await api.get('/api/projects', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('API: Respuesta de proyectos recibida:', res);
      
      // Verificar estructura de la respuesta y normalizar
      if (!res || !res.data) {
        console.warn('API: Respuesta de proyectos sin datos');
        return [];
      }
      
      // Comprobar si la respuesta es directamente un array o tiene estructura anidada
      let projects = [];
      
      try {
        if (Array.isArray(res.data)) {
          projects = res.data;
        } else if (typeof res.data === 'object') {
          // Buscar en propiedades comunes donde podrían estar los proyectos
          if (Array.isArray(res.data.results)) {
            projects = res.data.results;
          } else if (Array.isArray(res.data.data)) {
            projects = res.data.data;
          } else if (Array.isArray(res.data.projects)) {
            projects = res.data.projects;
          } else {
            // Si no encontramos un array en ninguna propiedad conocida,
            // verificar si el objeto mismo es un proyecto único
            if (res.data.id && typeof res.data.id === 'number') {
              projects = [res.data]; // Es un único proyecto
            } else {
              console.warn('API: No se encontró estructura de proyectos reconocible');
              projects = [];
            }
          }
        } else {
          console.warn('API: Tipo de respuesta no reconocido:', typeof res.data);
          projects = [];
        }
      } catch (parseError) {
        console.error('API: Error al procesar la respuesta:', parseError);
        projects = [];
      }
      
      console.log('API: Proyectos normalizados:', projects);
      
      // Asegurar que projects sea siempre un array
      if (!Array.isArray(projects)) {
        console.warn('API: projects no es un array después de la normalización, forzando array vacío');
        projects = [];
      }
      
      // Verificar que cada elemento sea un objeto válido y tenga un id
      let validProjects = [];
      try {
        if (Array.isArray(projects)) {
          validProjects = projects.filter((project: any) => project && typeof project === 'object');
        }
      } catch (filterError) {
        console.error('API: Error al filtrar proyectos:', filterError);
      }
      
      return validProjects;
    } catch (error) {
      console.error('Error fetching projects:', error);
      // Devolver array vacío en caso de error para evitar errores en cascada
      return [];
    }
  },
  
  getProject: (id: number) => {
    const token = localStorage.getItem('token');
    return api.get(`/api/projects/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  },
  
  createProject: (projectData: any) => 
    api.post('/api/projects', projectData),
  
  updateProject: (id: number, projectData: any) => 
    api.put(`/api/projects/${id}`, projectData),
  
  deleteProject: (id: number) => 
    api.delete(`/api/projects/${id}`),
};

// Datasets API
export const datasetsAPI = {
  getDatasets: (projectId: number) => 
    api.get(`/api/projects/${projectId}/datasets`),
  
  getDataset: (id: number) => 
    api.get(`/api/datasets/${id}`),
  
  uploadDataset: (projectId: number, formData: FormData) => 
    api.post(`/api/projects/${projectId}/datasets/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),
  
  previewDataset: (id: number) => 
    api.get(`/api/datasets/${id}/preview`),
  
  deleteDataset: (id: number) => 
    api.delete(`/api/datasets/${id}`),
};

// Metrics API
export const metricsAPI = {
  getMetrics: () => 
    api.get('/api/metrics'),
  
  // Project metric configurations
  getProjectMetricConfigs: (projectId: number) => 
    api.get(`/api/projects/${projectId}/metrics/config`),
    
  saveProjectMetricConfigs: (projectId: number, configs: any) => 
    api.post(`/api/projects/${projectId}/metrics/config`, { metrics_config: configs }),
  
  validateMetricConfig: (config: any) => 
    api.post('/api/metrics/validate', { config }),
  
  // Metric templates
  getMetricTemplates: () => 
    api.get('/api/metric-templates'),
  
  getMetricTemplate: (id: number) => 
    api.get(`/api/metric-templates/${id}`),
  
  createMetricTemplate: (templateData: any) => 
    api.post('/api/metric-templates', templateData),
  
  updateMetricTemplate: (id: number, templateData: any) => 
    api.put(`/api/metric-templates/${id}`, templateData),
  
  deleteMetricTemplate: (id: number) => 
    api.delete(`/api/metric-templates/${id}`),
};

// Evaluations API
export const evaluationsAPI = {
  getEvaluations: (datasetId: number) => 
    api.get(`/api/datasets/${datasetId}/evaluations`),
  
  getEvaluation: (id: number) => 
    api.get(`/api/evaluations/${id}`),
  
  createEvaluation: (datasetId: number, metricsConfig: any) => 
    api.post(`/api/datasets/${datasetId}/evaluations`, { metrics_config: metricsConfig }),
  
  getIssues: (evaluationId: number) => 
    api.get(`/api/evaluations/${evaluationId}/issues`),
};

export default api;
