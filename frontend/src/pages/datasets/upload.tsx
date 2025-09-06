import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Stepper,
  Step,
  StepLabel,
  SelectChangeEvent,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import MainLayout from '../../components/layout/MainLayout';
import { projectsAPI, datasetsAPI } from '../../services/api';
import { Project } from '../../types';

const steps = ['Select Project', 'Upload File', 'Review & Confirm'];

const DatasetUpload = () => {
  const router = useRouter();
  const { projectId: queryProjectId } = router.query;
  
  const [activeStep, setActiveStep] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    projectId: queryProjectId ? Number(queryProjectId) : 0,
    name: '',
    description: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const projects = await projectsAPI.getProjects();
        // projectsAPI.getProjects already returns the array directly
        if (Array.isArray(projects)) {
          setProjects(projects);
        } else {
          // Handle unexpected response format
          setProjects([]);
          setError('Invalid response format from server');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setError('Failed to load projects. Please try again later.');
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    // Set project ID from query parameter if available
    if (queryProjectId && !formData.projectId) {
      setFormData(prev => ({
        ...prev,
        projectId: Number(queryProjectId)
      }));
      
      // If project ID is provided, skip to step 2
      setActiveStep(1);
    }
  }, [queryProjectId, formData.projectId]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const selectedFile = acceptedFiles[0];
    
    // Check if file is CSV
    if (!selectedFile.name.endsWith('.csv')) {
      setErrors(prev => ({
        ...prev,
        file: 'Only CSV files are supported'
      }));
      return;
    }
    
    // Check file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrors(prev => ({
        ...prev,
        file: 'File size exceeds 10MB limit'
      }));
      return;
    }
    
    setFile(selectedFile);
    
    // Set default name from filename if not already set
    if (!formData.name) {
      const fileName = selectedFile.name.replace('.csv', '');
      setFormData(prev => ({
        ...prev,
        name: fileName
      }));
    }
    
    // Clear file error if exists
    if (errors.file) {
      setErrors(prev => ({
        ...prev,
        file: ''
      }));
    }
    
    // Generate preview of first few lines
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const lines = content.split('\n').slice(0, 5).join('\n');
      setFilePreview(lines);
    };
    reader.readAsText(selectedFile);
  }, [formData.name, errors.file]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    maxFiles: 1
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }> | SelectChangeEvent<number>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name as string]: value
    }));
    
    // Clear error when field is edited
    if (errors[name as string]) {
      setErrors(prev => ({
        ...prev,
        [name as string]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.projectId) {
      newErrors.projectId = 'Please select a project';
    }
    
    if (!formData.name.trim()) {
      newErrors.name = 'Dataset name is required';
    }
    
    if (!file) {
      newErrors.file = 'Please upload a CSV file';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (activeStep === 0 && !formData.projectId) {
      setErrors(prev => ({
        ...prev,
        projectId: 'Please select a project'
      }));
      return;
    }
    
    if (activeStep === 1 && !file) {
      setErrors(prev => ({
        ...prev,
        file: 'Please upload a CSV file'
      }));
      return;
    }
    
    setActiveStep(prevStep => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep(prevStep => prevStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      
      if (formData.description) {
        formDataToSend.append('description', formData.description);
      }
      
      if (file) {
        formDataToSend.append('file', file);
      }
      
      // Log the request for debugging
      console.log('Uploading dataset to project ID:', formData.projectId);
      
      const response = await datasetsAPI.uploadDataset(formData.projectId, formDataToSend);
      console.log('uploadDataset response:', response);
      
      // Normalize the response structure to handle different API response formats
      // This handles nested data structures like {data: {data: {...}}} or {data: {...}}
      const payload = response?.data?.data ?? response?.data ?? response;
      const datasetId = payload?.id ?? payload?.dataset?.id;
      
      if (!datasetId) {
        console.error('Dataset ID not found in response:', response);
        setError('Upload complete, pero no pude obtener el ID del dataset del servidor.');
        setUploading(false);
        return;
      }
      
      console.log('Successfully extracted dataset ID:', datasetId);
      
      // Use replace instead of push to prevent the upload page from staying in history
      router.replace(`/datasets/${datasetId}`);
    } catch (error: any) {
      console.error('Error uploading dataset:', error);
      setError(error.response?.data?.message || 'Failed to upload dataset. Please try again.');
      setUploading(false);
    }
  };

  return (
    <MainLayout>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton 
            onClick={() => router.back()} 
            sx={{ mr: 2 }}
            aria-label="back"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            Upload Dataset
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 2,
            border: '1px solid #EEEEEE',
            maxWidth: 800,
          }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel
                  sx={{
                    // Círculo activo
                    '& .MuiStepIcon-root.Mui-active': {
                      color: '#00B37E',
                    },
                    // Círculo completado
                    '& .MuiStepIcon-root.Mui-completed': {
                      color: '#00B37E',
                    },
                    // Círculo inactivo
                    '& .MuiStepIcon-root': {
                      color: '#CCCCCC',
                    },
                    // Texto dentro del círculo (número)
                    '& .MuiStepIcon-text': {
                      fill: '#FFFFFF !important', // siempre blanco
                      fontWeight: 'bold',         // en negrita
                    },
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box component="form" onSubmit={handleSubmit}>
            {activeStep === 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Select Project
                </Typography>
                
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <FormControl fullWidth error={!!errors.projectId}>
                    <InputLabel id="project-select-label">Project</InputLabel>
                    <Select
                      labelId="project-select-label"
                      id="projectId"
                      name="projectId"
                      value={formData.projectId || ''}
                      label="Project"
                      onChange={handleChange}
                    >
                      <MenuItem value={0} disabled>
                        Select a project
                      </MenuItem>
                      {projects && projects.length > 0 ? projects.map((project) => (
                        <MenuItem key={project.id} value={project.id}>
                          {project.name}
                        </MenuItem>
                      )) : (
                        <MenuItem disabled>No projects available</MenuItem>
                      )}
                    </Select>
                    {errors.projectId && (
                      <FormHelperText>{errors.projectId}</FormHelperText>
                    )}
                  </FormControl>
                )}
              </Box>
            )}

            {activeStep === 1 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Upload File
                </Typography>
                
                <Box
                  {...getRootProps()}
                  sx={{
                    border: '2px dashed',
                    borderColor: isDragActive ? '#00B37E' : errors.file ? '#E5484D' : '#CCCCCC',
                    borderRadius: 2,
                    p: 4,
                    mb: 3,
                    textAlign: 'center',
                    backgroundColor: isDragActive ? 'rgba(0, 179, 126, 0.05)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      borderColor: '#00B37E',
                      backgroundColor: 'rgba(0, 179, 126, 0.05)',
                    },
                  }}
                >
                  <input {...getInputProps()} />
                  {file ? (
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
                        {file.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </Typography>
                    </Box>
                  ) : (
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 500, mb: 1 }}>
                        {isDragActive ? 'Drop the CSV file here' : 'Drag & drop a CSV file here, or click to select'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Only CSV files are supported (max 10MB)
                      </Typography>
                    </Box>
                  )}
                </Box>
                
                {errors.file && (
                  <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                    {errors.file}
                  </Typography>
                )}
                
                {filePreview && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      Preview:
                    </Typography>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        backgroundColor: '#F5F5F5',
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        overflow: 'auto',
                        maxHeight: '200px',
                      }}
                    >
                      <pre style={{ margin: 0 }}>{filePreview}</pre>
                    </Paper>
                  </Box>
                )}
                
                <TextField
                  fullWidth
                  label="Dataset Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  error={!!errors.name}
                  helperText={errors.name}
                  sx={{ mb: 3 }}
                  required
                />
                
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  multiline
                  rows={3}
                  sx={{ mb: 3 }}
                  placeholder="Enter a description for your dataset (optional)"
                />
              </Box>
            )}

            {activeStep === 2 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 3 }}>
                  Review & Confirm
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    Project
                  </Typography>
                  <Typography variant="body1">
                    {projects && projects.find(p => p.id === formData.projectId)?.name || 'Unknown Project'}
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    Dataset Name
                  </Typography>
                  <Typography variant="body1">
                    {formData.name}
                  </Typography>
                </Box>
                
                {formData.description && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                      Description
                    </Typography>
                    <Typography variant="body1">
                      {formData.description}
                    </Typography>
                  </Box>
                )}
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    File
                  </Typography>
                  <Typography variant="body1">
                    {file?.name} ({(file?.size ? (file.size / 1024 / 1024).toFixed(2) : 0)} MB)
                  </Typography>
                </Box>
                
                {filePreview && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>
                      Preview:
                    </Typography>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        backgroundColor: '#F5F5F5',
                        borderRadius: 1,
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        overflow: 'auto',
                        maxHeight: '200px',
                      }}
                    >
                      <pre style={{ margin: 0 }}>{filePreview}</pre>
                    </Paper>
                  </Box>
                )}
              </Box>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                variant="outlined"
                onClick={activeStep === 0 ? () => router.back() : handleBack}
                disabled={uploading}
                sx={{
                  borderColor: '#CCCCCC',
                  color: '#555555',
                  '&:hover': {
                    borderColor: '#AAAAAA',
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                {activeStep === 0 ? 'Cancel' : 'Back'}
              </Button>
              
              {activeStep === steps.length - 1 ? (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={uploading}
                  sx={{
                    backgroundColor: '#00B37E',
                    color: '#FFFFFF',
                    '&:hover': {
                      backgroundColor: '#00A070',
                    },
                  }}
                >
                  {uploading ? <CircularProgress size={24} /> : 'Upload Dataset'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  sx={{
                    backgroundColor: '#00B37E',
                    color: '#FFFFFF',
                    '&:hover': {
                      backgroundColor: '#00A070',
                    },
                  }}
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      </Box>
    </MainLayout>
  );
};

export default DatasetUpload;
