import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { RotateCcw, ChevronDown } from 'lucide-react';
import { CSSVariable } from './types';

interface WeightReferenceSelectProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  baseWeightOptions: CSSVariable[];
  description?: string;
}

export function WeightReferenceSelect({ 
  value, 
  defaultValue, 
  onChange, 
  label,
  baseWeightOptions,
  description,
}: WeightReferenceSelectProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const isModified = value !== defaultValue;
  const isVarReference = value.startsWith('var(');

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  const formatLabel = (name: string) => {
    return name.replace(/^--/, '').replace(/-/g, ' ');
  };

  const displayValue = useMemo(() => {
    if (isVarReference) {
      const match = value.match(/var\(([^)]+)\)/);
      return match ? formatLabel(match[1]) : value;
    }
    return value;
  }, [value, isVarReference]);

  const handleSelectReference = useCallback((weightVar: CSSVariable) => {
    onChange(`var(${weightVar.name})`);
    setPickerOpen(false);
  }, [onChange]);

  const handleCustomWeightChange = useCallback(() => {
    if (customValue) {
      onChange(customValue);
      setPickerOpen(false);
      setCustomValue('');
    }
  }, [customValue, onChange]);

  const commonWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900];

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate capitalize" data-testid={`weight-ref-label-${label}`}>
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
          <Button
            variant="outline"
            className="w-1/2 h-8 justify-between font-normal"
            data-testid={`weight-ref-trigger-${label}`}
          >
            <span className={`truncate capitalize ${isVarReference ? 'text-muted-foreground' : ''}`}>
              {displayValue}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-3" align="end">
          <Tabs defaultValue={isVarReference ? "reference" : "custom"} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="reference" className="flex-1 text-xs">Reference</TabsTrigger>
              <TabsTrigger value="custom" className="flex-1 text-xs">Custom</TabsTrigger>
            </TabsList>
            <TabsContent value="reference" className="mt-2">
              <ScrollArea className="h-[120px]">
                <div className="space-y-1">
                  {baseWeightOptions.map((weightVar) => (
                    <button
                      key={weightVar.name}
                      type="button"
                      onClick={() => handleSelectReference(weightVar)}
                      className={`w-full flex flex-col px-2 py-1.5 rounded-md text-left text-sm hover-elevate ${
                        value === `var(${weightVar.name})` ? 'bg-accent' : ''
                      }`}
                      data-testid={`weight-option-${weightVar.name}`}
                    >
                      <span className="capitalize">{formatLabel(weightVar.name)}</span>
                      <span className="text-xs text-muted-foreground">{weightVar.value}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="custom" className="mt-2">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Choose a custom weight value:
                </p>
                <div className="flex flex-wrap gap-1">
                  {commonWeights.map((weight) => (
                    <button
                      key={weight}
                      type="button"
                      onClick={() => {
                        onChange(String(weight));
                        setPickerOpen(false);
                      }}
                      className={`px-2 py-1 rounded text-xs hover-elevate ${
                        value === String(weight) ? 'bg-accent' : 'bg-muted'
                      }`}
                      data-testid={`weight-preset-${weight}`}
                    >
                      {weight}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    placeholder="Custom..."
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    className="h-8 text-sm"
                    data-testid={`weight-custom-input-${label}`}
                  />
                  <Button 
                    size="sm" 
                    onClick={handleCustomWeightChange}
                    disabled={!customValue}
                    data-testid={`weight-custom-apply-${label}`}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleReset}
        className={`h-8 w-8 ${!isModified ? 'invisible' : ''}`}
        data-testid={`weight-ref-reset-${label}`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default WeightReferenceSelect;
