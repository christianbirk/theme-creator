import { useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';

interface GoogleFontPickerProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
}

const POPULAR_GOOGLE_FONTS = [
  { name: 'Inter', category: 'sans-serif' },
  { name: 'Roboto', category: 'sans-serif' },
  { name: 'Open Sans', category: 'sans-serif' },
  { name: 'Lato', category: 'sans-serif' },
  { name: 'Montserrat', category: 'sans-serif' },
  { name: 'Poppins', category: 'sans-serif' },
  { name: 'Roboto Condensed', category: 'sans-serif' },
  { name: 'Source Sans 3', category: 'sans-serif' },
  { name: 'Oswald', category: 'sans-serif' },
  { name: 'Raleway', category: 'sans-serif' },
  { name: 'Nunito', category: 'sans-serif' },
  { name: 'Nunito Sans', category: 'sans-serif' },
  { name: 'Ubuntu', category: 'sans-serif' },
  { name: 'Rubik', category: 'sans-serif' },
  { name: 'Work Sans', category: 'sans-serif' },
  { name: 'DM Sans', category: 'sans-serif' },
  { name: 'Outfit', category: 'sans-serif' },
  { name: 'Manrope', category: 'sans-serif' },
  { name: 'Space Grotesk', category: 'sans-serif' },
  { name: 'Plus Jakarta Sans', category: 'sans-serif' },
  { name: 'IBM Plex Sans', category: 'sans-serif' },
  { name: 'Mulish', category: 'sans-serif' },
  { name: 'Figtree', category: 'sans-serif' },
  { name: 'Lexend', category: 'sans-serif' },
  { name: 'Playfair Display', category: 'serif' },
  { name: 'Merriweather', category: 'serif' },
  { name: 'Lora', category: 'serif' },
  { name: 'PT Serif', category: 'serif' },
  { name: 'Roboto Slab', category: 'serif' },
  { name: 'Source Serif 4', category: 'serif' },
  { name: 'Libre Baskerville', category: 'serif' },
  { name: 'Cormorant Garamond', category: 'serif' },
  { name: 'EB Garamond', category: 'serif' },
  { name: 'Crimson Text', category: 'serif' },
  { name: 'DM Serif Display', category: 'serif' },
  { name: 'Bitter', category: 'serif' },
  { name: 'Fira Code', category: 'monospace' },
  { name: 'JetBrains Mono', category: 'monospace' },
  { name: 'Source Code Pro', category: 'monospace' },
  { name: 'Roboto Mono', category: 'monospace' },
  { name: 'IBM Plex Mono', category: 'monospace' },
  { name: 'Space Mono', category: 'monospace' },
];

const loadedFonts = new Set<string>();

function loadGoogleFont(fontName: string) {
  if (loadedFonts.has(fontName)) return;
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
  loadedFonts.add(fontName);
}

const sansSerifFonts = POPULAR_GOOGLE_FONTS.filter(f => f.category === 'sans-serif');
const serifFonts = POPULAR_GOOGLE_FONTS.filter(f => f.category === 'serif');
const monospaceFonts = POPULAR_GOOGLE_FONTS.filter(f => f.category === 'monospace');

export function GoogleFontPicker({ 
  value, 
  defaultValue, 
  onChange, 
  label, 
  description,
}: GoogleFontPickerProps) {
  const isModified = value !== defaultValue;

  useEffect(() => {
    if (value && !value.includes('var(')) {
      loadGoogleFont(value);
    }
  }, [value]);

  useEffect(() => {
    POPULAR_GOOGLE_FONTS.forEach(font => loadGoogleFont(font.name));
  }, []);

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const handleValueChange = useCallback((newValue: string) => {
    loadGoogleFont(newValue);
    onChange(newValue);
  }, [onChange]);

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate capitalize" data-testid={`font-label-${label}`}>
            {label}
          </span>
          {isModified && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
          )}
        </div>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>

      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger 
          className="w-60" 
          style={{ fontFamily: value }}
          data-testid={`font-trigger-${label}`}
        >
          <SelectValue placeholder="Select font..." />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Sans-Serif</SelectLabel>
            {sansSerifFonts.map((font) => (
              <SelectItem 
                key={font.name} 
                value={font.name}
                style={{ fontFamily: font.name }}
                data-testid={`font-option-${font.name}`}
              >
                {font.name}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Serif</SelectLabel>
            {serifFonts.map((font) => (
              <SelectItem 
                key={font.name} 
                value={font.name}
                style={{ fontFamily: font.name }}
                data-testid={`font-option-${font.name}`}
              >
                {font.name}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Monospace</SelectLabel>
            {monospaceFonts.map((font) => (
              <SelectItem 
                key={font.name} 
                value={font.name}
                style={{ fontFamily: font.name }}
                data-testid={`font-option-${font.name}`}
              >
                {font.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleReset}
        className={`h-8 w-8 ${!isModified ? 'invisible' : ''}`}
        data-testid={`font-reset-${label}`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default GoogleFontPicker;
