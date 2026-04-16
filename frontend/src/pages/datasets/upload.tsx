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
  Grid,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Security as SecurityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import MainLayout from '../../components/layout/MainLayout';
import { projectsAPI, datasetsAPI } from '../../services/api';
import { Project } from '../../types';
import { GREEN, GREEN_HOVER } from '../../utils/metricColors';

const steps = ['Selecciona un proyecto', 'Añade un archivo', 'Revisa y confirma'];

const DatasetUpload = () => {
  const router = useRouter();
  const { projectId: queryProjectId, parentId: queryParentId } = router.query;

  // Check if this is a new version upload
  const isNewVersion = !!queryParentId;
  const parentDatasetId = queryParentId ? Number(queryParentId) : null;

  const [activeStep, setActiveStep] = useState(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [parentDataset, setParentDataset] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    projectId: queryProjectId ? Number(queryProjectId) : 0,
    name: '',
    description: '',
    versionTag: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [sensitiveColumns, setSensitiveColumns] = useState<string[]>([]);
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
          setError('Formato de respuesta inválido del servidor');
        }
        setLoading(false);
      } catch (error) {
        console.error('Error fetching projects:', error);
        setError('Error al cargar los proyectos. Inténtalo de nuevo más tarde.');
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchParentDataset = async () => {
      if (parentDatasetId) {
        try {
          const response = await datasetsAPI.getDataset(parentDatasetId);
          const datasetData = response.data?.data || response.data;
          setParentDataset(datasetData);
        } catch (error) {
          console.error('Error fetching parent dataset:', error);
        }
      }
    };

    fetchParentDataset();
  }, [parentDatasetId]);

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
        file: 'Solo se admiten archivos CSV'
      }));
      return;
    }

    // Check file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrors(prev => ({
        ...prev,
        file: 'El archivo supera el límite de 10MB'
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

    // Parse CSV to detect columns and generate preview
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      // Strip UTF-8 BOM if present (files saved from Excel)
      const cleaned = content.startsWith('\uFEFF') ? content.slice(1) : content;
      const lines = cleaned.split('\n');

      // Extract column names from first line using delimiter auto-detection
      if (lines.length > 0) {
        const headerLine = lines[0].replace(/\r$/, ''); // Strip Windows line endings
        // Detect delimiter: pick the one that splits into the most fields
        const candidates = [',', ';', '\t', '|'];
        const delimiter = candidates.reduce((best, d) =>
          headerLine.split(d).length > headerLine.split(best).length ? d : best
        , ',');
        const columns = headerLine.split(delimiter)
          .map(col => col.trim().replace(/^"|"$/g, '')); // Strip surrounding quotes only
        setDetectedColumns(columns.filter(c => c.length > 0));
      }

      // Generate preview of first few lines
      const preview = lines.slice(0, 5).join('\n');
      setFilePreview(preview);
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
      newErrors.projectId = 'Por favor, selecciona un proyecto';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre del dataset es obligatorio';
    }

    if (!file) {
      newErrors.file = 'Por favor, sube un archivo CSV';
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
        file: 'Por favor, sube un archivo CSV'
      }));
      return;
    }

    setActiveStep(prevStep => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep(prevStep => prevStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    if (!validateForm()) {
      return;
    }

    // Ensure we only submit on the last step
    if (activeStep < steps.length - 1) {
      handleNext();
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

      // Add version tag if uploading new version
      if (isNewVersion && formData.versionTag) {
        formDataToSend.append('version_tag', formData.versionTag);
      }

      // Add sensitive columns as JSON string
      if (sensitiveColumns.length > 0) {
        formDataToSend.append('sensitive_columns', JSON.stringify(sensitiveColumns));
      }

      let response;

      if (isNewVersion && parentDatasetId) {
        // Upload as new version of existing dataset
        console.log('Uploading new version for dataset ID:', parentDatasetId);
        response = await datasetsAPI.uploadNewVersion(formData.projectId, parentDatasetId, formDataToSend);
      } else {
        // Upload as new dataset
        console.log('Uploading dataset to project ID:', formData.projectId);
        response = await datasetsAPI.uploadDataset(formData.projectId, formDataToSend);
      }
      console.log('Upload response:', response);

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
      setError(error.response?.data?.message || 'Error al subir el dataset. Inténtalo de nuevo.');
      setUploading(false);
    }
  };

  return (
    <MainLayout>
      <Box sx={{
        mb: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        px: 2
      }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 3,
          width: '100%',
          maxWidth: 900
        }}>
          <IconButton
            onClick={() => router.back()}
            sx={{ mr: 2 }}
            aria-label="back"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            {isNewVersion ? 'Subir nueva versión' : 'Subir dataset'}
          </Typography>
          {isNewVersion && parentDataset && (
            <Box sx={{
              ml: 2,
              px: 1.5,
              py: 0.5,
              backgroundColor: 'rgba(23, 69, 79, 0.1)',
              borderRadius: 1,
              color: '#17454F',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}>
              Nueva versión de {parentDataset.name}
            </Box>
          )}
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 2,
            border: '1px solid #EEEEEE',
            maxWidth: 900,
            width: '100%',
            boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.08)',
          }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 3, width: '100%', maxWidth: 900 }}>
              {error}
            </Alert>
          )}

          {/* Stepper */}
          <Box sx={{ width: '100%', maxWidth: 900, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', px: 2 }}>
              {/* Progress line track */}
              <Box sx={{
                position: 'absolute', top: 20, left: '16.66%', right: '16.66%',
                height: 3, bgcolor: '#E0E0E0', borderRadius: 1.5, zIndex: 0,
              }}>
                {/* Progress line fill */}
                <Box sx={{
                  width: activeStep === 0 ? '0%' : activeStep === 1 ? '50%' : '100%',
                  height: '100%', bgcolor: GREEN, borderRadius: 1.5,
                  transition: 'width 0.3s ease-in-out',
                }} />
              </Box>

              {steps.map((label, index) => {
                const isActive = index === activeStep;
                const isCompleted = index < activeStep;
                return (
                  <Box key={label} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, zIndex: 1 }}>
                    <Box sx={{
                      width: 40, height: 40, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: isCompleted || isActive ? GREEN : '#E0E0E0',
                      color: isCompleted || isActive ? '#FFFFFF' : '#999999',
                      fontWeight: 700, fontSize: '1rem', mb: 1,
                      transition: 'all 0.3s ease-in-out',
                      border: isActive ? `3px solid ${GREEN}` : 'none',
                      boxShadow: isActive ? '0 0 0 4px rgba(0,179,126,0.15)' : 'none',
                    }}>
                      {isCompleted ? <CheckCircleIcon sx={{ fontSize: 20, color: '#FFFFFF' }} /> : index + 1}
                    </Box>
                    <Typography variant="body2" sx={{
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? '#1A1A1A' : isCompleted ? '#555' : '#999',
                      fontSize: '0.875rem', textAlign: 'center',
                      transition: 'all 0.3s ease-in-out',
                    }}>
                      {label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Box>
            {activeStep === 0 && (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Selecciona un proyecto
                </Typography>

                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <FormControl fullWidth error={!!errors.projectId}>
                    <InputLabel id="project-select-label">Proyecto</InputLabel>
                    <Select
                      labelId="project-select-label"
                      id="projectId"
                      name="projectId"
                      value={formData.projectId || ''}
                      label="Proyecto"
                      onChange={handleChange}
                    >
                      <MenuItem value={0} disabled>
                        Selecciona un proyecto
                      </MenuItem>
                      {projects && projects.length > 0 ? projects.map((project) => (
                        <MenuItem key={project.id} value={project.id}>
                          {project.name}
                        </MenuItem>
                      )) : (
                        <MenuItem disabled>No hay proyectos disponibles</MenuItem>
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
                  Subir archivo
                </Typography>

                <Box
                  {...getRootProps()}
                  sx={{
                    border: '2px dashed',
                    borderColor: isDragActive ? '#00B37E' : errors.file ? '#E5484D' : '#CCCCCC',
                    borderRadius: 2,
                    p: 3, // Reduced padding
                    mb: 3,
                    textAlign: 'center',
                    backgroundColor: isDragActive ? 'rgba(0, 179, 126, 0.05)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    height: 'auto', // Allow height to adjust to content
                    minHeight: '100px', // Set minimum height
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
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
                        {isDragActive ? 'Suelta el archivo CSV aquí' : 'Arrastra y suelta un archivo CSV aquí, o haz clic para seleccionar'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Solo se admiten archivos CSV (máx. 10MB)
                      </Typography>
                    </Box>
                  )}
                </Box>

                {errors.file && (
                  <Typography color="error" variant="body2" sx={{ mb: 2 }}>
                    {errors.file}
                  </Typography>
                )}



                <TextField
                  fullWidth
                  label="Nombre del dataset"
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
                  label="Descripción"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  multiline
                  rows={3}
                  sx={{ mb: 3 }}
                  placeholder="Introduce una descripción para el dataset (opcional)"
                />

                {isNewVersion && (
                  <TextField
                    fullWidth
                    label="Etiqueta de versión (opcional)"
                    name="versionTag"
                    value={formData.versionTag}
                    onChange={handleChange}
                    sx={{ mb: 3 }}
                    placeholder="Ej: v2.0, corregido, final, etc."
                    helperText="Una etiqueta descriptiva para identificar esta versión"
                  />
                )}
              </Box>
            )}

            {activeStep === 2 && (
              <Box>
                <Typography variant="h5" sx={{ mb: 4, fontWeight: 700, color: '#1A1A1A' }}>
                  Resumen y anonimización
                </Typography>

                {/* Resumen del Dataset */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
                    Resumen del Dataset
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, bgcolor: '#FAFAFA', borderColor: '#EAEAEA' }}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>Proyecto</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {projects && projects.find(p => p.id === formData.projectId)?.name || 'Unknown Project'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>Nombre del Dataset</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {formData.name}
                        </Typography>
                      </Grid>
                      {formData.description && (
                        <Grid item xs={12}>
                          <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>Descripción</Typography>
                          <Typography variant="body2" sx={{ color: '#444' }}>
                            {formData.description}
                          </Typography>
                        </Grid>
                      )}
                      <Grid item xs={12}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: '#FFF', borderRadius: 1, border: '1px solid #EEE' }}>
                          <DescriptionIcon sx={{ color: GREEN, fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {file?.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#888', ml: 'auto' }}>
                            ({(file?.size ? (file.size / 1024 / 1024).toFixed(2) : 0)} MB)
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Paper>
                </Box>

                {/* Sensitive Columns Selector */}
                {detectedColumns.length > 0 && (
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
                      Privacidad de Datos
                    </Typography>
                    <Box sx={{ p: 3, border: '1px solid #FFE0E0', borderRadius: 2, backgroundColor: '#FFF5F5' }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
                        <Box sx={{ bgcolor: '#FFE0E0', p: 1, borderRadius: '50%', display: 'flex' }}>
                          <SecurityIcon sx={{ color: '#E5484D', fontSize: 24 }} />
                        </Box>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#E5484D', mb: 0.5 }}>
                            Selección de columnas sensibles
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#666' }}>
                            Es crucial proteger la información personal. Por favor, selecciona a continuación cualquier columna que contenga datos confidenciales.
                            <strong> Sus valores serán enmascarados/anonimizados automáticamente.</strong>
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {detectedColumns.map((column) => {
                          const isSelected = sensitiveColumns.includes(column);
                          return (
                            <Box
                              key={column}
                              onClick={() => {
                                setSensitiveColumns(prev =>
                                  prev.includes(column)
                                    ? prev.filter(c => c !== column)
                                    : [...prev, column]
                                );
                              }}
                              sx={{
                                px: 2,
                                py: 1,
                                border: isSelected ? '2px solid #E5484D' : '1px solid #DDD',
                                borderRadius: 2,
                                backgroundColor: isSelected ? 'rgba(229,72,77,0.08)' : '#FFF',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                transition: 'all 0.2s',
                                '&:hover': {
                                  borderColor: '#E5484D',
                                  backgroundColor: 'rgba(229,72,77,0.04)',
                                },
                              }}
                            >
                              {isSelected && <VisibilityOffIcon sx={{ fontSize: 16, color: '#E5484D' }} />}
                              <Typography variant="body2" sx={{ fontWeight: isSelected ? 600 : 500, color: isSelected ? '#E5484D' : '#333' }}>
                                {column}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                      {sensitiveColumns.length > 0 && (
                        <Typography variant="body2" sx={{ color: '#E5484D', mt: 2, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <VisibilityOffIcon sx={{ fontSize: 16 }} />
                          {sensitiveColumns.length} columna{sensitiveColumns.length !== 1 ? 's' : ''} protegida{sensitiveColumns.length !== 1 ? 's' : ''}.
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}


              </Box>
            )}

            {/* ===== Navigation buttons ===== */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 2, borderTop: '1px solid #EEE' }}>
              <Button
                type="button"
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
                {activeStep === 0 ? 'Cancelar' : 'Anterior'}
              </Button>

              {activeStep === steps.length - 1 ? (
                <Button
                  onClick={handleSubmit}
                  variant="contained"
                  disabled={uploading}
                  sx={{
                    backgroundColor: GREEN,
                    color: '#FFFFFF',
                    px: 4,
                    '&:hover': {
                      backgroundColor: GREEN_HOVER,
                    },
                  }}
                >
                  {uploading ? <CircularProgress size={20} color="inherit" /> : 'Subir dataset'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="contained"
                  onClick={handleNext}
                  sx={{
                    backgroundColor: GREEN,
                    color: '#FFFFFF',
                    '&:hover': {
                      backgroundColor: GREEN_HOVER,
                    },
                  }}
                >
                  Siguiente
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
