import { Button } from '@/components/ui/button';
import { Download, RotateCcw } from 'lucide-react';

interface ActionBarProps {
  onExport: () => void;
  onResetAll?: () => void;
  modificationCount?: number;
}

export function ActionBar({ onExport, onResetAll, modificationCount = 0 }: ActionBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-background">
      <div className="flex items-center gap-2">
        {modificationCount > 0 && onResetAll && (
          <>
            <Button 
              variant="outline" 
              onClick={onResetAll} 
              data-testid="button-action-reset-all"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Reset All
            </Button>
            <span className="text-sm text-muted-foreground">
              {modificationCount} {modificationCount === 1 ? 'change' : 'changes'}
            </span>
          </>
        )}
      </div>
      <Button onClick={onExport} data-testid="button-action-export">
        <Download className="h-4 w-4 mr-1.5" />
        Export Theme
      </Button>
    </div>
  );
}

export default ActionBar;
