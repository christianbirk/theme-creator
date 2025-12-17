import { useState } from 'react';
import { ActionBar } from '../theme-customizer/ActionBar';
import { defaultCategories, CSSVariable } from '../theme-customizer/types';

const mockVariables: CSSVariable[] = defaultCategories.flatMap(cat => cat.variables).map((v, i) => ({
  ...v,
  value: i < 5 ? '#MODIFIED' : v.defaultValue
}));

export default function ActionBarExample() {
  const [variables, setVariables] = useState(mockVariables);

  const handleReset = () => {
    setVariables(prev => prev.map(v => ({ ...v, value: v.defaultValue })));
    console.log('Reset all variables');
  };

  const handleExport = () => {
    console.log('Export triggered');
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <ActionBar
        variables={variables}
        onResetAll={handleReset}
        onExport={handleExport}
      />
    </div>
  );
}
