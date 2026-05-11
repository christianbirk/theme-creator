import { Button } from '@/components/ui/button';
import { Download, Trash2 } from 'lucide-react';
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
  onResetAll?: () => void;
  /**
   * Optional buttons rendered to the LEFT of Export Theme — typically
   * data-loading actions like Import Theme / Convert Legacy / Sync
   * Framework. Lives in the right cluster so destructive (Reset) and
   * data-saving (Export) actions stay on opposite sides of the bar.
   */
  secondaryActions?: React.ReactNode;
}

export function ActionBar({
  onExport,
  onResetAll,
  secondaryActions,
}: ActionBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur shadow-[0_-1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-2">
        {onResetAll && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                data-testid="button-action-reset-all"
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
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
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {secondaryActions}
        <Button onClick={onExport} data-testid="button-action-export">
          <Download className="h-4 w-4 mr-1.5" />
          Export Theme
        </Button>
      </div>
    </div>
  );
}

export default ActionBar;
