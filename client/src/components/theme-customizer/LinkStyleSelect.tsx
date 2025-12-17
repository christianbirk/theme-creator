import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCcw } from 'lucide-react';

interface LinkStyleSelectProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
}

const LINK_STYLE_OPTIONS = [
  { value: 'underline', label: 'Underline' },
  { value: 'arrow', label: 'Arrow' },
];

export function LinkStyleSelect({ 
  value, 
  defaultValue, 
  onChange, 
  label, 
  description
}: LinkStyleSelectProps) {
  const isModified = value !== defaultValue;

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate capitalize" data-testid={`link-style-label-${label}`}>
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

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-60 h-8" data-testid={`link-style-select-${label}`}>
          <SelectValue placeholder="Select style" />
        </SelectTrigger>
        <SelectContent>
          {LINK_STYLE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleReset}
        className={`h-8 w-8 ${!isModified ? 'invisible' : ''}`}
        data-testid={`link-style-reset-${label}`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default LinkStyleSelect;
