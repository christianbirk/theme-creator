import { useState, useMemo, useCallback, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search, Upload, RotateCcw, ChevronRight } from 'lucide-react';
import { CSSVariable, VariableCategory, formatVariableName, formatSectionName, sectionIcons } from './types';
import { ColorPicker } from './ColorPicker';
import { SizeInput } from './SizeInput';
import { FontPicker } from './FontPicker';
import { NumberInput } from './NumberInput';
import { StringInput } from './StringInput';

// Subsections that are only visible in expert mode
const EXPERT_ONLY_SUBSECTIONS = ['neutral-colors'];

interface ControlPanelProps {
  categories: VariableCategory[];
  variables: CSSVariable[];
  onVariableChange: (name: string, value: string) => void;
  onResetAll: () => void;
  onResetCategory: (categoryId: string) => void;
  onImportSCSS: (file: File) => void;
}

interface SectionData {
  id: string;
  name: string;
  subSections: {
    id: string;
    name: string;
    variables: CSSVariable[];
  }[];
}

export function ControlPanel({ 
  variables, 
  onVariableChange, 
  onResetAll, 
  onImportSCSS 
}: ControlPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>(['colors']);
  const [expandedSubSections, setExpandedSubSections] = useState<string[]>([]);
  const [expertMode, setExpertMode] = useState(() => {
    const stored = localStorage.getItem('theme-customizer-expert-mode');
    return stored === 'true';
  });

  // Persist expert mode to localStorage
  useEffect(() => {
    localStorage.setItem('theme-customizer-expert-mode', String(expertMode));
  }, [expertMode]);

  const baseColorOptions = useMemo(() => {
    return variables.filter(v => 
      v.type === 'color' && 
      (v.subSection === 'identity-colors' || v.subSection === 'neutral-colors')
    );
  }, [variables]);

  const isBaseColor = useCallback((variable: CSSVariable) => {
    return variable.subSection === 'identity-colors' || variable.subSection === 'neutral-colors';
  }, []);

  const sections = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const sectionMap = new Map<string, Map<string, CSSVariable[]>>();

    variables.forEach(v => {
      const mainSection = v.mainSection || 'other';
      const subSection = v.subSection || 'general';

      // Filter out expert-only subsections when not in expert mode
      if (!expertMode && EXPERT_ONLY_SUBSECTIONS.includes(subSection)) {
        return;
      }

      if (query && !v.name.toLowerCase().includes(query)) {
        return;
      }

      if (!sectionMap.has(mainSection)) {
        sectionMap.set(mainSection, new Map());
      }
      const subMap = sectionMap.get(mainSection)!;
      if (!subMap.has(subSection)) {
        subMap.set(subSection, []);
      }
      subMap.get(subSection)!.push(v);
    });

    const result: SectionData[] = [];
    sectionMap.forEach((subMap, mainId) => {
      const subSections: SectionData['subSections'] = [];
      subMap.forEach((vars, subId) => {
        subSections.push({
          id: subId,
          name: formatSectionName(subId),
          variables: vars
        });
      });
      result.push({
        id: mainId,
        name: formatSectionName(mainId),
        subSections
      });
    });

    return result;
  }, [variables, searchQuery, expertMode]);

  const modifiedCount = useMemo(() => 
    variables.filter(v => v.value !== v.defaultValue).length
  , [variables]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportSCSS(file);
      e.target.value = '';
    }
  }, [onImportSCSS]);

  const renderVariableInput = (variable: CSSVariable) => {
    const displayName = formatVariableName(variable.name);
    
    switch (variable.type) {
      case 'color':
        return (
          <ColorPicker
            key={variable.name}
            value={variable.value}
            defaultValue={variable.defaultValue}
            onChange={(value) => onVariableChange(variable.name, value)}
            label={displayName}
            colorOptions={baseColorOptions}
            isBaseColor={isBaseColor(variable)}
          />
        );
      case 'font':
        return (
          <FontPicker
            key={variable.name}
            value={variable.value}
            defaultValue={variable.defaultValue}
            onChange={(value) => onVariableChange(variable.name, value)}
            label={displayName}
          />
        );
      case 'size':
        return (
          <SizeInput
            key={variable.name}
            value={variable.value}
            defaultValue={variable.defaultValue}
            onChange={(value) => onVariableChange(variable.name, value)}
            label={displayName}
          />
        );
      case 'number':
        return (
          <NumberInput
            key={variable.name}
            value={variable.value}
            defaultValue={variable.defaultValue}
            onChange={(value) => onVariableChange(variable.name, value)}
            label={displayName}
          />
        );
      default:
        return (
          <StringInput
            key={variable.name}
            value={variable.value}
            defaultValue={variable.defaultValue}
            onChange={(value) => onVariableChange(variable.name, value)}
            label={displayName}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold">Theme Variables</h2>
          <label>
            <input
              type="file"
              accept=".scss,.css"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-import-scss"
            />
            <Button variant="outline" size="sm" asChild>
              <span className="cursor-pointer">
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Import
              </span>
            </Button>
          </label>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-variables"
          />
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Switch
              id="expert-mode"
              checked={expertMode}
              onCheckedChange={setExpertMode}
              data-testid="switch-expert-mode"
            />
            <Label htmlFor="expert-mode" className="text-sm cursor-pointer">
              Expert mode
            </Label>
          </div>
          {modifiedCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {modifiedCount} modified
            </span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Accordion 
          type="multiple" 
          value={expandedSections}
          onValueChange={setExpandedSections}
          className="w-full"
        >
          {sections.map(section => (
            <AccordionItem key={section.id} value={section.id} className="border-b">
              <AccordionTrigger 
                className="px-4 py-3 hover:no-underline"
                data-testid={`accordion-section-${section.id}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{section.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({section.subSections.reduce((acc, sub) => acc + sub.variables.length, 0)})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <Accordion 
                  type="multiple" 
                  value={expandedSubSections}
                  onValueChange={setExpandedSubSections}
                  className="w-full"
                >
                  {section.subSections.map(subSection => (
                    <AccordionItem 
                      key={`${section.id}-${subSection.id}`} 
                      value={`${section.id}-${subSection.id}`}
                      className="border-b-0 border-t"
                    >
                      <AccordionTrigger 
                        className="px-6 py-2 hover:no-underline text-sm"
                        data-testid={`accordion-subsection-${section.id}-${subSection.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span>{subSection.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({subSection.variables.length})
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-2">
                        <div className="space-y-1">
                          {subSection.variables.map(renderVariableInput)}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {sections.length === 0 && searchQuery && (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">No variables found matching "{searchQuery}"</p>
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            {modifiedCount > 0 ? (
              <span className="font-medium text-foreground">{modifiedCount}</span>
            ) : '0'} of {variables.length} modified
          </span>
          
          {modifiedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetAll}
              className="text-xs h-7"
              data-testid="button-reset-all"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset all
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ControlPanel;
