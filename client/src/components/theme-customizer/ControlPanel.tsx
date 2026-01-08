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
import { GoogleFontPicker } from './GoogleFontPicker';
import { NumberInput } from './NumberInput';
import { StringInput } from './StringInput';
import { LinkStyleSelect } from './LinkStyleSelect';
import { SelectInput } from './SelectInput';
import { FamilyReferenceSelect } from './FamilyReferenceSelect';
import { WeightReferenceSelect } from './WeightReferenceSelect';

// Subsections that are only visible in expert mode
const EXPERT_ONLY_SUBSECTIONS = ['neutral-colors'];

// Individual variables that are only visible in expert mode
const EXPERT_ONLY_VARIABLES = [
  '--h1-font-family', '--h2-font-family', '--h3-font-family', '--h4-font-family', '--h5-font-family', '--h6-font-family',
  '--h1-font-weight', '--h2-font-weight', '--h3-font-weight', '--h4-font-weight', '--h5-font-weight', '--h6-font-weight',
  '--h1-text-transform', '--h2-text-transform', '--h3-text-transform', '--h4-text-transform', '--h5-text-transform', '--h6-text-transform',
];

// Variables that should use text-transform select (none/uppercase)
const TEXT_TRANSFORM_VARIABLES = [
  '--btn-universal-text-transform',
  '--label-text-transform',
  '--h1-text-transform', '--h2-text-transform', '--h3-text-transform',
  '--h4-text-transform', '--h5-text-transform', '--h6-text-transform',
  '--pre-heading-text-transform',
  '--footer-heading-text-transform',
  '--nav-main-link-text-transform',
  '--service-text-transform',
  '--link-arrow-text-transform',
];

// Variables that should use alignment select (left/center)
const ALIGNMENT_VARIABLES = ['--nav-main-align'];

// Variables that should use family reference select (base/heading)
const FAMILY_REFERENCE_VARIABLES = ['--pre-heading-family'];

// Variables that should use hyphens select (auto/none)
const HYPHENS_VARIABLES = ['--font-heading-hyphens'];

