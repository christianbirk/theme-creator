import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ControlPanel } from '@/components/theme-customizer/ControlPanel';
import { PreviewPane } from '@/components/theme-customizer/PreviewPane';
import { ActionBar } from '@/components/theme-customizer/ActionBar';
import { ExportModal } from '@/components/theme-customizer/ExportModal';
import { CssClassesEditor } from '@/components/theme-customizer/CssClassesEditor';
import { defaultCategories, CSSVariable, VariableCategory } from '@/components/theme-customizer/types';
import { parseScssContent, compileTheme, fetchSampleScss } from '@/lib/theme-api';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Settings2, Tag, Code } from 'lucide-react';
import { SimpleCodeEditor } from '@/components/theme-customizer/SimpleCodeEditor';
import type { CssClassesData } from '@shared/schema';
import JSZip from 'jszip';

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
  
  // CSS classes data for combined export
  const [cssClassesData, setCssClassesData] = useState<CssClassesData>({ groups: [] });
  
  // Custom CSS for appending to theme.css
  const [customCss, setCustomCss] = useState('');

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

  const handleLoadSample = useCallback(async (showToast = true) => {
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

      if (showToast) {
        toast({
          title: 'Sample loaded',
          description: `Loaded ${parsedVariables.length} variables from ${filename}.`,
        });
      }
    } catch (err) {
      console.error('Load sample error:', err);
      if (showToast) {
        toast({
          title: 'Failed to load sample',
          description: 'Unable to fetch the sample SCSS file.',
          variant: 'destructive',
        });
      }
    }
    setIsLoading(false);
  }, [toast]);

  // Load sample SCSS on mount
  useEffect(() => {
    handleLoadSample(false);
  }, []);

  const handleExport = useCallback(async () => {
    setIsLoading(true);
    try {
      // Compile CSS theme
      const css = await compileTheme(variables, baseScss);
      setCompiledCss(css);
      
      // Create zip file with theme.css and styles.xml
      const zip = new JSZip();
      const themeFolder = zip.folder('theme');
      
      if (themeFolder) {
        // Build the complete theme file with imports and custom CSS
        const importVariables = `// Importing Fundamentals Variables
@import '../../../../../GoBasic/baseStylesV6/css/variables.scss';`;

        const importStyles = `// Importing Fundamentals Styles
@import '../../../../../GoBasic/baseStylesV6/css/imports.scss';
@import '../../../../../GoBasic/baseStylesV6/css/import-html-publication.scss';`;

        let fullCss = `${importVariables}\n\n${css}\n\n${importStyles}`;
        
        if (customCss.trim()) {
          fullCss += `\n\n/* Custom CSS */\n${customCss}`;
        }
        
        themeFolder.file('theme.css', fullCss);
        
        // Add styles.xml if we have CSS classes data
        if (cssClassesData.groups.length > 0) {
          try {
            const response = await apiRequest('POST', '/api/export-styles-xml', { data: cssClassesData });
            const result = await response.json();
            
            if (result.success) {
              themeFolder.file('styles.xml', result.xml);
            }
          } catch (xmlErr) {
            console.error('XML export error:', xmlErr);
          }
        }
        
        // Generate and download the zip
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'theme.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: 'Export successful',
          description: 'Theme folder has been downloaded as theme.zip',
        });
      }
    } catch (err) {
      console.error('Compile error:', err);
      toast({
        title: 'Export failed',
        description: 'Unable to compile the theme. Please try again.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [variables, baseScss, toast, cssClassesData, customCss]);

  const [activeTab, setActiveTab] = useState('design');

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between gap-4 px-4 py-2 border-b bg-background shrink-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-auto p-1 bg-muted/50">
            <TabsTrigger 
              value="design" 
              className="gap-2 px-4 py-2"
              data-testid="tab-design-settings"
            >
              <Settings2 className="h-4 w-4" />
              Design Settings
            </TabsTrigger>
            <TabsTrigger 
              value="css-classes" 
              className="gap-2 px-4 py-2"
              data-testid="tab-css-classes"
            >
              <Tag className="h-4 w-4" />
              CSS classes
            </TabsTrigger>
            <TabsTrigger 
              value="custom-css" 
              className="gap-2 px-4 py-2"
              data-testid="tab-custom-css"
            >
              <Code className="h-4 w-4" />
              Custom CSS
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      <div className="flex-1 min-h-0 flex flex-col">
        {activeTab === 'design' && (
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
        )}

        {activeTab === 'css-classes' && (
          <div className="flex-1 min-h-0">
            <CssClassesEditor onDataChange={setCssClassesData} />
          </div>
        )}

        {activeTab === 'custom-css' && (
          <div className="flex-1 min-h-0 flex flex-col p-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Custom CSS</h2>
              <p className="text-sm text-muted-foreground">
                Add custom CSS that will be appended to the end of theme.css when exporting.
              </p>
            </div>
            <div className="flex-1 min-h-0">
              <SimpleCodeEditor
                value={customCss}
                onChange={setCustomCss}
                placeholder="/* Add your custom CSS here */"
                className="h-full"
              />
            </div>
          </div>
        )}

        <ActionBar onExport={handleExport} />
      </div>

      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        variables={variables}
      />
    </div>
  );
}
