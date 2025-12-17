import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExportModal } from '../theme-customizer/ExportModal';
import { defaultCategories, CSSVariable } from '../theme-customizer/types';

const mockVariables: CSSVariable[] = defaultCategories.flatMap(cat => cat.variables).map((v, i) => ({
  ...v,
  value: i < 3 ? '#FF5733' : v.defaultValue
}));

export default function ExportModalExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4">
      <Button onClick={() => setOpen(true)} data-testid="button-open-export">
        Open Export Modal
      </Button>
      <ExportModal
        open={open}
        onOpenChange={setOpen}
        variables={mockVariables}
      />
    </div>
  );
}
