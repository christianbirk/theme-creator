import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ActionBarProps {
  onExport: () => void;
}

export function ActionBar({ onExport }: ActionBarProps) {
  return (
    <div className="flex items-center justify-end px-4 py-3 border-t bg-background">
      <Button onClick={onExport} data-testid="button-action-export">
        <Download className="h-4 w-4 mr-1.5" />
        Export Theme
      </Button>
    </div>
  );
}

export default ActionBar;
