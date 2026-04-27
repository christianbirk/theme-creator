import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCcw, Palette, Circle, AlertCircle, Type, Move, Square, Layers, LayoutGrid, Zap } from 'lucide-react';
import { CSSVariable, VariableCategory } from './types';
import { ColorPicker } from './ColorPicker';
import { FontPicker } from './FontPicker';
import { SizeInput } from './SizeInput';
import { NumberInput } from './NumberInput';
import { StringInput } from './StringInput';

const iconMap: Record<string, typeof Palette> = {
  Palette,
  Circle,
  AlertCircle,
  Type,
  Move,
  Square,
  Layers,
  LayoutGrid,
  Zap,
};

interface VariableGroupProps {
  category: VariableCategory;
  variables: CSSVariable[];
  onVariableChange: (name: string, value: string) => void;
  onResetCategory: (categoryId: string) => void;
}

export function VariableGroup({ category, variables, onVariableChange, onResetCategory }: VariableGroupProps) {
  const modifiedCount = variables.filter(v => v.value !== v.defaultValue).length;
  const Icon = iconMap[category.icon] || Circle;

  const renderInput = (variable: CSSVariable) => {
    switch (variable.type) {
      case 'color':
        return (
          <ColorPicker
            key={variable.name}
            value={variable.value}
            defaultValue={variable.defaultValue}
            onChange={(value) => onVariableChange(variable.name, value)}
            label={variable.name}
            description={variable.description}
          />
        );
      case 'font':
        return (
          <FontPicker
            key={variable.name}
            value={variable.value}
            defaultValue={variable.defaultValue}
            onChange={(value) => onVariableChange(variable.name, value)}
            label={variable.name}
            description={variable.description}
          />
        );
      case 'size':
        return (
          <SizeInput
            key={variable.name}
            value={variable.value}
            defaultValue={variable.defaultValue}
            onChange={(value) => onVariableChange(variable.name, value)}
            label={variable.name}
            description={variable.description}
          />
        );
      case 'number':
        return (
          <NumberInput
            key={variable.name}
            value={variable.value}
            defaultValue={variable.defaultValue}
            onChange={(value) => onVariableChange(variable.name, value)}
            label={variable.name}
            description={variable.description}
            step={variable.name.includes('weight') ? 100 : 0.1}
            min={0}
            max={variable.name.includes('weight') ? 900 : 100}
          />
        );
      case 'string':
      default:
        return (
          <StringInput
            key={variable.name}
            value={variable.value}
            defaultValue={variable.defaultValue}
            onChange={(value) => onVariableChange(variable.name, value)}
            label={variable.name}
            description={variable.description}
          />
        );
    }
  };

  return (
    <AccordionItem value={category.id} className="border-b">
      <AccordionTrigger className="py-3 px-4 hover:no-underline" data-testid={`accordion-trigger-${category.id}`}>
        <div className="flex items-center gap-3 flex-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{category.name}</span>
          <Badge variant="secondary" className="text-xs">
            {variables.length}
          </Badge>
          {modifiedCount > 0 && (
            <Badge variant="default" className="text-xs">
              {modifiedCount} modified
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-2">
        <div className="px-4 space-y-1">
          {modifiedCount > 0 && (
            <div className="flex justify-end pb-2 border-b mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResetCategory(category.id)}
                className="text-xs h-7"
                data-testid={`reset-category-${category.id}`}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset all
              </Button>
            </div>
          )}
          {variables.map(renderInput)}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default VariableGroup;
