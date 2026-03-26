export const GREEN = '#00B37E';
export const GREEN_HOVER = '#00A070';
export const ORANGE = '#FFB800';
export const RED = '#E5484D';

export interface CategoryColors {
  bg: string;
  fg: string;
}

const CATEGORY_COLORS: Record<string, CategoryColors> = {
  data_quality:    { bg: 'rgba(99, 153, 34, 0.1)',   fg: '#639922' }, // verde  — "dato sano"
  data_profiling:  { bg: 'rgba(55, 138, 221, 0.1)',  fg: '#378ADD' }, // azul   — exploración
  data_validation: { bg: 'rgba(127, 119, 221, 0.1)', fg: '#7F77DD' }, // púrpura — reglas/contratos
  statistical:     { bg: 'rgba(186, 117, 23, 0.1)',  fg: '#BA7517' }, // ámbar  — métricas/números
  ml_specific:     { bg: 'rgba(212, 83, 126, 0.1)',  fg: '#D4537E' }, // rosa   — IA/ML diferenciado
  general:         { bg: 'rgba(136, 135, 128, 0.1)', fg: '#888780' }, // gris   — neutro por defecto
};

const FALLBACK: CategoryColors = { bg: 'rgba(158, 158, 158, 0.1)', fg: '#9E9E9E' };

export function categoryColor(category: string): CategoryColors {
  if (!category) return FALLBACK;
  const key = category.toLowerCase().replace(/\s+/g, '_');
  return CATEGORY_COLORS[key] || FALLBACK;
}
