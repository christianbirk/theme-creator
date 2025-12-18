import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';
import { CSSVariable } from './types';

interface FamilyReferenceSelectProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  baseFamilyOptions: CSSVariable[];
  description?: string;
}

export function FamilyReferenceSelect({ 
  value, 
  defaultValue, 
  onChange, 
  label,
  baseFamilyOptions,
  description,
}: FamilyReferenceSelectProps) {
  const isModified = value !== defaultValue;

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const formatLabel = (name: string) => {
    return name.replace(/^--/, '').replace(/-/g, ' ');
  };

  const displayValue = useMemo(() => {
    if (value.startsWith('var(')) {
      const match = value.match(/var\(([^)]+)\)/);
      return match ? `var(${match[1]})` : value;
    }
    return value;
  }, [value]);

  const handleChange = useCallback((newValue: string) => {
    onChange(newValue);
  }, [onChange]);

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate capitalize" data-testid={`family-ref-label-${label}`}>
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

      <Select value={displayValue} onValueChange={handleChange}>
        <SelectTrigger className="w-48 h-8" data-testid={`family-ref-trigger-${label}`}>
          <SelectValue placeholder="Select family...">
            {value.startsWith('var(') ? (
              <span className="capitalize">{formatLabel(value.replace(/var\(([^)]+)\)/, '$1'))}</span>
            ) : (
              value
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {baseFamilyOptions.map((fontVar) => (
            <SelectItem key={fontVar.name} value={`var(${fontVar.name})`}>
              <div className="flex flex-col">
                <span className="capitalize">{formatLabel(fontVar.name)}</span>
                <span className="text-xs text-muted-foreground">{fontVar.value}</span>
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
        data-testid={`family-ref-reset-${label}`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default FamilyReferenceSelect;
