import { useState } from 'react';
import { ControlPanel } from '../theme-customizer/ControlPanel';
import { defaultCategories, CSSVariable } from '../theme-customizer/types';

export default function ControlPanelExample() {
  const [variables, setVariables] = useState<CSSVariable[]>(() =>
    defaultCategories.flatMap(cat => cat.variables)
  );

  const handleVariableChange = (name: string, value: string) => {
    setVariables(prev => prev.map(v => v.name === name ? { ...v, value } : v));
    console.log(`Variable ${name} changed to ${value}`);
  };

  const handleResetAll = () => {
    setVariables(prev => prev.map(v => ({ ...v, value: v.defaultValue })));
    console.log('All variables reset');
  };

  const handleResetCategory = (categoryId: string) => {
    setVariables(prev => prev.map(v => 
      v.category === categoryId ? { ...v, value: v.defaultValue } : v
    ));
    console.log(`Category ${categoryId} reset`);
  };

  const handleImport = (file: File) => {
    console.log('Import file:', file.name);
  };

  return (
    <div className="h-[500px] w-[400px] border rounded-lg overflow-hidden">
      <ControlPanel
        categories={defaultCategories}
        variables={variables}
        onVariableChange={handleVariableChange}
        onResetAll={handleResetAll}
        onResetCategory={handleResetCategory}
        onImportSCSS={handleImport}
      />
    </div>
  );
}
