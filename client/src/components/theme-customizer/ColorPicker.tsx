import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RotateCcw } from 'lucide-react';

interface ColorPickerProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
}

export function ColorPicker({ value, defaultValue, onChange, label, description }: ColorPickerProps) {
  const isModified = value !== defaultValue;

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

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

export default ColorPicker;
