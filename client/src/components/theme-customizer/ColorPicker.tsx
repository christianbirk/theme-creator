import { useState, useCallback } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  const [isOpen, setIsOpen] = useState(false);
  const isModified = value !== defaultValue;

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  return (
    <div className="flex items-center gap-3 py-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-10 h-9 p-0 border-2"
            style={{ backgroundColor: value }}
            data-testid={`color-picker-trigger-${label}`}
          >
            <span className="sr-only">Pick color for {label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex flex-col gap-3">
            <HexColorPicker color={value} onChange={onChange} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#</span>
              <HexColorInput
                color={value}
                onChange={onChange}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-mono uppercase"
                data-testid={`color-input-hex-${label}`}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono truncate" data-testid={`color-label-${label}`}>
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

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 h-8 font-mono text-xs uppercase"
        data-testid={`color-input-text-${label}`}
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
