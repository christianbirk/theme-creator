import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RotateCcw, Minus, Plus } from 'lucide-react';

interface NumberInputProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  step?: number;
  min?: number;
  max?: number;
}

export function NumberInput({ 
  value, 
  defaultValue, 
  onChange, 
  label, 
  description,
  step = 0.1,
  min = 0,
  max = 1000
}: NumberInputProps) {
  const isModified = value !== defaultValue;
  const numValue = parseFloat(value) || 0;

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const handleChange = useCallback((newValue: number) => {
    const clamped = Math.min(max, Math.max(min, newValue));
    const formatted = Number.isInteger(clamped) ? clamped.toString() : clamped.toFixed(2).replace(/\.?0+$/, '');
    onChange(formatted);
  }, [min, max, onChange]);

  const increment = useCallback(() => {
    handleChange(numValue + step);
  }, [numValue, step, handleChange]);

  const decrement = useCallback(() => {
    handleChange(numValue - step);
  }, [numValue, step, handleChange]);

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono truncate" data-testid={`number-label-${label}`}>
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

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={decrement}
          className="h-8 w-8"
          data-testid={`number-decrement-${label}`}
        >
          <Minus className="h-3 w-3" />
        </Button>

        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          step={step}
          min={min}
          max={max}
          className="w-20 h-8 text-center font-mono text-sm"
          data-testid={`number-input-${label}`}
        />

        <Button
          variant="outline"
          size="icon"
          onClick={increment}
          className="h-8 w-8"
          data-testid={`number-increment-${label}`}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleReset}
        className={`h-8 w-8 ${!isModified ? 'invisible' : ''}`}
        data-testid={`number-reset-${label}`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default NumberInput;