// Variables that should use weight reference select (base/heading weight)
const WEIGHT_REFERENCE_VARIABLES = ['--pre-heading-weight'];

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

  // Base font size options (--font-xsmall, --font-small, --font-normal, etc.)
  const baseFontSizeOptions = useMemo(() => {
    return variables.filter(v => 
      v.subSection === 'font-sizes' && 
      v.name.match(/^--font-(xsmall|small|normal|xnormal|medium|xmedium|large|xlarge|xxlarge)$/)
    );
  }, [variables]);

  // Base font family options (--font-base-family, --font-heading-family)
  const baseFontFamilyOptions = useMemo(() => {
    return variables.filter(v => 
      v.name.match(/^--font-(base|heading)-family$/)
    );
  }, [variables]);

  // Base font weight options (--font-base-weight, --font-heading-weight)
  const baseFontWeightOptions = useMemo(() => {
    return variables.filter(v => 
      v.name.match(/^--font-(base|heading)-weight$/)
    );
  }, [variables]);

  // Base line height options (--font-*-line-height)
  const baseLineHeightOptions = useMemo(() => {
    return variables.filter(v => 
      v.name.match(/^--font-(xsmall|small|normal|xnormal|medium|xmedium|large|xlarge|xxlarge)-line-height$/)
    );
  }, [variables]);

  // Base border radius options (--universal-border-radius)
  const baseBorderRadiusOptions = useMemo(() => {
    return variables.filter(v => 
      v.name === '--universal-border-radius'
    );
  }, [variables]);

  const isBaseColor = useCallback((variable: CSSVariable) => {
    return variable.subSection === 'identity-colors' || variable.subSection === 'neutral-colors';
  }, []);

  // Check if a variable is a base font size/weight/family definition
  const isBaseFontSize = useCallback((variable: CSSVariable) => {
    return !!variable.name.match(/^--font-(xsmall|small|normal|xnormal|medium|xmedium|large|xlarge|xxlarge)$/);
  }, []);

  const isBaseFontFamily = useCallback((variable: CSSVariable) => {
    return !!variable.name.match(/^--font-(base|heading)-family$/);
  }, []);

  const isBaseFontWeight = useCallback((variable: CSSVariable) => {
    return !!variable.name.match(/^--font-(base|heading)-weight$/);
  }, []);

  // Check if a variable is a base line height definition
  const isBaseLineHeight = useCallback((variable: CSSVariable) => {
    return !!variable.name.match(/^--font-(xsmall|small|normal|xnormal|medium|xmedium|large|xlarge|xxlarge)-line-height$/);
  }, []);

  // Check if a variable is a base border radius definition
  const isBaseBorderRadius = useCallback((variable: CSSVariable) => {
    return variable.name === '--universal-border-radius';
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

      // Filter out expert-only individual variables when not in expert mode
      if (!expertMode && EXPERT_ONLY_VARIABLES.includes(v.name)) {
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

  // Check if a variable is a font-size reference (not a base definition)
  const isFontSizeReference = useCallback((variable: CSSVariable) => {
    return variable.name.includes('font-size') && !isBaseFontSize(variable);
  }, [isBaseFontSize]);

  // Check if a variable is a font-family reference
  const isFontFamilyReference = useCallback((variable: CSSVariable) => {
    return variable.name.includes('font-family') && !isBaseFontFamily(variable);
  }, [isBaseFontFamily]);

  // Check if a variable is a font-weight reference
  const isFontWeightReference = useCallback((variable: CSSVariable) => {
    return variable.name.includes('font-weight') && !isBaseFontWeight(variable);
  }, [isBaseFontWeight]);

  // Check if a variable is a line-height reference
  const isLineHeightReference = useCallback((variable: CSSVariable) => {
    return variable.name.includes('line-height') && !isBaseLineHeight(variable);
  }, [isBaseLineHeight]);

  // Check if a variable is a border-radius reference
  const isBorderRadiusReference = useCallback((variable: CSSVariable) => {
    return variable.name.includes('border-radius') && !isBaseBorderRadius(variable);
  }, [isBaseBorderRadius]);

  // Check if a variable is the link-style variable
  const isLinkStyleVariable = useCallback((variable: CSSVariable) => {
    return variable.name === '--link-style';
  }, []);

  // Get the contrast background for a color variable
  // Only checks direct hex/rgb values, not var() references
  const getContrastBackground = useCallback((variable: CSSVariable): string | undefined => {
    const name = variable.name.toLowerCase();
    
    // Only show contrast for text/foreground colors with direct values
    const textColorPatterns = [
      'font-base-color',
      'heading-color',
      'pre-heading-color',
      'lead-color',
      'link-color',
      'accent-color',
      '-fg', // foreground colors like btn-fg
    ];
    
    // Check if this is a text color variable
    const isTextColor = textColorPatterns.some(pattern => name.includes(pattern));
    if (!isTextColor) return undefined;
    
    // Only check if the current value is a direct color (not a reference)
    if (variable.value.startsWith('var(')) return undefined;
    
    // Find the appropriate background - use default backgrounds
    const isDarkBg = name.includes('-bg-dark');
    
    if (isDarkBg) {
      // Use a typical dark background
      return '#1a1a1a';
    } else {
      // Use a typical light background
      return '#ffffff';
    }
  }, []);

  const renderVariableInput = (variable: CSSVariable) => {
    const displayName = formatVariableName(variable.name);
    
    // Handle special select inputs first (before type-based routing)
    if (TEXT_TRANSFORM_VARIABLES.includes(variable.name)) {
      return (
        <SelectInput
          key={variable.name}
          value={variable.value}
          defaultValue={variable.defaultValue}
          onChange={(value) => onVariableChange(variable.name, value)}
          label={displayName}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'uppercase', label: 'Uppercase' },
          ]}
        />
      );
    }
    
    if (ALIGNMENT_VARIABLES.includes(variable.name)) {
      return (
        <SelectInput
          key={variable.name}
          value={variable.value}
          defaultValue={variable.defaultValue}
          onChange={(value) => onVariableChange(variable.name, value)}
          label={displayName}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
          ]}
        />
      );
    }
    
    if (FAMILY_REFERENCE_VARIABLES.includes(variable.name)) {
      return (
        <FamilyReferenceSelect
          key={variable.name}
          value={variable.value}
          defaultValue={variable.defaultValue}
          onChange={(value) => onVariableChange(variable.name, value)}
          label={displayName}
          baseFamilyOptions={baseFontFamilyOptions}
        />
      );
    }
    
    if (HYPHENS_VARIABLES.includes(variable.name)) {
      return (
        <SelectInput
          key={variable.name}
          value={variable.value}
          defaultValue={variable.defaultValue}
          onChange={(value) => onVariableChange(variable.name, value)}
          label={displayName}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'none', label: 'None' },
          ]}
        />
      );
    }
    
    if (WEIGHT_REFERENCE_VARIABLES.includes(variable.name)) {
      return (
        <WeightReferenceSelect
          key={variable.name}
          value={variable.value}
          defaultValue={variable.defaultValue}
          onChange={(value) => onVariableChange(variable.name, value)}
          label={displayName}
          baseWeightOptions={baseFontWeightOptions}
        />
      );
    }
    
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
            contrastBackground={getContrastBackground(variable)}
          />
        );
      case 'font':
        // Use GoogleFontPicker for base font families
        if (isBaseFontFamily(variable)) {
          return (
            <GoogleFontPicker
              key={variable.name}
              value={variable.value}
              defaultValue={variable.defaultValue}
              onChange={(value) => onVariableChange(variable.name, value)}
              label={displayName}
            />
          );
        }
        // Use FontPicker with reference options for derived font families
        return (
          <FontPicker
            key={variable.name}
            value={variable.value}
            defaultValue={variable.defaultValue}
            onChange={(value) => onVariableChange(variable.name, value)}
            label={displayName}
            fontOptions={isFontFamilyReference(variable) ? baseFontFamilyOptions : []}
            isBaseFontFamily={false}
          />
        );
      case 'size':
        // Determine which size options to use
        const sizeOptions = isFontSizeReference(variable) 
          ? baseFontSizeOptions 
          : isBorderRadiusReference(variable) 
            ? baseBorderRadiusOptions 
            : [];
        return (
          <SizeInput
            key={variable.name}
            value={variable.value}
            defaultValue={variable.defaultValue}
            onChange={(value) => onVariableChange(variable.name, value)}
            label={displayName}
            sizeOptions={sizeOptions}
            isBaseFontSize={isBaseFontSize(variable)}
          />
        );
      case 'number':
        // Check if this is a font-weight reference
        if (isFontWeightReference(variable)) {
          return (
            <NumberInput
              key={variable.name}
              value={variable.value}
              defaultValue={variable.defaultValue}
              onChange={(value) => onVariableChange(variable.name, value)}
              label={displayName}
              weightOptions={baseFontWeightOptions}
              isBaseFontWeight={isBaseFontWeight(variable)}
            />
          );
        }
        // Check if this is a line-height reference
        if (isLineHeightReference(variable)) {
          return (
            <NumberInput
              key={variable.name}
              value={variable.value}
              defaultValue={variable.defaultValue}
              onChange={(value) => onVariableChange(variable.name, value)}
              label={displayName}
              lineHeightOptions={baseLineHeightOptions}
              isBaseLineHeight={isBaseLineHeight(variable)}
            />
          );
        }
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
        // Handle link-style as a select
        if (isLinkStyleVariable(variable)) {
          return (
            <LinkStyleSelect
              key={variable.name}
              value={variable.value}
              defaultValue={variable.defaultValue}
              onChange={(value) => onVariableChange(variable.name, value)}
              label={displayName}
            />
          );
        }
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
                Import SCSS
              </span>
            </Button>
          </label>
          {modifiedCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {modifiedCount} modified
            </span>
          )}
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
                        className="group px-6 py-2 hover:no-underline text-sm"
                        data-testid={`accordion-subsection-${section.id}-${subSection.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                          <span>{subSection.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({subSection.variables.length})
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-2">
                        <div className="space-y-1 pl-5">
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
