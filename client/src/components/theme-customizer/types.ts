export interface CSSVariable {
  name: string;
  value: string;
  defaultValue: string;
  type: 'color' | 'font' | 'size' | 'number' | 'string';
  category: string;
  description?: string;
}

export interface VariableCategory {
  id: string;
  name: string;
  icon: string;
  variables: CSSVariable[];
}

export const defaultCategories: VariableCategory[] = [
  {
    id: 'brand-colors',
    name: 'Brand Colors',
    icon: 'Palette',
    variables: [
      { name: '--primary', value: '#3B82F6', defaultValue: '#3B82F6', type: 'color', category: 'brand-colors', description: 'Primary brand color' },
      { name: '--primary-foreground', value: '#FFFFFF', defaultValue: '#FFFFFF', type: 'color', category: 'brand-colors', description: 'Text on primary' },
      { name: '--secondary', value: '#64748B', defaultValue: '#64748B', type: 'color', category: 'brand-colors', description: 'Secondary brand color' },
      { name: '--secondary-foreground', value: '#FFFFFF', defaultValue: '#FFFFFF', type: 'color', category: 'brand-colors', description: 'Text on secondary' },
      { name: '--accent', value: '#8B5CF6', defaultValue: '#8B5CF6', type: 'color', category: 'brand-colors', description: 'Accent highlights' },
      { name: '--accent-foreground', value: '#FFFFFF', defaultValue: '#FFFFFF', type: 'color', category: 'brand-colors', description: 'Text on accent' },
    ]
  },
  {
    id: 'neutral-colors',
    name: 'Neutral Colors',
    icon: 'Circle',
    variables: [
      { name: '--background', value: '#FFFFFF', defaultValue: '#FFFFFF', type: 'color', category: 'neutral-colors', description: 'Page background' },
      { name: '--foreground', value: '#0F172A', defaultValue: '#0F172A', type: 'color', category: 'neutral-colors', description: 'Default text color' },
      { name: '--card', value: '#FFFFFF', defaultValue: '#FFFFFF', type: 'color', category: 'neutral-colors', description: 'Card background' },
      { name: '--card-foreground', value: '#0F172A', defaultValue: '#0F172A', type: 'color', category: 'neutral-colors', description: 'Card text color' },
      { name: '--muted', value: '#F1F5F9', defaultValue: '#F1F5F9', type: 'color', category: 'neutral-colors', description: 'Muted background' },
      { name: '--muted-foreground', value: '#64748B', defaultValue: '#64748B', type: 'color', category: 'neutral-colors', description: 'Muted text color' },
      { name: '--border', value: '#E2E8F0', defaultValue: '#E2E8F0', type: 'color', category: 'neutral-colors', description: 'Border color' },
      { name: '--input', value: '#E2E8F0', defaultValue: '#E2E8F0', type: 'color', category: 'neutral-colors', description: 'Input border color' },
    ]
  },
  {
    id: 'status-colors',
    name: 'Status Colors',
    icon: 'AlertCircle',
    variables: [
      { name: '--destructive', value: '#EF4444', defaultValue: '#EF4444', type: 'color', category: 'status-colors', description: 'Error/destructive actions' },
      { name: '--destructive-foreground', value: '#FFFFFF', defaultValue: '#FFFFFF', type: 'color', category: 'status-colors', description: 'Text on destructive' },
      { name: '--success', value: '#22C55E', defaultValue: '#22C55E', type: 'color', category: 'status-colors', description: 'Success state' },
      { name: '--success-foreground', value: '#FFFFFF', defaultValue: '#FFFFFF', type: 'color', category: 'status-colors', description: 'Text on success' },
      { name: '--warning', value: '#F59E0B', defaultValue: '#F59E0B', type: 'color', category: 'status-colors', description: 'Warning state' },
      { name: '--warning-foreground', value: '#FFFFFF', defaultValue: '#FFFFFF', type: 'color', category: 'status-colors', description: 'Text on warning' },
      { name: '--info', value: '#0EA5E9', defaultValue: '#0EA5E9', type: 'color', category: 'status-colors', description: 'Info state' },
      { name: '--info-foreground', value: '#FFFFFF', defaultValue: '#FFFFFF', type: 'color', category: 'status-colors', description: 'Text on info' },
    ]
  },
  {
    id: 'typography',
    name: 'Typography',
    icon: 'Type',
    variables: [
      { name: '--font-family-sans', value: 'Inter', defaultValue: 'Inter', type: 'font', category: 'typography', description: 'Sans-serif font family' },
      { name: '--font-family-serif', value: 'Georgia', defaultValue: 'Georgia', type: 'font', category: 'typography', description: 'Serif font family' },
      { name: '--font-family-mono', value: 'JetBrains Mono', defaultValue: 'JetBrains Mono', type: 'font', category: 'typography', description: 'Monospace font family' },
      { name: '--font-size-base', value: '16px', defaultValue: '16px', type: 'size', category: 'typography', description: 'Base font size' },
      { name: '--font-size-sm', value: '14px', defaultValue: '14px', type: 'size', category: 'typography', description: 'Small font size' },
      { name: '--font-size-lg', value: '18px', defaultValue: '18px', type: 'size', category: 'typography', description: 'Large font size' },
      { name: '--font-size-xl', value: '20px', defaultValue: '20px', type: 'size', category: 'typography', description: 'Extra large font size' },
      { name: '--font-size-2xl', value: '24px', defaultValue: '24px', type: 'size', category: 'typography', description: '2x large font size' },
      { name: '--font-size-3xl', value: '30px', defaultValue: '30px', type: 'size', category: 'typography', description: '3x large font size' },
      { name: '--line-height-normal', value: '1.5', defaultValue: '1.5', type: 'number', category: 'typography', description: 'Normal line height' },
      { name: '--line-height-tight', value: '1.25', defaultValue: '1.25', type: 'number', category: 'typography', description: 'Tight line height' },
      { name: '--line-height-loose', value: '1.75', defaultValue: '1.75', type: 'number', category: 'typography', description: 'Loose line height' },
      { name: '--font-weight-normal', value: '400', defaultValue: '400', type: 'number', category: 'typography', description: 'Normal font weight' },
      { name: '--font-weight-medium', value: '500', defaultValue: '500', type: 'number', category: 'typography', description: 'Medium font weight' },
      { name: '--font-weight-semibold', value: '600', defaultValue: '600', type: 'number', category: 'typography', description: 'Semibold font weight' },
      { name: '--font-weight-bold', value: '700', defaultValue: '700', type: 'number', category: 'typography', description: 'Bold font weight' },
    ]
  },
  {
    id: 'spacing',
    name: 'Spacing',
    icon: 'Move',
    variables: [
      { name: '--spacing-xs', value: '4px', defaultValue: '4px', type: 'size', category: 'spacing', description: 'Extra small spacing' },
      { name: '--spacing-sm', value: '8px', defaultValue: '8px', type: 'size', category: 'spacing', description: 'Small spacing' },
      { name: '--spacing-md', value: '16px', defaultValue: '16px', type: 'size', category: 'spacing', description: 'Medium spacing' },
      { name: '--spacing-lg', value: '24px', defaultValue: '24px', type: 'size', category: 'spacing', description: 'Large spacing' },
      { name: '--spacing-xl', value: '32px', defaultValue: '32px', type: 'size', category: 'spacing', description: 'Extra large spacing' },
      { name: '--spacing-2xl', value: '48px', defaultValue: '48px', type: 'size', category: 'spacing', description: '2x large spacing' },
      { name: '--spacing-3xl', value: '64px', defaultValue: '64px', type: 'size', category: 'spacing', description: '3x large spacing' },
    ]
  },
  {
    id: 'borders',
    name: 'Borders & Radius',
    icon: 'Square',
    variables: [
      { name: '--radius-sm', value: '4px', defaultValue: '4px', type: 'size', category: 'borders', description: 'Small border radius' },
      { name: '--radius-md', value: '6px', defaultValue: '6px', type: 'size', category: 'borders', description: 'Medium border radius' },
      { name: '--radius-lg', value: '8px', defaultValue: '8px', type: 'size', category: 'borders', description: 'Large border radius' },
      { name: '--radius-xl', value: '12px', defaultValue: '12px', type: 'size', category: 'borders', description: 'Extra large border radius' },
      { name: '--radius-full', value: '9999px', defaultValue: '9999px', type: 'size', category: 'borders', description: 'Fully rounded (pill)' },
      { name: '--border-width', value: '1px', defaultValue: '1px', type: 'size', category: 'borders', description: 'Default border width' },
      { name: '--border-width-thick', value: '2px', defaultValue: '2px', type: 'size', category: 'borders', description: 'Thick border width' },
    ]
  },
  {
    id: 'shadows',
    name: 'Shadows',
    icon: 'Layers',
    variables: [
      { name: '--shadow-sm', value: '0 1px 2px rgba(0,0,0,0.05)', defaultValue: '0 1px 2px rgba(0,0,0,0.05)', type: 'string', category: 'shadows', description: 'Small shadow' },
      { name: '--shadow-md', value: '0 4px 6px rgba(0,0,0,0.1)', defaultValue: '0 4px 6px rgba(0,0,0,0.1)', type: 'string', category: 'shadows', description: 'Medium shadow' },
      { name: '--shadow-lg', value: '0 10px 15px rgba(0,0,0,0.1)', defaultValue: '0 10px 15px rgba(0,0,0,0.1)', type: 'string', category: 'shadows', description: 'Large shadow' },
      { name: '--shadow-xl', value: '0 20px 25px rgba(0,0,0,0.15)', defaultValue: '0 20px 25px rgba(0,0,0,0.15)', type: 'string', category: 'shadows', description: 'Extra large shadow' },
    ]
  },
  {
    id: 'components',
    name: 'Components',
    icon: 'LayoutGrid',
    variables: [
      { name: '--button-height-sm', value: '32px', defaultValue: '32px', type: 'size', category: 'components', description: 'Small button height' },
      { name: '--button-height-md', value: '40px', defaultValue: '40px', type: 'size', category: 'components', description: 'Medium button height' },
      { name: '--button-height-lg', value: '48px', defaultValue: '48px', type: 'size', category: 'components', description: 'Large button height' },
      { name: '--input-height', value: '40px', defaultValue: '40px', type: 'size', category: 'components', description: 'Input field height' },
      { name: '--card-padding', value: '24px', defaultValue: '24px', type: 'size', category: 'components', description: 'Card padding' },
      { name: '--nav-height', value: '64px', defaultValue: '64px', type: 'size', category: 'components', description: 'Navigation bar height' },
      { name: '--sidebar-width', value: '280px', defaultValue: '280px', type: 'size', category: 'components', description: 'Sidebar width' },
    ]
  },
  {
    id: 'transitions',
    name: 'Transitions',
    icon: 'Zap',
    variables: [
      { name: '--transition-fast', value: '150ms', defaultValue: '150ms', type: 'size', category: 'transitions', description: 'Fast transition duration' },
      { name: '--transition-normal', value: '200ms', defaultValue: '200ms', type: 'size', category: 'transitions', description: 'Normal transition duration' },
      { name: '--transition-slow', value: '300ms', defaultValue: '300ms', type: 'size', category: 'transitions', description: 'Slow transition duration' },
      { name: '--easing-default', value: 'ease-in-out', defaultValue: 'ease-in-out', type: 'string', category: 'transitions', description: 'Default easing function' },
    ]
  },
];

export const fontOptions = [
  'Inter',
  'Open Sans',
  'Roboto',
  'Poppins',
  'Montserrat',
  'Plus Jakarta Sans',
  'DM Sans',
  'Source Serif 4',
  'Playfair Display',
  'Merriweather',
  'Lora',
  'Libre Baskerville',
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'Roboto Mono',
  'Space Mono',
  'IBM Plex Sans',
  'IBM Plex Mono',
  'Geist',
  'Geist Mono',
  'Space Grotesk',
  'Outfit',
];
