import { Button } from '@/components/ui/button';
import { Download, RotateCcw, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ActionBarProps {
  onExport: () => void;
  onResetVariables?: () => void;
  onResetAll?: () => void;
  modificationCount?: number;
  totalVariableCount?: number;
}

export function ActionBar({ 
  onExport, 
  onResetVariables, 
  onResetAll, 
  modificationCount = 0,
  totalVariableCount = 0 
}: ActionBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-background">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {modificationCount} of {totalVariableCount} modified
        </span>
        
        {modificationCount > 0 && onResetVariables && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                data-testid="button-action-reset-variables"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset Variables
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Variables?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all {modificationCount} modified variable{modificationCount !== 1 ? 's' : ''} to their default values. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onResetVariables}>Reset Variables</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        
        {onResetAll && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                data-testid="button-action-reset-all"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Reset All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Everything?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset all variables, remove custom fonts, clear custom CSS files, and restore all settings to their defaults. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onResetAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Reset Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
