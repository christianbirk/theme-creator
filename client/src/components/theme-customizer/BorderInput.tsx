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
import { Slider } from '@/components/ui/slider';
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

interface ColorMixParts {
  colorSpace: string;
  baseColor: string;
  percentage: number;
  blendColor: string;
}

const BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset'];


function extractColorMixFromString(str: string): string | null {
  const start = str.indexOf('color-mix(');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return null;
}

function parseColorMix(value: string): ColorMixParts | null {
  const match = value.match(/color-mix\(\s*in\s+([a-z0-9-]+)\s*,\s*(.*?(?:\([^)]*\))?.*?)\s+(\d+)%\s*,\s*([a-z]+)\s*\)/i);
  if (match) {
    return {
      colorSpace: match[1],
      baseColor: match[2],
      percentage: parseInt(match[3]),
      blendColor: match[4],
    };
  }
  return null;
}

function composeColorMix(parts: ColorMixParts): string {
  return `color-mix(in ${parts.colorSpace}, ${parts.baseColor} ${parts.percentage}%, ${parts.blendColor})`;
}

function parseBorderValue(value: string): BorderParts {
  if (!value || value.trim() === '') {
    return { width: '', style: 'solid', color: '' };
  }

  const trimmed = value.trim();
  
  const widthMatch = trimmed.match(/^(\d+(?:\.\d+)?(?:px|rem|em|%)?)\s/);
  const width = widthMatch ? widthMatch[1] : '';
  
  let style = 'solid';
  for (const s of BORDER_STYLES) {
    if (trimmed.includes(s)) {
      style = s;
      break;
    }
  }
  
  let color = '';
  const colorMixStr = extractColorMixFromString(trimmed);
  if (colorMixStr) {
    color = colorMixStr;
  } else {
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
  }
  
  return { width, style, color };
}

