import axios from 'axios';

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
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized errors (token expired)
    if (error.response && error.response.status === 401) {
      // Clear local storage and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (username: string, password: string) => 
    api.post('/auth/login', { username, password }),
  
  register: (userData: any) => 
    api.post('/auth/register', userData),
  
  refreshToken: () => 
    api.post('/auth/refresh'),
  
  getProfile: () => 
    api.get('/auth/profile'),
};

// Projects API
export const projectsAPI = {
  getProjects: () => 
    api.get('/projects'),
  
  getProject: (id: number) => 
    api.get(`/projects/${id}`),
  
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
