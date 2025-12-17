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
  // Colors section
  { id: 'color-by-scss', name: 'Color by SCSS', icon: 'Palette', variables: [] },
  { id: 'colors', name: 'Colors', icon: 'Palette', variables: [] },
  { id: 'identity-colors', name: 'Identity Colors', icon: 'Palette', variables: [] },
  { id: 'neutral-colors', name: 'Neutral Colors', icon: 'Circle', variables: [] },
  
  // Color Combinations section
  { id: 'colors-combinations', name: 'Color Combinations', icon: 'Layers', variables: [] },
  { id: 'light-background-tones', name: 'Light Background Tones', icon: 'Sun', variables: [] },
  { id: 'dark-background-tones', name: 'Dark Background Tones', icon: 'Moon', variables: [] },
  
  // Typography section
  { id: 'typography', name: 'Typography', icon: 'Type', variables: [] },
  { id: 'font-sizes', name: 'Font Sizes', icon: 'Type', variables: [] },
  { id: 'line-heights-(pre-multiplied)', name: 'Line Heights', icon: 'AlignLeft', variables: [] },
  { id: 'base', name: 'Base', icon: 'Type', variables: [] },
  { id: 'headings', name: 'Headings', icon: 'Heading', variables: [] },
  { id: 'pre-heading', name: 'Pre-Heading', icon: 'Type', variables: [] },
  { id: 'lead', name: 'Lead', icon: 'Type', variables: [] },
  { id: 'links', name: 'Links', icon: 'Link', variables: [] },
  
  // Layout and Spacing section
  { id: 'layout-and-spacing', name: 'Layout and Spacing', icon: 'LayoutGrid', variables: [] },
  { id: 'grid', name: 'Grid', icon: 'Grid3x3', variables: [] },
  { id: 'universals', name: 'Universals', icon: 'Settings', variables: [] },
  { id: 'boxed', name: 'Boxed', icon: 'Square', variables: [] },
  { id: 'highlighted', name: 'Highlighted', icon: 'Highlighter', variables: [] },
  { id: 'alternate-module-heading', name: 'Alternate Module Heading', icon: 'Heading', variables: [] },
  
  // Header, Body and Footer section
  { id: 'header,-body-and-footer', name: 'Header, Body and Footer', icon: 'PanelTop', variables: [] },
  { id: 'header', name: 'Header', icon: 'PanelTop', variables: [] },
  { id: 'body', name: 'Body', icon: 'Square', variables: [] },
  { id: 'footer', name: 'Footer', icon: 'PanelBottom', variables: [] },
  
  // Navigation section
  { id: 'navigation', name: 'Navigation', icon: 'Menu', variables: [] },
  { id: 'main-navigation', name: 'Main Navigation', icon: 'Menu', variables: [] },
  { id: 'burger-navigation', name: 'Burger Navigation', icon: 'Menu', variables: [] },
  { id: 'mega-menu', name: 'Mega Menu', icon: 'LayoutGrid', variables: [] },
  { id: 'service-navigation', name: 'Service Navigation', icon: 'Menu', variables: [] },
  { id: 'breadcrumb-navigation', name: 'Breadcrumb Navigation', icon: 'ChevronRight', variables: [] },
  { id: 'left-navigation', name: 'Left Navigation', icon: 'PanelLeft', variables: [] },
  { id: 'search', name: 'Search', icon: 'Search', variables: [] },
  
  // Buttons section
  { id: 'buttons', name: 'Buttons', icon: 'MousePointer', variables: [] },
  { id: 'button-outline', name: 'Button Outline', icon: 'Square', variables: [] },
  { id: 'link-arrow', name: 'Link Arrow', icon: 'ArrowRight', variables: [] },
  
  // Icons section
  { id: 'icons', name: 'Icons', icon: 'Star', variables: [] },
  
  // Labels section
  { id: 'labels', name: 'Labels', icon: 'Tag', variables: [] },
  
  // Forms section
  { id: 'forms', name: 'Forms', icon: 'FormInput', variables: [] },
  
  // Hero and Ratios section
  { id: 'hero-and-ratios', name: 'Hero and Ratios', icon: 'Image', variables: [] },
  
  // Fallback
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
