import { useState, useCallback, useMemo } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { ControlPanel } from '@/components/theme-customizer/ControlPanel';
import { PreviewPane } from '@/components/theme-customizer/PreviewPane';
import { ActionBar } from '@/components/theme-customizer/ActionBar';
import { ExportModal } from '@/components/theme-customizer/ExportModal';
import { defaultCategories, CSSVariable, VariableCategory } from '@/components/theme-customizer/types';
import { parseScssContent, compileTheme, fetchSampleScss } from '@/lib/theme-api';
import { useToast } from '@/hooks/use-toast';
import { FileCode, Loader2 } from 'lucide-react';

export default function ThemeCustomizer() {
  const { toast } = useToast();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [baseScss, setBaseScss] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [compiledCss, setCompiledCss] = useState('');
  
  const [variables, setVariables] = useState<CSSVariable[]>(() =>
    defaultCategories.flatMap(cat => cat.variables)
  );

  const [categories, setCategories] = useState<VariableCategory[]>(defaultCategories);

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
    const categoryName = categories.find(c => c.id === categoryId)?.name || categoryId;
    toast({
      title: 'Category reset',
      description: `${categoryName} variables have been reset.`,
    });
  }, [toast, categories]);

  const handleImportSCSS = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      const content = await file.text();
      setBaseScss(content);
      
      const parsedVariables = await parseScssContent(content);
      
      if (parsedVariables.length === 0) {
        toast({
          title: 'No variables found',
          description: 'The file does not contain any CSS custom properties.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const uniqueCategories = Array.from(new Set(parsedVariables.map(v => v.category)));
      const newCategories: VariableCategory[] = uniqueCategories.map(catId => {
        const existing = defaultCategories.find(c => c.id === catId);
        return existing || {
          id: catId,
          name: catId.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          icon: 'Circle',
          variables: []
        };
      });

      setCategories(newCategories);
      setVariables(parsedVariables);

      toast({
        title: 'Import successful',
        description: `Imported ${parsedVariables.length} variables from ${file.name}.`,
      });
    } catch (err) {
      console.error('Import error:', err);
      toast({
        title: 'Import failed',
        description: 'Unable to parse the file. Please check the format.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [toast]);

  const handleLoadSample = useCallback(async () => {
    setIsLoading(true);
    try {
      const { content, filename } = await fetchSampleScss();
      setBaseScss(content);
      
      const parsedVariables = await parseScssContent(content);
      
      const uniqueCategories = Array.from(new Set(parsedVariables.map(v => v.category)));
      const newCategories: VariableCategory[] = uniqueCategories.map(catId => {
        const existing = defaultCategories.find(c => c.id === catId);
        return existing || {
          id: catId,
          name: catId.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          icon: 'Circle',
          variables: []
        };
      });

      setCategories(newCategories);
      setVariables(parsedVariables);

      toast({
        title: 'Sample loaded',
        description: `Loaded ${parsedVariables.length} variables from ${filename}.`,
      });
    } catch (err) {
      console.error('Load sample error:', err);
      toast({
        title: 'Failed to load sample',
        description: 'Unable to fetch the sample SCSS file.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [toast]);

  const handleExport = useCallback(async () => {
    setIsLoading(true);
    try {
      const css = await compileTheme(variables, baseScss);
      setCompiledCss(css);
      setExportModalOpen(true);
    } catch (err) {
      console.error('Compile error:', err);
      toast({
        title: 'Export failed',
        description: 'Unable to compile the theme. Please try again.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [variables, baseScss, toast]);

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-background">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-app-title">Theme Customizer</h1>
          <p className="text-sm text-muted-foreground">Customize CSS variables and export your theme</p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleLoadSample}
          disabled={isLoading}
          data-testid="button-load-sample"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <FileCode className="h-4 w-4 mr-1.5" />
          )}
          Load Sample SCSS
        </Button>
      </header>

      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={35} minSize={25} maxSize={50}>
            <ControlPanel
              categories={categories}
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
        onExport={handleExport}
      />

      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        variables={variables}
      />
    </div>
  );
}
