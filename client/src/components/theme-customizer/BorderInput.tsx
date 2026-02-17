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

const BLEND_COLORS = ['transparent', 'black', 'white'];

const COLOR_SPACES = ['srgb', 'oklch', 'oklab', 'display-p3', 'srgb-linear', 'xyz'];

function parseColorMix(value: string): ColorMixParts | null {
  const match = value.match(/color-mix\(\s*in\s+([a-z0-9-]+)\s*,\s*(.+?)\s+(\d+)%\s*,\s*([a-z]+)\s*\)/i);
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
  const colorMixMatch = trimmed.match(/color-mix\([^)]*(?:\([^)]*\))*[^)]*\)/);
  if (colorMixMatch) {
    color = colorMixMatch[0];
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

  const handleSelectColor = useCallback((colorVar: CSSVariable) => {
    updatePart('color', `var(${colorVar.name})`);
    setColorPickerOpen(false);
  }, [updatePart]);

  const colorMixParts = useMemo(() => parseColorMix(parts.color), [parts.color]);

  const handleColorMixChange = useCallback((updated: Partial<ColorMixParts>) => {
    const current = colorMixParts || {
      colorSpace: 'srgb',
      baseColor: colorOptions.length > 0 ? `var(${colorOptions[0].name})` : '#000000',
      percentage: 50,
      blendColor: 'transparent',
    };
    const newMix = { ...current, ...updated };
    updatePart('color', composeColorMix(newMix));
  }, [colorMixParts, updatePart, colorOptions]);

  const handleCreateColorMix = useCallback(() => {
    const defaultMix: ColorMixParts = {
      colorSpace: 'srgb',
      baseColor: colorOptions.length > 0 ? `var(${colorOptions[0].name})` : '#000000',
      percentage: 25,
      blendColor: 'transparent',
    };
    updatePart('color', composeColorMix(defaultMix));
  }, [updatePart, colorOptions]);

  const colorDisplayValue = useMemo(() => {
    if (colorMixParts) {
      const baseLabel = colorMixParts.baseColor.startsWith('var(')
        ? formatLabel(colorMixParts.baseColor.match(/var\(([^)]+)\)/)?.[1] || '')
        : colorMixParts.baseColor;
      return `${baseLabel} ${colorMixParts.percentage}%`;
    }
    if (parts.color.startsWith('var(')) {
      const match = parts.color.match(/var\(([^)]+)\)/);
      return match ? formatLabel(match[1]) : parts.color;
    }
    return parts.color || 'Select color...';
  }, [parts.color, colorMixParts]);

  const isColorVar = parts.color.startsWith('var(');
  const isColorMix = !!colorMixParts;
  const defaultTab = isColorMix ? 'color-mix' : isColorVar ? 'reference' : 'custom';

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
              {isColorMix && (
                <span className="w-4 h-4 rounded border flex-shrink-0 bg-muted" title="color-mix()">
                  <svg viewBox="0 0 16 16" className="w-full h-full">
                    <circle cx="6" cy="8" r="4" fill="currentColor" opacity="0.3" />
                    <circle cx="10" cy="8" r="4" fill="currentColor" opacity="0.6" />
                  </svg>
                </span>
              )}
              {parts.color && !isColorVar && !isColorMix && (
                <span 
                  className="w-4 h-4 rounded border flex-shrink-0" 
                  style={{ backgroundColor: parts.color }}
                />
              )}
              <span className={isColorVar || isColorMix ? "capitalize text-muted-foreground truncate" : "truncate"}>
                {colorDisplayValue}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <Tabs defaultValue={defaultTab} className="w-[260px]">
              <TabsList className="w-full">
                <TabsTrigger value="reference" className="flex-1 text-xs">Reference</TabsTrigger>
                <TabsTrigger value="color-mix" className="flex-1 text-xs">Color Mix</TabsTrigger>
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
              <TabsContent value="color-mix" className="mt-2 space-y-3">
                {!isColorMix ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground mb-3">
                      Create a blended color using color-mix()
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateColorMix}
                      data-testid={`border-create-color-mix-${label}`}
                    >
                      Create Color Mix
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Base Color</label>
                      <Select
                        value={colorMixParts.baseColor}
                        onValueChange={(val) => handleColorMixChange({ baseColor: val })}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`border-mix-base-${label}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {colorOptions.map((colorVar) => (
                            <SelectItem key={colorVar.name} value={`var(${colorVar.name})`} className="text-xs">
                              <div className="flex items-center gap-2">
                                <span 
                                  className="w-3 h-3 rounded border flex-shrink-0" 
                                  style={{ backgroundColor: colorVar.value }}
                                />
                                <span className="capitalize">{formatLabel(colorVar.name)}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-muted-foreground">Amount</label>
                        <span className="text-xs font-mono text-muted-foreground">{colorMixParts.percentage}%</span>
                      </div>
                      <Slider
                        value={[colorMixParts.percentage]}
                        onValueChange={([val]) => handleColorMixChange({ percentage: val })}
                        min={1}
                        max={100}
                        step={1}
                        className="w-full"
                        data-testid={`border-mix-pct-${label}`}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Blend With</label>
                      <Select
                        value={colorMixParts.blendColor}
                        onValueChange={(val) => handleColorMixChange({ blendColor: val })}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`border-mix-blend-${label}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BLEND_COLORS.map((c) => (
                            <SelectItem key={c} value={c} className="text-xs capitalize">
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Color Space</label>
                      <Select
                        value={colorMixParts.colorSpace}
                        onValueChange={(val) => handleColorMixChange({ colorSpace: val })}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`border-mix-space-${label}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COLOR_SPACES.map((cs) => (
                            <SelectItem key={cs} value={cs} className="text-xs">
                              {cs}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-1 border-t">
                      <p className="text-[10px] font-mono text-muted-foreground break-all">
                        {parts.color}
                      </p>
                    </div>
                  </>
                )}
              </TabsContent>
              <TabsContent value="custom" className="mt-2">
                <Input
                  value={isColorVar ? '' : (isColorMix ? '' : parts.color)}
                  onChange={(e) => updatePart('color', e.target.value)}
                  className="font-mono text-xs"
                  placeholder="#cccccc or color-mix(...)"
                  data-testid={`border-color-custom-${label}`}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Enter a hex color, var() reference, or color-mix() expression
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
