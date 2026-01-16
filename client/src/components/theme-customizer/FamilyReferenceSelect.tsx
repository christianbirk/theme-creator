import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RotateCcw, ChevronDown } from 'lucide-react';
import { CSSVariable } from './types';
import { GoogleFontPicker, CustomFont } from './GoogleFontPicker';

interface FamilyReferenceSelectProps {
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
  label: string;
  baseFamilyOptions: CSSVariable[];
  description?: string;
  customFonts?: CustomFont[];
}

export function FamilyReferenceSelect({ 
  value, 
  defaultValue, 
  onChange, 
  label,
  baseFamilyOptions,
  description,
  customFonts = [],
}: FamilyReferenceSelectProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
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

  const handleSelectReference = useCallback((fontVar: CSSVariable) => {
    onChange(`var(${fontVar.name})`);
    setPickerOpen(false);
  }, [onChange]);

  const handleCustomFontChange = useCallback((fontValue: string) => {
    onChange(fontValue);
    setPickerOpen(false);
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

      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-1/2 h-8 justify-between font-normal"
            data-testid={`family-ref-trigger-${label}`}
          >
            <span className={`truncate capitalize ${isVarReference ? 'text-muted-foreground' : ''}`}>
              {displayValue}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-3" align="end">
          <Tabs defaultValue={isVarReference ? "reference" : "custom"} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="reference" className="flex-1 text-xs">Reference</TabsTrigger>
              <TabsTrigger value="custom" className="flex-1 text-xs">Custom</TabsTrigger>
            </TabsList>
            <TabsContent value="reference" className="mt-2">
              <ScrollArea className="h-[150px]">
                <div className="space-y-1">
                  {baseFamilyOptions.map((fontVar) => (
                    <button
                      key={fontVar.name}
                      type="button"
                      onClick={() => handleSelectReference(fontVar)}
                      className={`w-full flex flex-col px-2 py-1.5 rounded-md text-left text-sm hover-elevate ${
                        value === `var(${fontVar.name})` ? 'bg-accent' : ''
                      }`}
                      data-testid={`family-option-${fontVar.name}`}
                    >
                      <span className="capitalize">{formatLabel(fontVar.name)}</span>
                      <span className="text-xs text-muted-foreground truncate">{fontVar.value}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="custom" className="mt-2">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Choose a custom font to override the reference:
                </p>
                <GoogleFontPicker
                  value={isVarReference ? '' : value}
                  defaultValue=""
                  onChange={handleCustomFontChange}
                  label=""
                  embedded
                  customFonts={customFonts}
                />
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
        data-testid={`family-ref-reset-${label}`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default FamilyReferenceSelect;
