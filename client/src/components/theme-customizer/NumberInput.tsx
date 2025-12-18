import { useCallback, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RotateCcw } from 'lucide-react';
import { CSSVariable } from './types';

interface NumberInputProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  description?: string;
  weightOptions?: CSSVariable[];
  isBaseFontWeight?: boolean;
  lineHeightOptions?: CSSVariable[];
  isBaseLineHeight?: boolean;
}

export function NumberInput({ 
  value, 
  defaultValue, 
  onChange, 
  label, 
  description,
  weightOptions = [],
  isBaseFontWeight = false,
  lineHeightOptions = [],
  isBaseLineHeight = false,
}: NumberInputProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isModified = value !== defaultValue;
  const isVarReference = value.startsWith('var(');

  // Determine which options to use (weight or line-height)
  const referenceOptions = weightOptions.length > 0 ? weightOptions : lineHeightOptions;
  const isBaseValue = isBaseFontWeight || isBaseLineHeight;
  const hasReferenceOptions = referenceOptions.length > 0;

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const formatLabel = (name: string) => {
    return name.replace(/^--/, '').replace(/-/g, ' ');
  };

  const handleSelectReference = useCallback((refVar: CSSVariable) => {
    onChange(`var(${refVar.name})`);
    setPickerOpen(false);
  }, [onChange]);

  const displayValue = useMemo(() => {
    if (isVarReference) {
      const match = value.match(/var\(([^)]+)\)/);
      return match ? formatLabel(match[1]) : value;
    }
    return value;
  }, [value, isVarReference]);

  // Determine placeholder based on type
  const placeholder = weightOptions.length > 0 
    ? 'Select weight...' 
    : lineHeightOptions.length > 0 
      ? 'Select line-height...' 
      : 'Enter value...';

  const customPlaceholder = weightOptions.length > 0 
    ? 'e.g., 400, 700' 
    : lineHeightOptions.length > 0 
      ? 'e.g., 1.5, 1.2' 
      : 'Enter value';

  const customHelpText = weightOptions.length > 0 
    ? 'Enter a custom font weight (100-900)' 
    : lineHeightOptions.length > 0 
      ? 'Enter a custom line height value' 
      : 'Enter a custom value';

  // If base value or no reference options, show simple input
  if (isBaseValue || !hasReferenceOptions) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm truncate capitalize" data-testid={`number-label-${label}`}>
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
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-1/2 h-8 font-mono text-sm"
          data-testid={`number-input-${label}`}
        />

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

  // Show reference picker
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate capitalize" data-testid={`number-label-${label}`}>
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
            className="w-1/2 h-8 px-3 flex items-center border rounded-md bg-background text-xs font-mono truncate cursor-pointer hover:border-primary transition-colors text-left"
            data-testid={`number-trigger-${label}`}
          >
            {isVarReference ? (
              <span className="capitalize text-muted-foreground">{displayValue}</span>
            ) : (
              <span>{value || placeholder}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <Tabs defaultValue={isVarReference ? "reference" : "custom"} className="w-[240px]">
            <TabsList className="w-full">
              <TabsTrigger value="reference" className="flex-1 text-xs">Reference</TabsTrigger>
              <TabsTrigger value="custom" className="flex-1 text-xs">Custom</TabsTrigger>
            </TabsList>
            <TabsContent value="reference" className="mt-2">
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {referenceOptions.map((refVar) => (
                    <button
                      key={refVar.name}
                      type="button"
                      onClick={() => handleSelectReference(refVar)}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left text-sm hover-elevate ${
                        value === `var(${refVar.name})` ? 'bg-accent' : ''
                      }`}
                      data-testid={`reference-option-${refVar.name}`}
                    >
                      <span className="capitalize truncate">{formatLabel(refVar.name)}</span>
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[100px]">{refVar.value}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="custom" className="mt-2">
              <Input
                value={isVarReference ? '' : value}
                onChange={(e) => onChange(e.target.value)}
                className="font-mono text-xs"
                placeholder={customPlaceholder}
                data-testid={`number-custom-input-${label}`}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {customHelpText}
              </p>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

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
