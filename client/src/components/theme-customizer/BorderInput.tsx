import { useCallback, useMemo, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RotateCcw } from 'lucide-react';
import { CSSVariable } from './types';

interface BorderInputProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  colorOptions?: CSSVariable[];
}

interface BorderParts {
  width: string;
  style: string;
  color: string;
}

const BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'];

function parseBorderValue(value: string): BorderParts {
  if (!value || value.trim() === '') {
    // Default to solid so user can start entering values
    return { width: '', style: 'solid', color: '' };
  }

  const trimmed = value.trim();
  
  // Try to extract width (e.g., 1px, 2rem)
  const widthMatch = trimmed.match(/(\d+(?:\.\d+)?(?:px|rem|em|%)?)/);
  const width = widthMatch ? widthMatch[1] : '';
  
  // Try to extract style
  let style = 'solid';
  for (const s of BORDER_STYLES) {
    if (s !== 'solid' && trimmed.includes(s)) {
      style = s;
      break;
    }
  }
  
  // Extract color - could be hex, rgb, or var()
  let color = '';
  const varMatch = trimmed.match(/var\([^)]+\)/);
  if (varMatch) {
    color = varMatch[0];
  } else {
    const hexMatch = trimmed.match(/#[a-fA-F0-9]{3,8}/);
    if (hexMatch) {
      color = hexMatch[0];
    } else {
      const rgbMatch = trimmed.match(/rgba?\([^)]+\)/);
      if (rgbMatch) {
        color = rgbMatch[0];
      }
    }
  }
  
  return { width, style, color };
}

function composeBorderValue(parts: BorderParts): string {
  if (parts.style === 'none') {
    return '';
  }
  
  // Always include the style, only add width/color if present
  const components = [parts.width, parts.style, parts.color].filter(Boolean);
  return components.join(' ');
}

export function BorderInput({ 
  value, 
  defaultValue, 
  onChange, 
  label, 
  description,
  colorOptions = [],
}: BorderInputProps) {
  const [parts, setParts] = useState<BorderParts>(() => parseBorderValue(value));
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [isLocalEdit, setIsLocalEdit] = useState(false);
  
  const isModified = value !== defaultValue;
  
  // Sync parts when value changes externally (not from local edits)
  useEffect(() => {
    if (!isLocalEdit) {
      setParts(parseBorderValue(value));
    }
    setIsLocalEdit(false);
  }, [value]);

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const updatePart = useCallback((key: keyof BorderParts, newValue: string) => {
    const newParts = { ...parts, [key]: newValue };
    setParts(newParts);
    setIsLocalEdit(true);
    onChange(composeBorderValue(newParts));
  }, [parts, onChange]);

  const formatLabel = (name: string) => {
    return name.replace(/^--/, '').replace(/-/g, ' ');
  };

  const handleSelectColor = useCallback((colorVar: CSSVariable) => {
    updatePart('color', `var(${colorVar.name})`);
    setColorPickerOpen(false);
  }, [updatePart]);

  const colorDisplayValue = useMemo(() => {
    if (parts.color.startsWith('var(')) {
      const match = parts.color.match(/var\(([^)]+)\)/);
      return match ? formatLabel(match[1]) : parts.color;
    }
    return parts.color || 'Select color...';
  }, [parts.color]);

  const isColorVar = parts.color.startsWith('var(');

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate capitalize" data-testid={`border-label-${label}`}>
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

      <div className="flex items-center gap-2">
        {/* Width input */}
        <Input
          type="text"
          value={parts.width}
          onChange={(e) => updatePart('width', e.target.value)}
          className="w-16 h-8 font-mono text-xs"
          placeholder="1px"
          disabled={parts.style === 'none'}
          data-testid={`border-width-${label}`}
        />

        {/* Style select */}
        <Select
          value={parts.style}
          onValueChange={(val) => updatePart('style', val)}
        >
          <SelectTrigger className="w-20 h-8 text-xs" data-testid={`border-style-${label}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BORDER_STYLES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Color picker */}
        <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={parts.style === 'none'}
              className="w-24 h-8 px-2 flex items-center gap-2 border rounded-md bg-background text-xs truncate cursor-pointer hover:border-primary transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid={`border-color-trigger-${label}`}
            >
              {parts.color && !isColorVar && (
                <span 
                  className="w-4 h-4 rounded border flex-shrink-0" 
                  style={{ backgroundColor: parts.color }}
                />
              )}
              <span className={isColorVar ? "capitalize text-muted-foreground" : ""}>
                {colorDisplayValue}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <Tabs defaultValue={isColorVar ? "reference" : "custom"} className="w-[220px]">
              <TabsList className="w-full">
                <TabsTrigger value="reference" className="flex-1 text-xs">Reference</TabsTrigger>
                <TabsTrigger value="custom" className="flex-1 text-xs">Custom</TabsTrigger>
              </TabsList>
              <TabsContent value="reference" className="mt-2">
                <ScrollArea className="h-[200px]">
                  <div className="space-y-1">
                    {colorOptions.map((colorVar) => (
                      <button
                        key={colorVar.name}
                        type="button"
                        onClick={() => handleSelectColor(colorVar)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover-elevate ${
                          parts.color === `var(${colorVar.name})` ? 'bg-accent' : ''
                        }`}
                        data-testid={`border-color-option-${colorVar.name}`}
                      >
                        <span 
                          className="w-4 h-4 rounded border flex-shrink-0" 
                          style={{ backgroundColor: colorVar.value }}
                        />
                        <span className="capitalize truncate">{formatLabel(colorVar.name)}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="custom" className="mt-2">
                <Input
                  value={isColorVar ? '' : parts.color}
                  onChange={(e) => updatePart('color', e.target.value)}
                  className="font-mono text-xs"
                  placeholder="#cccccc"
                  data-testid={`border-color-custom-${label}`}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Enter a hex color value
                </p>
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleReset}
        className={`h-8 w-8 ${!isModified ? 'invisible' : ''}`}
        data-testid={`border-reset-${label}`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default BorderInput;
