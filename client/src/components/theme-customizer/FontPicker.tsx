import { useCallback, useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RotateCcw, Search, Loader2 } from 'lucide-react';
import { googleFonts, CSSVariable } from './types';

// Track loaded fonts to avoid duplicate loading
const loadedFonts = new Set<string>();

// Load a Google Font dynamically
function loadGoogleFont(fontName: string): void {
  if (loadedFonts.has(fontName)) return;
  loadedFonts.add(fontName);
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName.replace(/ /g, '+'))}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

interface FontPickerProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  fontOptions?: CSSVariable[];
  isBaseFontFamily?: boolean;
}

export function FontPicker({ 
  value, 
  defaultValue, 
  onChange, 
  label, 
  description,
  fontOptions: baseFontOptions = [],
  isBaseFontFamily = false,
}: FontPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isModified = value !== defaultValue;
  const isVarReference = value.startsWith('var(');

  // Load font for preview when value changes
  useEffect(() => {
    if (value && !isVarReference && googleFonts.includes(value)) {
      loadGoogleFont(value);
    }
  }, [value, isVarReference]);

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const formatLabel = (name: string) => {
    return name.replace(/^--/, '').replace(/-/g, ' ');
  };

  const handleSelectFont = useCallback((fontVar: CSSVariable) => {
    onChange(`var(${fontVar.name})`);
    setPickerOpen(false);
  }, [onChange]);

  const handleSelectGoogleFont = useCallback((font: string) => {
    loadGoogleFont(font);
    onChange(font);
    setPickerOpen(false);
    setSearchQuery('');
  }, [onChange]);

  const displayValue = useMemo(() => {
    if (isVarReference) {
      const match = value.match(/var\(([^)]+)\)/);
      return match ? formatLabel(match[1]) : value;
    }
    return value;
  }, [value, isVarReference]);

  // Filter fonts based on search query
  const filteredFonts = useMemo(() => {
    if (!searchQuery.trim()) {
      return googleFonts.slice(0, 50); // Show first 50 by default
    }
    const query = searchQuery.toLowerCase();
    return googleFonts.filter(font => 
      font.toLowerCase().includes(query)
    ).slice(0, 100); // Limit results
  }, [searchQuery]);

  // Load visible fonts for preview
  useEffect(() => {
    if (pickerOpen) {
      // Load first few fonts for preview
      filteredFonts.slice(0, 10).forEach(font => {
        loadGoogleFont(font);
      });
    }
  }, [pickerOpen, filteredFonts]);

  // If base font family or no reference options, show searchable font selector
  if (isBaseFontFamily || baseFontOptions.length === 0) {
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

        <Popover open={pickerOpen} onOpenChange={(open) => { setPickerOpen(open); if (!open) setSearchQuery(''); }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-1/2 h-8 px-3 flex items-center border rounded-md bg-background text-sm truncate cursor-pointer hover:border-primary transition-colors text-left"
              style={{ fontFamily: value || 'inherit' }}
              data-testid={`font-trigger-${label}`}
            >
              {value || 'Select font...'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-3" align="start">
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Google Fonts..."
                  className="pl-8 h-8"
                  data-testid={`font-search-${label}`}
                  autoFocus
                />
              </div>
              <ScrollArea className="h-[250px]">
                <div className="space-y-0.5">
                  {filteredFonts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No fonts found matching "{searchQuery}"
                    </p>
                  ) : (
                    filteredFonts.map((font) => (
                      <button
                        key={font}
                        type="button"
                        onClick={() => handleSelectGoogleFont(font)}
                        onMouseEnter={() => loadGoogleFont(font)}
                        className={`w-full px-2 py-1.5 rounded-md text-left hover-elevate ${
                          value === font ? 'bg-accent' : ''
                        }`}
                        style={{ fontFamily: font }}
                        data-testid={`font-option-${font}`}
                      >
                        <span className="text-sm">{font}</span>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
              {!searchQuery && (
                <p className="text-xs text-muted-foreground text-center">
                  Search to find more fonts from 300+ Google Fonts
                </p>
              )}
            </div>
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

  // Show reference picker for derived font families
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
            className="w-1/2 h-8 px-3 flex items-center border rounded-md bg-background text-xs font-mono truncate cursor-pointer hover:border-primary transition-colors text-left"
            data-testid={`font-trigger-${label}`}
          >
            {isVarReference ? (
              <span className="capitalize text-muted-foreground">{displayValue}</span>
            ) : (
              <span>{value || 'Select font...'}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <Tabs defaultValue={isVarReference ? "reference" : "custom"} className="w-[250px]">
            <TabsList className="w-full">
              <TabsTrigger value="reference" className="flex-1 text-xs">Reference</TabsTrigger>
              <TabsTrigger value="custom" className="flex-1 text-xs">Custom</TabsTrigger>
            </TabsList>
            <TabsContent value="reference" className="mt-2">
              <ScrollArea className="h-[150px]">
                <div className="space-y-1">
                  {baseFontOptions.map((fontVar) => (
                    <button
                      key={fontVar.name}
                      type="button"
                      onClick={() => handleSelectFont(fontVar)}
                      className={`w-full flex flex-col gap-0.5 px-2 py-1.5 rounded-md text-left hover-elevate ${
                        value === `var(${fontVar.name})` ? 'bg-accent' : ''
                      }`}
                      data-testid={`font-option-${fontVar.name}`}
                    >
                      <span className="capitalize text-sm">{formatLabel(fontVar.name)}</span>
                      <span className="text-xs text-muted-foreground truncate">{fontVar.value}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="custom" className="mt-2">
              <Input
                value={isVarReference ? '' : value}
                onChange={(e) => onChange(e.target.value)}
                className="font-mono text-xs"
                placeholder="e.g., Arial, sans-serif"
                data-testid={`font-custom-input-${label}`}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Enter a custom font family
              </p>
            </TabsContent>
          </Tabs>
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

export default FontPicker;
