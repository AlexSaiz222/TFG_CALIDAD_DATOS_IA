import React from 'react';
import { useRouter } from 'next/router';
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography, Box } from '@mui/material';
import {
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  currentPage?: string;
}

// Mapeo de rutas a nombres legibles en español (sin capitalización innecesaria)
const routeLabels: Record<string, string> = {
  dashboard: 'Panel principal',
  projects: 'Proyectos',
  datasets: 'Datasets',
  evaluations: 'Historial de análisis',
  profile: 'Perfil',
  settings: 'Configuración',
  new: 'Nuevo',
  upload: 'Subir',
  compare: 'Comparar',
  runs: 'Análisis',
  metrics: 'Métricas',
  configure: 'Configurar',
};

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items, currentPage }) => {
  const router = useRouter();
  const pathSegments = router.asPath.split('?')[0].split('/').filter(Boolean);

  // Si se proporcionan items personalizados, usarlos
  if (items && items.length > 0) {
    return (
      <Box sx={{ mb: 2 }}>
        <MuiBreadcrumbs
          separator={<NavigateNextIcon fontSize="small" sx={{ color: '#999' }} />}
          aria-label="breadcrumb"
          sx={{
            '& .MuiBreadcrumbs-li': {
              display: 'flex',
              alignItems: 'center',
            },
          }}
        >
          <Link
            href="/dashboard"
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: '#666',
              textDecoration: 'none',
              '&:hover': {
                color: '#00B37E',
                textDecoration: 'underline',
              },
            }}
          >
            <HomeIcon sx={{ fontSize: 18, mr: 0.5 }} />
            Inicio
          </Link>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            
            if (isLast || !item.href) {
              return (
                <Typography
                  key={index}
                  sx={{
                    color: '#1A1A1A',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                  }}
                >
                  {item.label}
                </Typography>
              );
            }

            return (
              <Link
                key={index}
                href={item.href}
                sx={{
                  color: '#666',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  '&:hover': {
                    color: '#00B37E',
                    textDecoration: 'underline',
                  },
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </MuiBreadcrumbs>
      </Box>
    );
  }

  // Generar breadcrumbs automáticamente desde la ruta
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [];
    let currentPath = '';

    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === pathSegments.length - 1;
      
      // Detectar si es un ID dinámico (número o UUID)
      const isId = /^\d+$/.test(segment) || /^[a-f0-9-]{36}$/.test(segment);
      
      let label = routeLabels[segment] || segment;
      
      // Si es un ID, usar un label genérico o el currentPage si es el último
      if (isId) {
        if (isLast && currentPage) {
          label = currentPage;
        } else {
          // Intentar inferir el tipo de entidad del segmento anterior
          const prevSegment = pathSegments[index - 1];
          if (prevSegment === 'projects') label = 'Proyecto';
          else if (prevSegment === 'datasets') label = 'Dataset';
          else if (prevSegment === 'evaluations') label = 'Análisis';
          else if (prevSegment === 'runs') label = 'Ejecución';
          else label = `#${segment}`;
        }
      }

      breadcrumbs.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    });

    return breadcrumbs;
  };

  const autoBreadcrumbs = generateBreadcrumbs();

  if (autoBreadcrumbs.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      <MuiBreadcrumbs
        separator={<NavigateNextIcon fontSize="small" sx={{ color: '#999' }} />}
        aria-label="breadcrumb"
        sx={{
          '& .MuiBreadcrumbs-li': {
            display: 'flex',
            alignItems: 'center',
          },
        }}
      >
        <Link
          href="/dashboard"
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: '#666',
            textDecoration: 'none',
            fontSize: '0.875rem',
            '&:hover': {
              color: '#00B37E',
              textDecoration: 'underline',
            },
          }}
        >
          <HomeIcon sx={{ fontSize: 18, mr: 0.5 }} />
          Inicio
        </Link>
        {autoBreadcrumbs.map((item, index) => {
          const isLast = index === autoBreadcrumbs.length - 1;

          if (isLast) {
            return (
              <Typography
                key={index}
                sx={{
                  color: '#1A1A1A',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                {item.label}
              </Typography>
            );
          }

          return (
            <Link
              key={index}
              href={item.href || '#'}
              sx={{
                color: '#666',
                textDecoration: 'none',
                fontSize: '0.875rem',
                '&:hover': {
                  color: '#00B37E',
                  textDecoration: 'underline',
                },
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </MuiBreadcrumbs>
    </Box>
  );
};

export default Breadcrumbs;
