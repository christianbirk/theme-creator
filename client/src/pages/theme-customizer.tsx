import { useState, useCallback, useMemo } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ControlPanel } from '@/components/theme-customizer/ControlPanel';
import { PreviewPane } from '@/components/theme-customizer/PreviewPane';
import { ActionBar } from '@/components/theme-customizer/ActionBar';
import { ExportModal } from '@/components/theme-customizer/ExportModal';
import { defaultCategories, CSSVariable } from '@/components/theme-customizer/types';
import { useToast } from '@/hooks/use-toast';

export default function ThemeCustomizer() {
  const { toast } = useToast();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  
  const [variables, setVariables] = useState<CSSVariable[]>(() =>
    defaultCategories.flatMap(cat => cat.variables)
  );

  const handleVariableChange = useCallback((name: string, value: string) => {
    setVariables(prev => prev.map(v => 
      v.name === name ? { ...v, value } : v
    ));
  }, []);

  const handleResetAll = useCallback(() => {
    setVariables(prev => prev.map(v => ({ ...v, value: v.defaultValue })));
    toast({
      title: 'Variables reset',
      description: 'All variables have been reset to their default values.',
    });
  }, [toast]);

  const handleResetCategory = useCallback((categoryId: string) => {
    setVariables(prev => prev.map(v => 
      v.category === categoryId ? { ...v, value: v.defaultValue } : v
    ));
    const categoryName = defaultCategories.find(c => c.id === categoryId)?.name || categoryId;
    toast({
      title: 'Category reset',
      description: `${categoryName} variables have been reset.`,
    });
  }, [toast]);

  const handleImportSCSS = useCallback(async (file: File) => {
    try {
      const content = await file.text();
      
      const varRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
      let match;
      const importedVars: Record<string, string> = {};
      
      while ((match = varRegex.exec(content)) !== null) {
        importedVars[`--${match[1]}`] = match[2].trim();
      }
      
      if (Object.keys(importedVars).length === 0) {
        toast({
          title: 'No variables found',
          description: 'The file does not contain any CSS custom properties.',
          variant: 'destructive',
        });
        return;
      }

      setVariables(prev => prev.map(v => ({
        ...v,
        value: importedVars[v.name] || v.value,
        defaultValue: importedVars[v.name] || v.defaultValue,
      })));

      toast({
        title: 'Import successful',
        description: `Imported ${Object.keys(importedVars).length} variables from ${file.name}.`,
      });
    } catch (err) {
      toast({
        title: 'Import failed',
        description: 'Unable to parse the file. Please check the format.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-background">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-app-title">Theme Customizer</h1>
          <p className="text-sm text-muted-foreground">Customize CSS variables and export your theme</p>
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <ControlPanel
              categories={defaultCategories}
              variables={variables}
              onVariableChange={handleVariableChange}
              onResetAll={handleResetAll}
              onResetCategory={handleResetCategory}
              onImportSCSS={handleImportSCSS}
            />
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanel defaultSize={65}>
            <PreviewPane variables={variables} previewHtml={previewHtml} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <ActionBar
        variables={variables}
        onResetAll={handleResetAll}
        onExport={() => setExportModalOpen(true)}
      />

      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        variables={variables}
      />
    </div>
  );
}