function composeBorderValue(parts: BorderParts): string {
  if (parts.style === 'none') {
    return '';
  }
  
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

  const colorMixParts = useMemo(() => parseColorMix(parts.color), [parts.color]);

  const effectiveColorMix = useMemo((): ColorMixParts | null => {
    if (colorMixParts) return { ...colorMixParts, colorSpace: 'srgb', blendColor: 'transparent' };
    if (parts.color.startsWith('var(')) {
      return {
        colorSpace: 'srgb',
        baseColor: parts.color,
        percentage: 100,
        blendColor: 'transparent',
      };
    }
    return null;
  }, [colorMixParts, parts.color]);

  const handleColorMixChange = useCallback((updated: Partial<ColorMixParts>) => {
    const current = effectiveColorMix || {
      colorSpace: 'srgb',
      baseColor: colorOptions.length > 0 ? `var(${colorOptions[0].name})` : '#000000',
      percentage: 100,
      blendColor: 'transparent',
    };
    const newMix = { ...current, ...updated };
    if (newMix.percentage === 100 && newMix.blendColor === 'transparent') {
      updatePart('color', newMix.baseColor);
    } else {
      updatePart('color', composeColorMix(newMix));
    }
  }, [effectiveColorMix, updatePart, colorOptions]);

  const handleSelectBaseColor = useCallback((colorVar: CSSVariable) => {
    const current = effectiveColorMix || {
      colorSpace: 'srgb',
      percentage: 100,
      blendColor: 'transparent',
    };
    const newBase = `var(${colorVar.name})`;
    if (current.percentage === 100 && current.blendColor === 'transparent') {
      updatePart('color', newBase);
    } else {
      updatePart('color', composeColorMix({ ...current, baseColor: newBase }));
    }
  }, [effectiveColorMix, updatePart]);

  const colorDisplayValue = useMemo(() => {
    if (effectiveColorMix) {
      const baseLabel = effectiveColorMix.baseColor.startsWith('var(')
        ? formatLabel(effectiveColorMix.baseColor.match(/var\(([^)]+)\)/)?.[1] || '')
        : effectiveColorMix.baseColor;
      if (effectiveColorMix.percentage === 100 && effectiveColorMix.blendColor === 'transparent') {
        return baseLabel;
      }
      return `${baseLabel} ${effectiveColorMix.percentage}%`;
    }
    return parts.color || 'Select color...';
  }, [parts.color, effectiveColorMix]);

  const hasVarColor = !!effectiveColorMix;
  const defaultTab = hasVarColor ? 'color-mix' : 'custom';

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
        <Input
          type="text"
          value={parts.width}
          onChange={(e) => updatePart('width', e.target.value)}
          className="w-16 h-8 font-mono text-xs"
          placeholder="1px"
          disabled={parts.style === 'none'}
          data-testid={`border-width-${label}`}
        />

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

        <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={parts.style === 'none'}
              className="w-28 h-8 px-2 flex items-center gap-2 border rounded-md bg-background text-xs truncate cursor-pointer hover:border-primary transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid={`border-color-trigger-${label}`}
            >
              {hasVarColor && (
                <span className="w-4 h-4 rounded border flex-shrink-0 bg-muted" title="Variable color">
                  <svg viewBox="0 0 16 16" className="w-full h-full">
                    <circle cx="6" cy="8" r="4" fill="currentColor" opacity="0.3" />
                    <circle cx="10" cy="8" r="4" fill="currentColor" opacity="0.6" />
                  </svg>
                </span>
              )}
              {parts.color && !hasVarColor && (
                <span 
                  className="w-4 h-4 rounded border flex-shrink-0" 
                  style={{ backgroundColor: parts.color }}
                />
              )}
              <span className={hasVarColor ? "capitalize text-muted-foreground truncate" : "truncate"}>
                {colorDisplayValue}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <Tabs defaultValue={defaultTab} className="w-[260px]">
              <TabsList className="w-full">
                <TabsTrigger value="color-mix" className="flex-1 text-xs">Reference</TabsTrigger>
                <TabsTrigger value="custom" className="flex-1 text-xs">Custom</TabsTrigger>
              </TabsList>
              <TabsContent value="color-mix" className="mt-2 space-y-3">
                <ScrollArea className="h-[140px] border rounded-md p-1">
                  <div className="space-y-0.5">
                    {colorOptions.map((colorVar) => {
                      const varRef = `var(${colorVar.name})`;
                      const isSelected = effectiveColorMix?.baseColor === varRef;
                      return (
                        <button
                          key={colorVar.name}
                          type="button"
                          onClick={() => handleSelectBaseColor(colorVar)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs hover-elevate ${
                            isSelected ? 'bg-accent' : ''
                          }`}
                          data-testid={`border-color-option-${colorVar.name}`}
                        >
                          <span 
                            className="w-3.5 h-3.5 rounded border flex-shrink-0" 
                            style={{ backgroundColor: colorVar.value }}
                          />
                          <span className="capitalize truncate">{formatLabel(colorVar.name)}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>

                {effectiveColorMix && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-muted-foreground">Amount</label>
                      <span className="text-xs font-mono text-muted-foreground">{effectiveColorMix.percentage}%</span>
                    </div>
                    <Slider
                      value={[effectiveColorMix.percentage]}
                      onValueChange={([val]) => handleColorMixChange({ percentage: val })}
                      min={1}
                      max={100}
                      step={1}
                      className="w-full"
                      data-testid={`border-mix-pct-${label}`}
                    />
                    {effectiveColorMix.percentage < 100 && (
                      <div className="pt-1 mt-2 border-t">
                        <p className="text-[10px] font-mono text-muted-foreground break-all">
                          {parts.color}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="custom" className="mt-2">
                <Input
                  value={hasVarColor ? '' : parts.color}
                  onChange={(e) => updatePart('color', e.target.value)}
                  className="font-mono text-xs"
                  placeholder="#cccccc or color-mix(...)"
                  data-testid={`border-color-custom-${label}`}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Enter a hex color or raw CSS expression
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
