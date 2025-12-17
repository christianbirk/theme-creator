import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { HexColorPicker } from 'react-colorful';
import { RotateCcw } from 'lucide-react';
import { CSSVariable } from './types';

interface ColorPickerProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  colorOptions?: CSSVariable[];
  isBaseColor?: boolean;
}

export function ColorPicker({ 
  value, 
  defaultValue, 
  onChange, 
  label, 
  description,
  colorOptions = [],
  isBaseColor = false,
}: ColorPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isModified = value !== defaultValue;

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

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
        </PopoverContent>
      </Popover>

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-60 h-8 font-mono text-xs"
        placeholder="#000000"
        data-testid={`color-input-${label}`}
      />

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
