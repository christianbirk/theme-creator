import { useCallback, useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RotateCcw, Search, Check } from 'lucide-react';

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

export function GoogleFontPicker({ 
  value, 
  defaultValue, 
  onChange, 
  label, 
  description,
}: GoogleFontPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isModified = value !== defaultValue;

  useEffect(() => {
    if (pickerOpen) {
      POPULAR_GOOGLE_FONTS.slice(0, 20).forEach(font => loadGoogleFont(font.name));
    }
  }, [pickerOpen]);

  useEffect(() => {
    if (value && !value.includes('var(')) {
      loadGoogleFont(value);
    }
  }, [value]);

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const handleSelectFont = useCallback((fontName: string) => {
    loadGoogleFont(fontName);
    onChange(fontName);
    setPickerOpen(false);
  }, [onChange]);

  const filteredFonts = useMemo(() => {
    if (!searchQuery) return POPULAR_GOOGLE_FONTS;
    const query = searchQuery.toLowerCase();
    return POPULAR_GOOGLE_FONTS.filter(font => 
      font.name.toLowerCase().includes(query) ||
      font.category.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const groupedFonts = useMemo(() => {
    const groups: Record<string, typeof POPULAR_GOOGLE_FONTS> = {
      'sans-serif': [],
      'serif': [],
      'monospace': [],
    };
    filteredFonts.forEach(font => {
      if (groups[font.category]) {
        groups[font.category].push(font);
      }
    });
    return groups;
  }, [filteredFonts]);

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

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-60 h-8 px-3 flex items-center border rounded-md bg-background text-sm truncate cursor-pointer hover:border-primary transition-colors text-left"
            style={{ fontFamily: value }}
            data-testid={`font-trigger-${label}`}
          >
            {value || 'Select font...'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search fonts..."
                className="pl-7 h-8 text-sm"
                data-testid={`font-search-${label}`}
              />
            </div>
          </div>
          <ScrollArea className="h-[280px]">
            <div className="p-2">
              {Object.entries(groupedFonts).map(([category, fonts]) => {
                if (fonts.length === 0) return null;
                return (
                  <div key={category} className="mb-3">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 py-1">
                      {category}
                    </div>
                    <div className="space-y-0.5">
                      {fonts.map((font) => {
                        loadGoogleFont(font.name);
                        return (
                          <button
                            key={font.name}
                            type="button"
                            onClick={() => handleSelectFont(font.name)}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left hover-elevate ${
                              value === font.name ? 'bg-accent' : ''
                            }`}
                            style={{ fontFamily: font.name }}
                            data-testid={`font-option-${font.name}`}
                          >
                            <span className="text-sm">{font.name}</span>
                            {value === font.name && (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

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
