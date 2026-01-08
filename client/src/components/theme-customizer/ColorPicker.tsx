import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HexColorPicker } from 'react-colorful';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { CSSVariable } from './types';
import { getContrastInfo, ContrastLevel } from '@/lib/contrast-utils';

interface ColorPickerProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  colorOptions?: CSSVariable[];
  isBaseColor?: boolean;
  contrastBackground?: string;
}

export function ColorPicker({ 
  value, 
  defaultValue, 
  onChange, 
  label, 
  description,
  colorOptions = [],
  isBaseColor = false,
  contrastBackground,
}: ColorPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isModified = value !== defaultValue;

  const contrastInfo = useMemo(() => {
    if (!contrastBackground) return null;
    
    // Resolve the foreground color value
    let foregroundColor = value;
    if (value.startsWith('var(')) {
      const varMatch = value.match(/var\(([^)]+)\)/);
      if (varMatch && colorOptions.length > 0) {
        const varName = varMatch[1];
        const colorVar = colorOptions.find(c => c.name === varName);
        if (colorVar) {
          foregroundColor = colorVar.value;
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
    
    // Check if we can parse the colors
    if (!foregroundColor.startsWith('#') && !foregroundColor.startsWith('rgb')) {
      return null;
    }
    if (!contrastBackground.startsWith('#') && !contrastBackground.startsWith('rgb')) {
      return null;
    }
    
    return getContrastInfo(foregroundColor, contrastBackground);
  }, [value, contrastBackground, colorOptions]);

  const getContrastLevelLabel = (level: ContrastLevel): string => {
    switch (level) {
      case 'aaa': return 'AAA - Excellent';
      case 'aa': return 'AA - Good';
      case 'aa-large': return 'AA Large - OK for large text';
      case 'fail': return 'Fail - Poor contrast';
    }
  };
  
  // Check if current value is a var() reference
  const isVarReference = value.startsWith('var(');

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const formatLabel = (name: string) => {
    return name.replace(/^--/, '').replace(/-/g, ' ');
  };

  const getResolvedColor = useCallback((val: string): string => {
    if (!val) return '#cccccc';
    
    const varMatch = val.match(/var\(([^)]+)\)/);
    if (varMatch && colorOptions.length > 0) {
      const varName = varMatch[1];
      const colorVar = colorOptions.find(c => c.name === varName);
      if (colorVar) {
        return colorVar.value;
      }
    }
    
    if (val.startsWith('#') || val.startsWith('rgb') || val.startsWith('hsl')) {
      return val;
    }
    
    return '#cccccc';
  }, [colorOptions]);

  const resolvedColor = useMemo(() => getResolvedColor(value), [value, getResolvedColor]);

  // Normalize color for the picker (needs to be hex)
  const pickerColor = useMemo(() => {
    const color = resolvedColor;
    if (color.startsWith('#') && (color.length === 4 || color.length === 7)) {
      return color;
    }
    return '#cccccc';
  }, [resolvedColor]);

  const handleSelectColor = useCallback((colorVar: CSSVariable) => {
    onChange(`var(${colorVar.name})`);
    setPickerOpen(false);
  }, [onChange]);

  // Display value - show formatted name for var references
  const displayValue = useMemo(() => {
    if (isVarReference) {
      const match = value.match(/var\(([^)]+)\)/);
      return match ? formatLabel(match[1]) : value;
    }
    return value;
  }, [value, isVarReference]);

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate capitalize" data-testid={`color-label-${label}`}>
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
            className="w-8 h-8 rounded-md border-2 border-input flex-shrink-0 cursor-pointer hover:border-primary transition-colors"
            style={{ backgroundColor: resolvedColor }}
            data-testid={`color-swatch-${label}`}
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          {isBaseColor || colorOptions.length === 0 ? (
            // Base colors: only show color picker
            <div>
              <HexColorPicker 
                color={pickerColor} 
                onChange={onChange}
              />
              <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="mt-2 font-mono text-xs"
                placeholder="#000000"
                data-testid={`color-picker-input-${label}`}
              />
            </div>
          ) : (
            // Derived colors: show tabs for reference and custom
            <Tabs defaultValue={isVarReference ? "reference" : "custom"} className="w-[220px]">
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
                          value === `var(${colorVar.name})` ? 'bg-accent' : ''
                        }`}
                        data-testid={`color-option-${colorVar.name}`}
                      >
                        <div 
                          className="w-5 h-5 rounded border border-input flex-shrink-0"
                          style={{ backgroundColor: colorVar.value }}
                        />
                        <span className="capitalize truncate">{formatLabel(colorVar.name)}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="custom" className="mt-2">
                <HexColorPicker 
                  color={pickerColor} 
                  onChange={onChange}
                />
                <Input
                  value={isVarReference ? '' : value}
                  onChange={(e) => onChange(e.target.value)}
                  className="mt-2 font-mono text-xs"
                  placeholder="#000000"
                  data-testid={`color-picker-input-${label}`}
                />
              </TabsContent>
            </Tabs>
          )}
        </PopoverContent>
      </Popover>

      <div className="w-60 h-8 px-3 flex items-center border rounded-md bg-background text-xs font-mono truncate">
        {isVarReference ? (
          <span className="capitalize text-muted-foreground">{displayValue}</span>
        ) : (
          <span>{value}</span>
        )}
      </div>

      {contrastInfo && (contrastInfo.level === 'fail' || contrastInfo.level === 'aa-large') && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={`flex items-center justify-center w-8 h-8 rounded-md ${
                contrastInfo.level === 'fail' 
                  ? 'text-destructive' 
                  : 'text-yellow-600 dark:text-yellow-500'
              }`}
              data-testid={`contrast-indicator-${label}`}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <div className="font-medium">{getContrastLevelLabel(contrastInfo.level)}</div>
              <div className="text-muted-foreground">Ratio: {contrastInfo.ratio.toFixed(2)}:1</div>
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      <Button
        variant="ghost"
        size="icon"
        onClick={handleReset}
        className={`h-8 w-8 ${!isModified ? 'invisible' : ''}`}
        data-testid={`color-reset-${label}`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default ColorPicker;
