import { useCallback, useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
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
  const isModified = value !== defaultValue;
  const isVarReference = value.startsWith('var(');
  
  // Get current numeric weight for slider
  const getCurrentWeight = useCallback(() => {
    if (isVarReference) return 400;
    const num = parseInt(value, 10);
    return isNaN(num) ? 400 : Math.max(100, Math.min(900, num));
  }, [value, isVarReference]);
  
  const [sliderValue, setSliderValue] = useState(getCurrentWeight());
  
  // Sync slider when popover opens
  useEffect(() => {
    if (pickerOpen) {
      setSliderValue(getCurrentWeight());
    }
  }, [pickerOpen, getCurrentWeight]);

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

  const handleSliderChange = useCallback((newValue: number[]) => {
    setSliderValue(newValue[0]);
  }, []);
  
  const handleSliderCommit = useCallback((newValue: number[]) => {
    onChange(String(newValue[0]));
  }, [onChange]);

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
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Font Weight:</span>
                  <span className="text-sm font-medium tabular-nums" data-testid={`weight-slider-value-${label}`}>
                    {sliderValue}
                  </span>
                </div>
                <Slider
                  value={[sliderValue]}
                  min={100}
                  max={900}
                  step={10}
                  onValueChange={handleSliderChange}
                  onValueCommit={handleSliderCommit}
                  className="w-full"
                  data-testid={`weight-slider-${label}`}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>100</span>
                  <span>400</span>
                  <span>700</span>
                  <span>900</span>
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
