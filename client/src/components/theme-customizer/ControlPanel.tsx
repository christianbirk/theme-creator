import { useState, useMemo, useCallback, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, RotateCcw, ChevronRight, MousePointer2, ArrowLeft } from 'lucide-react';
import { CSSVariable, VariableCategory, formatVariableName, formatSectionName, sectionIcons } from './types';
import { ColorPicker } from './ColorPicker';
import { SizeInput } from './SizeInput';
import { FontPicker } from './FontPicker';
import { GoogleFontPicker, CustomFont } from './GoogleFontPicker';
import { NumberInput } from './NumberInput';
import { StringInput } from './StringInput';
import { LinkStyleSelect } from './LinkStyleSelect';
import { SelectInput } from './SelectInput';
import { FamilyReferenceSelect } from './FamilyReferenceSelect';
import { WeightReferenceSelect } from './WeightReferenceSelect';
import { BorderInput } from './BorderInput';

// Subsections that are only visible in expert mode
const EXPERT_ONLY_SUBSECTIONS = ['neutral-colors', 'grid', 'font-sizes', 'line-heights', 'alternate-module-heading', 'mega-menu', 'burger-navigation', 'search', 'breadcrumb-navigation', 'left-navigation'];

// Main sections that are only visible in expert mode
const EXPERT_ONLY_MAIN_SECTIONS = ['colors-combinations', 'icons', 'labels', 'aspect-ratios', 'buttons', 'forms'];

// Navigation mode types
type NavigationMode = 'standard' | 'burger';

// Subsections that belong exclusively to Burger Navigation mode
const BURGER_ONLY_SUBSECTIONS = ['burger-navigation'];

// Subsections that go to Secondary Navigations (breadcrumb, left-navigation)
const SECONDARY_NAV_SUBSECTIONS = ['breadcrumb-navigation', 'left-navigation'];

// Subsections that get their own parent category
const SEARCH_SUBSECTIONS = ['search'];

// Helper to check if a subsection should be shown based on navigation mode
// Standard mode shows all navigation subsections EXCEPT burger-only ones
// Burger mode shows ONLY burger-only subsections
const isNavSubsectionVisible = (subSectionId: string, mode: NavigationMode): boolean => {
  if (mode === 'burger') {
    return BURGER_ONLY_SUBSECTIONS.includes(subSectionId);
  }
  // Standard mode: show everything except burger-only subsections
  return !BURGER_ONLY_SUBSECTIONS.includes(subSectionId);
};

// Individual variables that are only visible in expert mode
const EXPERT_ONLY_VARIABLES = [
  '--h1-font-family', '--h2-font-family', '--h3-font-family', '--h4-font-family', '--h5-font-family', '--h6-font-family',
  '--h1-font-weight', '--h2-font-weight', '--h3-font-weight', '--h4-font-weight', '--h5-font-weight', '--h6-font-weight',
  '--h1-text-transform', '--h2-text-transform', '--h3-text-transform', '--h4-text-transform', '--h5-text-transform', '--h6-text-transform',
];

