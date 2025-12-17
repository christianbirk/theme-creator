export interface CSSVariable {
  name: string;
  value: string;
  defaultValue: string;
  type: 'color' | 'font' | 'size' | 'number' | 'string';
  category: string;
  mainSection: string;
  subSection: string;
  description?: string;
}

export interface VariableCategory {
  id: string;
  name: string;
  icon: string;
  variables: CSSVariable[];
}

export interface SectionStructure {
  id: string;
  name: string;
  icon: string;
  subSections: {
    id: string;
    name: string;
    variables: CSSVariable[];
  }[];
}

export const defaultCategories: VariableCategory[] = [
  { id: 'colors', name: 'Colors', icon: 'Palette', variables: [] },
  { id: 'colors-combinations', name: 'Color Combinations', icon: 'Layers', variables: [] },
  { id: 'typography', name: 'Typography', icon: 'Type', variables: [] },
  { id: 'layout-and-spacing', name: 'Layout and Spacing', icon: 'LayoutGrid', variables: [] },
  { id: 'header,-body-and-footer', name: 'Header, Body and Footer', icon: 'PanelTop', variables: [] },
  { id: 'navigation', name: 'Navigation', icon: 'Menu', variables: [] },
  { id: 'buttons', name: 'Buttons', icon: 'MousePointer', variables: [] },
  { id: 'icons', name: 'Icons', icon: 'Star', variables: [] },
  { id: 'labels', name: 'Labels', icon: 'Tag', variables: [] },
  { id: 'forms', name: 'Forms', icon: 'FormInput', variables: [] },
  { id: 'hero-and-ratios', name: 'Hero and Ratios', icon: 'Image', variables: [] },
  { id: 'other', name: 'Other', icon: 'Settings', variables: [] },
];

export const sectionIcons: Record<string, string> = {
  'colors': 'Palette',
  'colors-combinations': 'Layers',
  'typography': 'Type',
  'layout-and-spacing': 'LayoutGrid',
  'header,-body-and-footer': 'PanelTop',
  'navigation': 'Menu',
  'buttons': 'MousePointer',
  'icons': 'Star',
  'labels': 'Tag',
  'forms': 'FormInput',
  'hero-and-ratios': 'Image',
};

export function formatVariableName(name: string): string {
  return name
    .replace(/^--/, '')
    .replace(/-/g, ' ');
}

export function formatSectionName(id: string): string {
  return id
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/,\s*/g, ', ');
}

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
