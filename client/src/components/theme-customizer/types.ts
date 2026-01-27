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
  { id: 'grid', name: 'Grid', icon: 'Grid3X3', variables: [] },
  { id: 'layout', name: 'Layout', icon: 'LayoutGrid', variables: [] },
  { id: 'header,-body-and-footer', name: 'Header, Body and Footer', icon: 'PanelTop', variables: [] },
  { id: 'navigation', name: 'Navigation', icon: 'Menu', variables: [] },
  { id: 'buttons', name: 'Buttons', icon: 'MousePointer', variables: [] },
  { id: 'icons', name: 'Icons', icon: 'Star', variables: [] },
  { id: 'labels', name: 'Labels', icon: 'Tag', variables: [] },
  { id: 'forms', name: 'Forms', icon: 'FormInput', variables: [] },
  { id: 'aspect-ratios', name: 'Aspect Ratios', icon: 'Image', variables: [] },
  { id: 'other', name: 'Other', icon: 'Settings', variables: [] },
];

export const sectionIcons: Record<string, string> = {
  'colors': 'Palette',
  'colors-combinations': 'Layers',
  'typography': 'Type',
  'grid': 'Grid3X3',
  'layout': 'LayoutGrid',
  'header,-body-and-footer': 'PanelTop',
  'navigation': 'Menu',
  'buttons': 'MousePointer',
  'icons': 'Star',
  'labels': 'Tag',
  'forms': 'FormInput',
  'aspect-ratios': 'Image',
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

// Comprehensive Google Fonts list - top 300+ fonts by popularity
export const googleFonts = [
  // Sans-serif
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Inter', 'Oswald', 'Raleway', 'Nunito',
  'Ubuntu', 'Rubik', 'Nunito Sans', 'Work Sans', 'Fira Sans', 'Quicksand', 'Barlow', 'Heebo',
  'Mulish', 'Kanit', 'Manrope', 'DM Sans', 'Karla', 'Cabin', 'Hind', 'Exo 2', 'Oxygen', 'Arimo',
  'Josefin Sans', 'Catamaran', 'Teko', 'Mukta', 'Archivo', 'Overpass', 'Abel', 'Signika', 'Varela Round',
  'Assistant', 'Cairo', 'Asap', 'Barlow Condensed', 'Maven Pro', 'Prompt', 'Questrial', 'Rajdhani',
  'Tajawal', 'Gothic A1', 'Sarabun', 'Cuprum', 'Outfit', 'Urbanist', 'Lexend', 'Figtree', 'Sora',
  'Space Grotesk', 'Plus Jakarta Sans', 'Albert Sans', 'Red Hat Display', 'Be Vietnam Pro', 'Wix Madefor Display',
  'Onest', 'Public Sans', 'Bricolage Grotesque', 'Gabarito', 'Geist', 'Instrument Sans',
  'Noto Sans', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans SC', 'Noto Sans TC', 'Noto Sans Arabic',
  'Source Sans 3', 'Source Sans Pro', 'Roboto Flex', 'Roboto Condensed', 'IBM Plex Sans',
  'IBM Plex Sans Arabic', 'IBM Plex Sans Condensed', 'PT Sans', 'PT Sans Caption', 'PT Sans Narrow',
  'Libre Franklin', 'Hind Siliguri', 'Hind Madurai', 'Hind Vadodara', 'Titillium Web', 'Comfortaa',
  'Exo', 'Yanone Kaffeesatz', 'Anton', 'Acme', 'Righteous', 'Francois One', 'Russo One', 'Bebas Neue',
  'Archivo Black', 'Archivo Narrow', 'Pathway Gothic One', 'Pathway Extreme', 'Jost', 'Sen',
  'Commissioner', 'Epilogue', 'Readex Pro', 'Almarai', 'Chivo', 'Actor', 'News Cycle', 'Gudea',
  'Ruda', 'Pontano Sans', 'Carrois Gothic', 'Mada', 'Cantarell', 'Encode Sans', 'Encode Sans Condensed',
  'Encode Sans Expanded', 'Scada', 'Adamina', 'Basic', 'Armata', 'Michroma', 'Metrophobic',

  // Serif
  'Playfair Display', 'Merriweather', 'Lora', 'PT Serif', 'Libre Baskerville', 'Source Serif 4',
  'Source Serif Pro', 'Crimson Text', 'EB Garamond', 'Cormorant Garamond', 'Bitter', 'Domine',
  'Cardo', 'Spectral', 'Noto Serif', 'Noto Serif JP', 'IBM Plex Serif', 'DM Serif Display', 'DM Serif Text',
  'Vollkorn', 'Frank Ruhl Libre', 'Cormorant', 'Cormorant Infant', 'Old Standard TT', 'Cinzel',
  'Cinzel Decorative', 'Alike', 'Amiri', 'Arvo', 'Alegreya', 'Alegreya Sans', 'Bodoni Moda',
  'Fraunces', 'Newsreader', 'Literata', 'Petrona', 'Belleza', 'Rufina', 'Sorts Mill Goudy',
  'Gilda Display', 'Prata', 'Yeseva One', 'Martel', 'Marcellus', 'Vesper Libre', 'Mate',
  'Lustria', 'Fanwood Text', 'Gentium Book Plus', 'Neuton', 'Crimson Pro', 'Brygada 1918',
  'Young Serif', 'Instrument Serif', 'Platypi',

  // Display
  'Lobster', 'Abril Fatface', 'Alfa Slab One', 'Bungee', 'Pacifico', 'Satisfy', 'Courgette',
  'Cookie', 'Permanent Marker', 'Shadows Into Light', 'Kaushan Script', 'Sacramento', 'Great Vibes',
  'Amatic SC', 'Architects Daughter', 'Indie Flower', 'Dancing Script', 'Caveat', 'Allura',
  'Covered By Your Grace', 'Rock Salt', 'Reenie Beanie', 'Patrick Hand', 'Gloria Hallelujah',
  'Homemade Apple', 'Bad Script', 'Marck Script', 'Alex Brush', 'Rochester', 'Pinyon Script',
  'Tangerine', 'Mr De Haviland', 'Miss Fajardose', 'Mr Dafoe', 'Euphoria Script', 'Yellowtail',
  'Parisienne', 'Niconne', 'Damion', 'Rancho', 'League Script', 'Italianno', 'Monsieur La Doulaise',
  'Norican', 'Stalemate', 'Rouge Script', 'Berkshire Swash', 'Meddon', 'Arizonia', 'Seaweed Script',
  'Montez', 'Lovers Quarrel', 'Aguafina Script', 'Sofia', 'Petit Formal Script', 'Allison',
  'Meow Script', 'Fleur De Leah', 'Waterfall', 'Mea Culpa', 'Bonheur Royale', 'Petemoss',

  // Monospace
  'Roboto Mono', 'Source Code Pro', 'Fira Code', 'JetBrains Mono', 'IBM Plex Mono', 'Space Mono',
  'Inconsolata', 'Ubuntu Mono', 'PT Mono', 'Overpass Mono', 'Anonymous Pro', 'Cousine',
  'Courier Prime', 'DM Mono', 'Noto Sans Mono', 'Red Hat Mono', 'Azeret Mono', 'Martian Mono',
  'Geist Mono', 'Commit Mono',

  // Handwriting/Script
  'Caveat Brush', 'Klee One', 'Zen Kurenaido', 'BioRhyme', 'Darker Grotesque', 'Bellota',
  'Bellota Text', 'Gochi Hand', 'Just Another Hand', 'Schoolbell', 'Waiting for the Sunrise',
  'Coming Soon', 'Nothing You Could Do', 'Crafty Girls', 'Short Stack', 'Handlee', 'Delius',

  // System fonts
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana', 'Tahoma', 'Trebuchet MS',
];

// Legacy fontOptions export for backward compatibility
export const fontOptions = googleFonts;
