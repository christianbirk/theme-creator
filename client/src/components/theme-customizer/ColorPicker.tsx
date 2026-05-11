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
import { Slider } from '@/components/ui/slider';
import { HexColorPicker } from 'react-colorful';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { CSSVariable } from './types';
import { getContrastInfo, ContrastLevel } from '@/lib/contrast-utils';

interface ColorMixInfo {
  baseColor: string;
  percentage: number;
}

function parseColorMixForPicker(value: string): ColorMixInfo | null {
  const match = value.match(/color-mix\(\s*in\s+[a-z0-9-]+\s*,\s*(.*?(?:\([^)]*\))?.*?)\s+(\d+)%\s*,\s*[a-z]+\s*\)/i);
  if (match) {
    return { baseColor: match[1], percentage: parseInt(match[2]) };
  }
  return null;
}

function composeColorMixForPicker(baseColor: string, percentage: number): string {
  return `color-mix(in srgb, ${baseColor} ${percentage}%, transparent)`;
}

interface ColorPickerProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  colorOptions?: CSSVariable[];
  /**
   * Full variable set, used as a fallback for resolving var() chains
   * that point at *derived* variables (e.g. a service button colour
   * pointing at `var(--button-background-color)`, which itself points
   * at `var(--color-brand-a)`). Without this the swatch shows the
   * `#cccccc` placeholder for any value that isn't a direct brand-colour
   * reference. Optional so existing call sites that only need the base
   * lookup keep working.
   */
  allVariables?: CSSVariable[];
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
  allVariables = [],
  isBaseColor = false,
  contrastBackground,
}: ColorPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isModified = value !== defaultValue;

  const contrastInfo = useMemo(() => {
    if (!contrastBackground) return null;
    
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
  
  const colorMixInfo = useMemo(() => parseColorMixForPicker(value), [value]);

  const effectiveRef = useMemo((): ColorMixInfo | null => {
    if (colorMixInfo) return colorMixInfo;
    if (value.startsWith('var(')) {
      return { baseColor: value, percentage: 100 };
    }
    return null;
  }, [colorMixInfo, value]);

  const isVarReference = !!effectiveRef;

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const formatLabel = (name: string) => {
    return name.replace(/^--/, '').replace(/-/g, ' ');
  };

  const getResolvedColor = useCallback((val: string): string => {
    if (!val) return '#cccccc';

    // Chase one var() reference. First try `colorOptions` (the curated
    // base palette — keeps the original behaviour for direct brand-X
    // refs intact), then fall back to `allVariables` (the full set —
    // catches derived chains like service-btn → button-bg → brand-a).
    const lookup = (varName: string): string | null => {
      const fromOptions = colorOptions.find((c) => c.name === varName);
      if (fromOptions) return fromOptions.value;
      const fromAll = allVariables.find((v) => v.name === varName);
      if (fromAll) return fromAll.value;
      return null;
    };

    // Recursive resolver: bounded to 8 hops so a self-referencing chain
    // (`--a: var(--a)`) can't pin the picker.
    const resolve = (input: string, depth: number): string => {
      if (depth > 8) return '#cccccc';
      if (!input) return '#cccccc';

      const mixInfo = parseColorMixForPicker(input);
      if (mixInfo) {
        const varMatch = mixInfo.baseColor.match(/var\(([^)]+)\)/);
        if (varMatch) {
          const next = lookup(varMatch[1].trim());
          if (next) return resolve(next, depth + 1);
        } else if (
          mixInfo.baseColor.startsWith('#') ||
          mixInfo.baseColor.startsWith('rgb') ||
          mixInfo.baseColor.startsWith('hsl')
        ) {
          return mixInfo.baseColor;
        }
        return '#cccccc';
      }

      const varMatch = input.match(/var\(([^)]+)\)/);
      if (varMatch) {
        const next = lookup(varMatch[1].trim());
        if (next) return resolve(next, depth + 1);
        return '#cccccc';
      }

      if (input.startsWith('#') || input.startsWith('rgb') || input.startsWith('hsl')) {
        return input;
      }

      return '#cccccc';
    };

    return resolve(val, 0);
  }, [colorOptions, allVariables]);

  const resolvedColor = useMemo(() => getResolvedColor(value), [value, getResolvedColor]);

  const pickerColor = useMemo(() => {
    const color = resolvedColor;
    if (color.startsWith('#') && (color.length === 4 || color.length === 7)) {
      return color;
    }
    return '#cccccc';
  }, [resolvedColor]);

  const handleSelectColor = useCallback((colorVar: CSSVariable) => {
    const currentPct = effectiveRef?.percentage ?? 100;
    const varRef = `var(${colorVar.name})`;
    if (currentPct === 100) {
      onChange(varRef);
    } else {
      onChange(composeColorMixForPicker(varRef, currentPct));
    }
  }, [onChange, effectiveRef]);

  const handleAmountChange = useCallback((newPct: number) => {
    const baseColor = effectiveRef?.baseColor || (colorOptions.length > 0 ? `var(${colorOptions[0].name})` : '#000000');
    if (newPct === 100) {
      onChange(baseColor);
    } else {
      onChange(composeColorMixForPicker(baseColor, newPct));
    }
  }, [effectiveRef, onChange, colorOptions]);


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
              <TabsContent value="reference" className="mt-2 space-y-3">
                <ScrollArea className="h-[160px] border rounded-md p-1">
                  <div className="space-y-0.5">
                    {colorOptions.map((colorVar) => {
                      const varRef = `var(${colorVar.name})`;
                      const isSelected = effectiveRef?.baseColor === varRef;
                      return (
                        <button
                          key={colorVar.name}
                          type="button"
                          onClick={() => handleSelectColor(colorVar)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover-elevate ${
                            isSelected ? 'bg-accent' : ''
                          }`}
                          data-testid={`color-option-${colorVar.name}`}
                        >
                          <div 
                            className="w-4 h-4 rounded border border-input flex-shrink-0"
                            style={{ backgroundColor: colorVar.value }}
                          />
                          <span className="capitalize truncate text-xs">{formatLabel(colorVar.name)}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-muted-foreground">Amount</label>
                    <span className="text-xs font-mono text-muted-foreground">{(effectiveRef?.percentage ?? 100)}%</span>
                  </div>
                  <Slider
                    value={[effectiveRef?.percentage ?? 100]}
                    onValueChange={([val]) => handleAmountChange(val)}
                    min={1}
                    max={100}
                    step={1}
                    className="w-full"
                    data-testid={`color-amount-${label}`}
                  />
                  {effectiveRef && effectiveRef.percentage < 100 && (
                    <div className="pt-1 mt-2 border-t">
                      <p className="text-[10px] font-mono text-muted-foreground break-all">
                        {value}
                      </p>
                    </div>
                  )}
                </div>
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

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          const pastedText = e.clipboardData.getData('text').trim();
          if (pastedText) {
            e.preventDefault();
            onChange(pastedText);
          }
        }}
        className="w-60 h-8 font-mono text-xs"
        placeholder="#000000"
        data-testid={`color-value-input-${label}`}
      />

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
