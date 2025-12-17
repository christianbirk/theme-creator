import { useState } from 'react';
import { Accordion } from '@/components/ui/accordion';
import { VariableGroup } from '../theme-customizer/VariableGroup';
import { CSSVariable, VariableCategory } from '../theme-customizer/types';

const mockCategory: VariableCategory = {
  id: 'brand-colors',
  name: 'Brand Colors',
  icon: 'Palette',
  variables: [
    { name: '--primary', value: '#3B82F6', defaultValue: '#3B82F6', type: 'color', category: 'brand-colors', description: 'Primary brand color' },
    { name: '--secondary', value: '#FF5733', defaultValue: '#64748B', type: 'color', category: 'brand-colors', description: 'Secondary brand color' },
  ]
};

export default function VariableGroupExample() {
  const [variables, setVariables] = useState<CSSVariable[]>(mockCategory.variables);

  const handleChange = (name: string, value: string) => {
    setVariables(prev => prev.map(v => v.name === name ? { ...v, value } : v));
    console.log(`Variable ${name} changed to ${value}`);
  };

  const handleReset = (categoryId: string) => {
    setVariables(prev => prev.map(v => ({ ...v, value: v.defaultValue })));
    console.log(`Category ${categoryId} reset`);
  };

  return (
    <div className="p-4 max-w-lg">
      <Accordion type="single" collapsible defaultValue="brand-colors">
        <VariableGroup
          category={mockCategory}
          variables={variables}
          onVariableChange={handleChange}
          onResetCategory={handleReset}
        />
      </Accordion>
    </div>
  );
}
