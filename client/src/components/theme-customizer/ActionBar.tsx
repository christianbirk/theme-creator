import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Download } from 'lucide-react';
import { CSSVariable } from './types';

interface ActionBarProps {
  variables: CSSVariable[];
  onResetAll: () => void;
  onExport: () => void;
}

export function ActionBar({ 
  variables, 
  onResetAll, 
  onExport, 
}: ActionBarProps) {
  const modifiedCount = variables.filter(v => v.value !== v.defaultValue).length;
  const totalCount = variables.length;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-t bg-background">
      <Button
        variant="outline"
        size="sm"
        onClick={onResetAll}
        disabled={modifiedCount === 0}
        data-testid="button-action-reset"
      >
        <RotateCcw className="h-4 w-4 mr-1.5" />
        Reset
      </Button>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Modified:
        </span>
        <Badge 
          variant={modifiedCount > 0 ? 'default' : 'secondary'} 
          className="font-mono text-xs"
          data-testid="badge-modified-count"
        >
          {modifiedCount}/{totalCount}
        </Badge>
      </div>

      <Button onClick={onExport} data-testid="button-action-export">
        <Download className="h-4 w-4 mr-1.5" />
        Export Theme
      </Button>
    </div>
  );
}

export default ActionBar;
