import { useCallback, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';

interface SizeInputProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
}

const unitOptions = ['px', 'rem', 'em', '%', 'vh', 'vw'];

function parseValue(value: string): { number: number; unit: string } {
  const match = value.match(/^([\d.]+)(.*)$/);
  if (match) {
    return { number: parseFloat(match[1]) || 0, unit: match[2] || 'px' };
  }
  return { number: 0, unit: 'px' };
}

export function SizeInput({ value, defaultValue, onChange, label, description }: SizeInputProps) {
  const isModified = value !== defaultValue;
  const [parsed, setParsed] = useState(() => parseValue(value));

  useEffect(() => {
    setParsed(parseValue(value));
  }, [value]);

  const handleNumberChange = useCallback((newNumber: number) => {
    const clamped = Math.max(0, newNumber);
    onChange(`${clamped}${parsed.unit}`);
  }, [parsed.unit, onChange]);

  const handleUnitChange = useCallback((newUnit: string) => {
    onChange(`${parsed.number}${newUnit}`);
  }, [parsed.number, onChange]);

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono truncate" data-testid={`size-label-${label}`}>
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
        <Input
          type="number"
          value={parsed.number}
          onChange={(e) => handleNumberChange(parseFloat(e.target.value) || 0)}
          className="w-20 h-8 text-center font-mono text-sm"
          data-testid={`size-input-${label}`}
        />

        <Select value={parsed.unit} onValueChange={handleUnitChange}>
          <SelectTrigger className="w-16 h-8" data-testid={`size-unit-${label}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {unitOptions.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleReset}
        className={`h-8 w-8 ${!isModified ? 'invisible' : ''}`}
        data-testid={`size-reset-${label}`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default SizeInput;
