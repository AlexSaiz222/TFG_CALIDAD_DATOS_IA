/**
 * MetricIcon — aísla los imports de lucide-react para no contaminar
 * la inferencia de tipos de MUI Box en otros componentes.
 */
import React from 'react';
import {
  FileCheck2, Fingerprint, AlertTriangle, Clock,
  GitBranch, Scale, Braces, BarChart3,
} from 'lucide-react';

export interface IconMeta { icon: any; color: string; bg: string; }

interface MetricIconProps {
  metricName: string;
  size?: number;
  strokeWidth?: number;
}

const ICON_MAP: Record<string, IconMeta> = {
  completeness:        { icon: FileCheck2,    color: '#1976D2', bg: '#E3F2FD' },
  uniqueness:          { icon: Fingerprint,   color: '#7B2FBE', bg: '#F3E5F5' },
  outliers:            { icon: AlertTriangle, color: '#E08C00', bg: '#FFF8E1' },
  currentness:         { icon: Clock,         color: '#7C3AED', bg: '#EDE9FE' },
  logical_consistency: { icon: GitBranch,     color: '#0D7377', bg: '#E0F2F1' },
  class_balance:       { icon: Scale,         color: '#2E7D32', bg: '#E8F5E9' },
  syntactic_accuracy:  { icon: Braces,        color: '#C75000', bg: '#FBE9E7' },
};

const DEFAULT: IconMeta = { icon: BarChart3, color: '#00B37E', bg: 'rgba(0,179,126,0.1)' };

export function getIconMeta(metricName: string): IconMeta {
  return ICON_MAP[(metricName ?? '').toLowerCase()] ?? DEFAULT;
}

const MetricIcon: React.FC<MetricIconProps> = ({ metricName, size = 20, strokeWidth = 1.8 }) => {
  const meta = getIconMeta(metricName);
  const IconComp = meta.icon;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: size + 20, height: size + 20,
      borderRadius: 10, backgroundColor: meta.bg, flexShrink: 0,
    }}>
      <IconComp size={size} color={meta.color} strokeWidth={strokeWidth} />
    </div>
  );
};

export default MetricIcon;
