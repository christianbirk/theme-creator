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
  { id: 'brand-colors', name: 'Brand Colors', icon: 'Palette', variables: [] },
  { id: 'neutral-colors', name: 'Neutral Colors', icon: 'Circle', variables: [] },
  { id: 'color-combinations', name: 'Color Combinations', icon: 'Layers', variables: [] },
  { id: 'typography', name: 'Typography', icon: 'Type', variables: [] },
  { id: 'layout', name: 'Layout & Spacing', icon: 'LayoutGrid', variables: [] },
  { id: 'borders', name: 'Borders & Radius', icon: 'Square', variables: [] },
  { id: 'shadows', name: 'Shadows', icon: 'Layers', variables: [] },
  { id: 'header-footer', name: 'Header & Footer', icon: 'PanelTop', variables: [] },
  { id: 'navigation', name: 'Navigation', icon: 'Menu', variables: [] },
  { id: 'search', name: 'Search', icon: 'Search', variables: [] },
  { id: 'buttons', name: 'Buttons', icon: 'MousePointer', variables: [] },
  { id: 'icons', name: 'Icons', icon: 'Star', variables: [] },
  { id: 'labels', name: 'Labels', icon: 'Tag', variables: [] },
  { id: 'forms', name: 'Forms', icon: 'FormInput', variables: [] },
  { id: 'hero-ratios', name: 'Hero & Ratios', icon: 'Image', variables: [] },
  { id: 'transitions', name: 'Transitions', icon: 'Zap', variables: [] },
  { id: 'other', name: 'Other', icon: 'Settings', variables: [] },
];

export const fontOptions = [
  'Inter',
  'Arial',
  'Open Sans',
  'Roboto',
  'Roboto Flex',
  'Poppins',
  'Montserrat',
  'Plus Jakarta Sans',
  'DM Sans',
  'DM Serif',
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
  'Mulish',
  'Work Sans',
];
