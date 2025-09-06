import React, { useState } from 'react';
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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import MainLayout from '../../components/layout/MainLayout';
import { projectsAPI } from '../../services/api';
import { safeNavigate } from '../../utils/routeTransition';

const NewProject = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await projectsAPI.createProject(formData);
      const newProject = response.data;
      
      // Clear projects cache to ensure the new project appears in the list
      if (window.localStorage) {
        // This will force a refresh of the projects list
        localStorage.removeItem('projectsCache');
      }
      
      // Use safe navigation to prevent route transition issues
      safeNavigate(`/projects/${newProject.id || newProject.data?.id}`);
    } catch (error: any) {
      console.error('Error creating project:', error);
      setError(error.response?.data?.message || 'Failed to create project. Please try again.');
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        mb: 4,
        px: 3 // Add horizontal padding for small screens
      }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mb: 3,
          width: '100%',
          maxWidth: 700 // Increased max width
        }}>
          <IconButton 
            onClick={() => router.back()} 
            sx={{ mr: 2 }}
            aria-label="back"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1A1A1A' }}>
            New Project
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 }, // Increased padding
            borderRadius: 2,
            border: '1px solid #EEEEEE',
            width: '100%',
            maxWidth: 700, // Increased max width
            boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.08)', // Slightly stronger shadow
          }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              fullWidth
              label="Project Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={!!errors.name}
              helperText={errors.name}
              sx={{ mb: 2 }}
              required
              size="small"
              variant="outlined"
            />
            
            <TextField
              fullWidth
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              multiline
              rows={4} // Increased rows
              sx={{ mb: 4 }}
              placeholder="Enter a description for your project (optional)"
              size="small"
              variant="outlined"
            />
            
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: 2,
              mt: 2
            }}>
              <Button
                variant="outlined"
                onClick={() => router.back()}
                disabled={loading}
                sx={{
                  borderColor: '#CCCCCC',
                  color: '#555555',
                  px: 3,
                  py: 1,
                  '&:hover': {
                    borderColor: '#AAAAAA',
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  backgroundColor: '#00B37E',
                  color: '#FFFFFF',
                  px: 3,
                  py: 1,
                  '&:hover': {
                    backgroundColor: '#00A070',
                  },
                }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Create project'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>
    </MainLayout>
  );
};

export default NewProject;
