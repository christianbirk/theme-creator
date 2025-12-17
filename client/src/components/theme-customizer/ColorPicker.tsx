import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const isModified = value !== defaultValue;

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

  if (isBaseColor) {
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

        <div
          className="w-8 h-8 rounded-md border-2 border-input flex-shrink-0"
          style={{ backgroundColor: value }}
          data-testid={`color-swatch-${label}`}
        />

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

      <div
        className="w-8 h-8 rounded-md border-2 border-input flex-shrink-0"
        style={{ backgroundColor: resolvedColor }}
        data-testid={`color-swatch-${label}`}
      />

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-60 h-8" data-testid={`color-select-${label}`}>
          <SelectValue placeholder="Select color">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded border border-input flex-shrink-0"
                style={{ backgroundColor: resolvedColor }}
              />
              <span className="truncate capitalize text-xs">
                {value.match(/var\(([^)]+)\)/) 
                  ? formatLabel(value.match(/var\(([^)]+)\)/)?.[1] || value)
                  : value
                }
              </span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {colorOptions.map((colorVar) => (
            <SelectItem 
              key={colorVar.name} 
              value={`var(${colorVar.name})`}
              data-testid={`color-option-${colorVar.name}`}
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded border border-input flex-shrink-0"
                  style={{ backgroundColor: colorVar.value }}
                />
                <span className="capitalize">{formatLabel(colorVar.name)}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
