import { useCallback, useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { RotateCcw, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CustomFont {
  name: string;
  fontFamily: string;
}

interface GoogleFontPickerProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  embedded?: boolean;
  customFonts?: CustomFont[];
}

interface GoogleFontEntry {
  family: string;
  category?: string;
}

const loadedFonts = new Set<string>();

function loadGoogleFont(fontName: string) {
  if (loadedFonts.has(fontName)) return;
  
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
  loadedFonts.add(fontName);
}

let allFontsCache: GoogleFontEntry[] | null = null;
let fontFetchPromise: Promise<GoogleFontEntry[]> | null = null;

async function fetchAllGoogleFonts(): Promise<GoogleFontEntry[]> {
  if (allFontsCache) return allFontsCache;
  if (fontFetchPromise) return fontFetchPromise;

  fontFetchPromise = fetch('/api/google-fonts-metadata')
    .then(res => res.json())
    .then(data => {
      allFontsCache = data.fonts || [];
      return allFontsCache!;
    })
    .catch(() => {
      fontFetchPromise = null;
      return [];
    });

  return fontFetchPromise;
}

export function GoogleFontPicker({ 
  value, 
  defaultValue, 
  onChange, 
  label, 
  description,
  embedded = false,
  customFonts = [],
}: GoogleFontPickerProps) {
  const [open, setOpen] = useState(false);
  const [allFonts, setAllFonts] = useState<GoogleFontEntry[]>([]);
  const [fontsLoading, setFontsLoading] = useState(false);
  const isModified = value !== defaultValue;

  useEffect(() => {
    if (value && !value.includes('var(')) {
      loadGoogleFont(value);
    }
  }, [value]);

  useEffect(() => {
    if (open && allFonts.length === 0 && !fontsLoading) {
      setFontsLoading(true);
      fetchAllGoogleFonts().then(fonts => {
        setAllFonts(fonts);
        setFontsLoading(false);
        fonts.slice(0, 20).forEach(f => loadGoogleFont(f.family));
      });
    }
  }, [open, allFonts.length, fontsLoading]);

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const handleSelect = useCallback((fontName: string) => {
    loadGoogleFont(fontName);
    onChange(fontName);
    setOpen(false);
  }, [onChange]);

  const displayValue = useMemo(() => {
    if (!value) return 'Select font...';
    return value;
  }, [value]);

  const catLower = useCallback((f: GoogleFontEntry) => (f.category || '').toLowerCase(), []);
  const sansSerifFonts = useMemo(() => allFonts.filter(f => catLower(f) === 'sans serif' || catLower(f) === 'sans-serif'), [allFonts, catLower]);
  const serifFonts = useMemo(() => allFonts.filter(f => catLower(f) === 'serif'), [allFonts, catLower]);
  const displayFonts = useMemo(() => allFonts.filter(f => catLower(f) === 'display'), [allFonts, catLower]);
  const handwritingFonts = useMemo(() => allFonts.filter(f => catLower(f) === 'handwriting'), [allFonts, catLower]);
  const monospaceFonts = useMemo(() => allFonts.filter(f => catLower(f) === 'monospace'), [allFonts, catLower]);

  const fontCommandContent = (
    <Command 
      className={embedded ? "border rounded-md" : ""}
      filter={(value, search) => {
        if (value.toLowerCase().includes(search.toLowerCase())) return 1;
        return 0;
      }}
    >
      <CommandInput placeholder="Search all Google Fonts..." data-testid={`font-search-${label}`} />
      <CommandList className={embedded ? "max-h-[180px]" : "max-h-[300px]"}>
        {fontsLoading ? (
          <div className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading fonts...</span>
          </div>
        ) : (
          <>
            <CommandEmpty>No font found.</CommandEmpty>
            {customFonts.length > 0 && (
              <CommandGroup heading="Custom Fonts">
                {customFonts.map((font) => (
                  <CommandItem
                    key={font.name}
                    value={font.name}
                    onSelect={() => handleSelect(font.fontFamily)}
                    style={{ fontFamily: font.fontFamily }}
                    data-testid={`font-option-custom-${font.name}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === font.fontFamily ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {font.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {sansSerifFonts.length > 0 && (
              <CommandGroup heading={`Sans-Serif (${sansSerifFonts.length})`}>
                {sansSerifFonts.map((font) => (
                  <CommandItem
                    key={font.family}
                    value={font.family}
                    onSelect={() => handleSelect(font.family)}
                    onMouseEnter={() => loadGoogleFont(font.family)}
                    style={{ fontFamily: font.family }}
                    data-testid={`font-option-${font.family}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === font.family ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {font.family}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {serifFonts.length > 0 && (
              <CommandGroup heading={`Serif (${serifFonts.length})`}>
                {serifFonts.map((font) => (
                  <CommandItem
                    key={font.family}
                    value={font.family}
                    onSelect={() => handleSelect(font.family)}
                    onMouseEnter={() => loadGoogleFont(font.family)}
                    style={{ fontFamily: font.family }}
                    data-testid={`font-option-${font.family}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === font.family ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {font.family}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {displayFonts.length > 0 && (
              <CommandGroup heading={`Display (${displayFonts.length})`}>
                {displayFonts.map((font) => (
                  <CommandItem
                    key={font.family}
                    value={font.family}
                    onSelect={() => handleSelect(font.family)}
                    onMouseEnter={() => loadGoogleFont(font.family)}
                    style={{ fontFamily: font.family }}
                    data-testid={`font-option-${font.family}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === font.family ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {font.family}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {handwritingFonts.length > 0 && (
              <CommandGroup heading={`Handwriting (${handwritingFonts.length})`}>
                {handwritingFonts.map((font) => (
                  <CommandItem
                    key={font.family}
                    value={font.family}
                    onSelect={() => handleSelect(font.family)}
                    onMouseEnter={() => loadGoogleFont(font.family)}
                    style={{ fontFamily: font.family }}
                    data-testid={`font-option-${font.family}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === font.family ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {font.family}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {monospaceFonts.length > 0 && (
              <CommandGroup heading={`Monospace (${monospaceFonts.length})`}>
                {monospaceFonts.map((font) => (
                  <CommandItem
                    key={font.family}
                    value={font.family}
                    onSelect={() => handleSelect(font.family)}
                    onMouseEnter={() => loadGoogleFont(font.family)}
                    style={{ fontFamily: font.family }}
                    data-testid={`font-option-${font.family}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === font.family ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {font.family}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </Command>
  );

  if (embedded) {
    return fontCommandContent;
  }

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

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-1/2 justify-between font-normal"
            style={{ fontFamily: value }}
            data-testid={`font-trigger-${label}`}
          >
            <span className="truncate">{displayValue}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          {fontCommandContent}
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