// Variables that should use text-transform select (none/uppercase)
const TEXT_TRANSFORM_VARIABLES = [
  '--button-universal-text-transform',
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
const ALIGNMENT_VARIABLES = ['--nav-main-align', '--nav-burger-dropdown-link-align'];

// Variables that should use family reference select (base/heading)
const FAMILY_REFERENCE_VARIABLES = ['--pre-heading-family', '--lead-font-family'];

// Variables that should use hyphens select (auto/none)
const HYPHENS_VARIABLES = ['--font-heading-hyphens'];

// Variables that should use weight reference select (base/heading weight)
// Excludes --font-base-weight and --font-heading-weight which are the base definitions
const WEIGHT_REFERENCE_VARIABLES = [
  '--pre-heading-weight',
  '--h1-font-weight', '--h2-font-weight', '--h3-font-weight',
  '--h4-font-weight', '--h5-font-weight', '--h6-font-weight',
  '--lead-font-weight',
  '--footer-heading-font-weight',
  '--nav-main-link-font-weight',
  '--service-font-weight',
  '--button-universal-font-weight',
  '--link-arrow-text-font-weight',
  '--icon-font-weight',
  '--label-font-weight',
];

// Variables that should use border input (width, style, color)
const BORDER_VARIABLES = [
  '--nav-main-border-top',
  '--nav-main-border-bottom',
];

interface SelectedElement {
  id: string;
  name: string;
  variables: string[];
}

interface ControlPanelProps {
  categories: VariableCategory[];
  variables: CSSVariable[];
  onVariableChange: (name: string, value: string) => void;
  onResetAll: () => void;
  onResetCategory: (categoryId: string) => void;
  customFonts?: CustomFont[];
  inspectorMode?: boolean;
  onInspectorModeChange?: (enabled: boolean) => void;
  selectedElement?: SelectedElement | null;
  onClearSelectedElement?: () => void;
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
  customFonts = [],
  inspectorMode = false,
  onInspectorModeChange,
  selectedElement,
  onClearSelectedElement,
}: ControlPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedSubSections, setExpandedSubSections] = useState<string[]>([]);
  const [expertMode, setExpertMode] = useState(() => {
    const stored = localStorage.getItem('theme-customizer-expert-mode');
    return stored === 'true';
  });
  const [navigationMode, setNavigationMode] = useState<NavigationMode>(() => {
    const stored = localStorage.getItem('theme-customizer-nav-mode');
    return (stored === 'standard' || stored === 'burger') ? stored : 'standard';
  });

  // Persist expert mode to localStorage
  useEffect(() => {
    localStorage.setItem('theme-customizer-expert-mode', String(expertMode));
  }, [expertMode]);

  // Persist navigation mode to localStorage
  useEffect(() => {
    localStorage.setItem('theme-customizer-nav-mode', navigationMode);
  }, [navigationMode]);

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
    
    // Create set of selected element variables for quick lookup
    const selectedVarSet = selectedElement 
      ? new Set(selectedElement.variables) 
      : null;

    variables.forEach(v => {
      // If element is selected, only show its variables
      if (selectedVarSet && !selectedVarSet.has(v.name)) {
        return;
      }
      
      const mainSection = v.mainSection || 'other';
      const subSection = v.subSection || 'general';

      // Filter out expert-only main sections when not in expert mode
      if (!expertMode && EXPERT_ONLY_MAIN_SECTIONS.includes(mainSection)) {
        return;
      }

      // Filter out expert-only subsections when not in expert mode
      if (!expertMode && EXPERT_ONLY_SUBSECTIONS.includes(subSection)) {
        return;
      }

      // Filter out expert-only individual variables when not in expert mode
      if (!expertMode && EXPERT_ONLY_VARIABLES.includes(v.name)) {
        return;
      }

      // Filter navigation subsections based on selected navigation mode
      // Also split navigation into "main-navigation", "secondary-navigations", and "search"
      let effectiveMainSection = mainSection;
      if (mainSection === 'navigation') {
        if (SEARCH_SUBSECTIONS.includes(subSection)) {
          // Move search to its own parent category
          effectiveMainSection = 'search';
        } else if (SECONDARY_NAV_SUBSECTIONS.includes(subSection)) {
          // Move breadcrumb, left-navigation to secondary-navigations
          effectiveMainSection = 'secondary-navigations';
        } else {
          // Keep other nav subsections in main-navigation
          effectiveMainSection = 'main-navigation';
          if (!isNavSubsectionVisible(subSection, navigationMode)) {
            return;
          }
        }
      }

      if (query && !v.name.toLowerCase().includes(query)) {
        return;
      }

      if (!sectionMap.has(effectiveMainSection)) {
        sectionMap.set(effectiveMainSection, new Map());
      }
      const subMap = sectionMap.get(effectiveMainSection)!;
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
  }, [variables, searchQuery, expertMode, navigationMode, selectedElement]);

  const modifiedCount = useMemo(() => 
    variables.filter(v => v.value !== v.defaultValue).length
  , [variables]);

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
          customFonts={customFonts}
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
    
    if (BORDER_VARIABLES.includes(variable.name)) {
      return (
        <BorderInput
          key={variable.name}
          value={variable.value}
          defaultValue={variable.defaultValue}
          onChange={(value) => onVariableChange(variable.name, value)}
          label={displayName}
          colorOptions={baseColorOptions}
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
              customFonts={customFonts}
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
            allVariables={variables}
            isBaseFontSize={isBaseFontSize(variable)}
          />
        );
      case 'number':
        // Check if this is a font-weight reference (includes base font weights and derived)
        if (isFontWeightReference(variable)) {
          return (
            <NumberInput
              key={variable.name}
              value={variable.value}
              defaultValue={variable.defaultValue}
              onChange={(value) => onVariableChange(variable.name, value)}
              label={displayName}
              weightOptions={baseFontWeightOptions}
              isBaseFontWeight={false}
            />
          );
        }
        // Check if this is a base font weight - show slider
        if (isBaseFontWeight(variable)) {
          return (
            <NumberInput
              key={variable.name}
              value={variable.value}
              defaultValue={variable.defaultValue}
              onChange={(value) => onVariableChange(variable.name, value)}
              label={displayName}
              isBaseFontWeight={true}
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
          {onInspectorModeChange && (
            <Button
              variant={inspectorMode ? "default" : "outline"}
              size="sm"
              onClick={() => onInspectorModeChange(!inspectorMode)}
              data-testid="button-inspector-mode"
              className="h-8"
            >
              <MousePointer2 className="h-4 w-4 mr-1" />
              Inspect
            </Button>
          )}
        </div>
      </div>

      {selectedElement && (
        <div className="p-4 border-b bg-blue-50 dark:bg-blue-950">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelectedElement}
                className="h-8 px-2"
                data-testid="button-back-from-element"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium text-sm">{selectedElement.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {selectedElement.variables.length} variables
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Click on elements in the preview to see their related variables. 
            Click the back arrow to return to all variables.
          </p>
        </div>
      )}

      <ScrollArea className="flex-1">
        {selectedElement ? (
          <div className="p-4 space-y-1">
            {sections.flatMap(section => 
              section.subSections.flatMap(subSection => 
                subSection.variables.map(renderVariableInput)
              )
            )}
          </div>
        ) : (
          <Accordion 
            type="multiple" 
            value={expandedSections}
            onValueChange={setExpandedSections}
            className="w-full"
          >
            {sections.map(section => (
              <AccordionItem key={section.id} value={section.id} className="border-b">
                <AccordionTrigger 
                  className="px-4 py-3 hover:no-underline data-[state=open]:bg-[#F7F7F7] dark:data-[state=open]:bg-muted/50"
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
                  {/* Navigation mode toggle for main-navigation section */}
                  {section.id === 'main-navigation' && (
                    <div className="px-4 py-3 border-b bg-muted/30">
                      <Label className="text-xs text-muted-foreground mb-2 block">Navigation Type</Label>
                      <Tabs 
                        value={navigationMode} 
                        onValueChange={(v) => setNavigationMode(v as NavigationMode)}
                        className="w-full"
                      >
                        <TabsList className="w-full grid grid-cols-2">
                          <TabsTrigger 
                            value="standard" 
                            className="text-xs"
                            data-testid="tab-nav-standard"
                          >
                            Standard
                          </TabsTrigger>
                          <TabsTrigger 
                            value="burger" 
                            className="text-xs"
                            data-testid="tab-nav-burger"
                          >
                            Burger
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  )}
                  {/* Check if section has single subsection with same name - render flat */}
                  {section.subSections.length === 1 && 
                   section.subSections[0].id === section.id ? (
                    <div className="px-6 pb-4 space-y-1">
                      {section.subSections[0].variables.map(renderVariableInput)}
                    </div>
                  ) : (
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
                            className="group px-6 py-2 hover:no-underline text-sm font-normal"
                            data-testid={`accordion-subsection-${section.id}-${subSection.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                              <span className="font-normal">{subSection.name}</span>
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
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

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
