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
import { Settings2, Tag, Code, Upload, FileType } from 'lucide-react';
import { CustomCssManager, ScssFile, DEFAULT_FILE } from '@/components/theme-customizer/CustomCssManager';
import { CustomFontsManager, FontFile, generateFontFaceCssForExport } from '@/components/theme-customizer/CustomFontsManager';
import { LegacyImportModal, PreservedFolders, CustomScssFile, ImportedFontFile } from '@/components/theme-customizer/LegacyImportModal';
import { mergeMappedVariables } from '@/lib/legacy-import';
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
  
  // Custom SCSS files for appending to theme.css
  const [scssFiles, setScssFiles] = useState<ScssFile[]>([DEFAULT_FILE]);
  
  // Custom font files
  const [customFonts, setCustomFonts] = useState<FontFile[]>([]);
  
  // Font CSS for preview (uses blob URLs)
  const [fontCssForPreview, setFontCssForPreview] = useState<string>('');
  
  // Legacy import state
  const [legacyImportModalOpen, setLegacyImportModalOpen] = useState(false);
  const [preservedFolders, setPreservedFolders] = useState<PreservedFolders | null>(null);
  const [importedCssClassesData, setImportedCssClassesData] = useState<CssClassesData | null>(null);
  
  // Theme import file input ref
  const themeImportInputRef = useRef<HTMLInputElement>(null);

  const handleVariableChange = useCallback((name: string, value: string) => {
    setVariables(prev => prev.map(v => 
      v.name === name ? { ...v, value } : v
    ));
  }, []);

  const handleResetVariables = useCallback(() => {
    setVariables(prev => prev.map(v => ({ ...v, value: v.defaultValue })));
    toast({
      title: 'Variables reset',
      description: 'All variables have been reset to their default values.',
    });
  }, [toast]);

  const handleResetEverything = useCallback(() => {
    setVariables(prev => prev.map(v => ({ ...v, value: v.defaultValue })));
    setCustomFonts([]);
    setFontCssForPreview('');
    setScssFiles([{ id: '1', name: 'custom-styles.scss', content: '' }]);
    toast({
      title: 'Everything reset',
      description: 'All variables, custom fonts, and custom CSS have been reset.',
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

  const handleImportTheme = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // Find theme folder
      const themeFolder = zip.folder('theme');
      if (!themeFolder) {
        toast({
          title: 'Invalid theme file',
          description: 'The zip file does not contain a theme folder.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      
      // Import theme.scss and parse variables
      const themeScsFile = themeFolder.file('theme.scss');
      if (themeScsFile) {
        const content = await themeScsFile.async('string');
        setBaseScss(content);
        
        const parsedVariables = await parseScssContent(content);
        if (parsedVariables.length > 0) {
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
        }
      }
      
      // Import styles.xml for CSS classes
      const stylesXmlFile = themeFolder.file('styles.xml');
      if (stylesXmlFile) {
        const xmlContent = await stylesXmlFile.async('string');
        try {
          const response = await apiRequest('POST', '/api/import-styles-xml', { xml: xmlContent });
          const result = await response.json();
          if (result.success && result.data) {
            setImportedCssClassesData(result.data);
          }
        } catch (xmlErr) {
          console.error('XML import error:', xmlErr);
        }
      }
      
      // Import custom SCSS files from custom folder
      const customFolder = themeFolder.folder('custom');
      if (customFolder) {
        const importedScssFiles: ScssFile[] = [];
        let fileIndex = 0;
        
        customFolder.forEach(async (relativePath, file) => {
          if (!file.dir && (relativePath.endsWith('.scss') || relativePath.endsWith('.css'))) {
            const content = await file.async('string');
            importedScssFiles.push({
              id: `imported-${Date.now()}-${fileIndex++}`,
              name: relativePath,
              content
            });
          }
        });
        
        // Wait a bit for async forEach to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        if (importedScssFiles.length > 0) {
          setScssFiles(prev => [...prev.filter(f => f.content.trim()), ...importedScssFiles]);
        }
      }
      
      // Import fonts from fonts folder
      const fontsFolder = themeFolder.folder('fonts');
      if (fontsFolder) {
        const importedFonts: FontFile[] = [];
        
        const fontPromises: Promise<void>[] = [];
        let fontIndex = 0;
        fontsFolder.forEach((relativePath, file) => {
          if (!file.dir && /\.(ttf|woff2?|eot)$/i.test(relativePath)) {
            const currentIndex = fontIndex++;
            fontPromises.push(
              file.async('arraybuffer').then(data => {
                const uint8Data = new Uint8Array(data);
                const ext = relativePath.split('.').pop()?.toLowerCase() || 'ttf';
                const mimeTypes: Record<string, string> = {
                  'ttf': 'font/ttf',
                  'woff': 'font/woff',
                  'woff2': 'font/woff2',
                  'eot': 'application/vnd.ms-fontobject'
                };
                importedFonts.push({
                  id: `imported-font-${Date.now()}-${currentIndex}`,
                  name: relativePath,
                  data: uint8Data,
                  type: mimeTypes[ext] || 'font/ttf',
                  size: uint8Data.length
                });
              })
            );
          }
        });
        
        await Promise.all(fontPromises);
        if (importedFonts.length > 0) {
          setCustomFonts(prev => [...prev, ...importedFonts]);
        }
      }
      
      // Import preserved folders (charts, release)
      const chartsMap = new Map<string, Uint8Array>();
      const releaseMap = new Map<string, Uint8Array>();
      
      const chartsFolder = themeFolder.folder('charts');
      if (chartsFolder) {
        const promises: Promise<void>[] = [];
        chartsFolder.forEach((relativePath, file) => {
          if (!file.dir) {
            promises.push(
              file.async('arraybuffer').then(data => {
                chartsMap.set(`charts/${relativePath}`, new Uint8Array(data));
              })
            );
          }
        });
        await Promise.all(promises);
      }
      
      const releaseFolder = themeFolder.folder('release');
      if (releaseFolder) {
        const promises: Promise<void>[] = [];
        releaseFolder.forEach((relativePath, file) => {
          if (!file.dir) {
            promises.push(
              file.async('arraybuffer').then(data => {
                releaseMap.set(`release/${relativePath}`, new Uint8Array(data));
              })
            );
          }
        });
        await Promise.all(promises);
      }
      
      if (chartsMap.size > 0 || releaseMap.size > 0) {
        setPreservedFolders(prev => ({
          charts: chartsMap.size > 0 ? chartsMap : (prev?.charts || new Map()),
          fonts: prev?.fonts || new Map(),
          release: releaseMap.size > 0 ? releaseMap : (prev?.release || new Map()),
        }));
      }
      
      toast({
        title: 'Theme imported',
        description: `Successfully imported theme from ${file.name}.`,
      });
    } catch (err) {
      console.error('Theme import error:', err);
      toast({
        title: 'Import failed',
        description: 'Unable to import the theme file. Please check the format.',
        variant: 'destructive',
      });
    }
    
    setIsLoading(false);
    if (themeImportInputRef.current) {
      themeImportInputRef.current.value = '';
    }
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

  const handleLegacyImportComplete = useCallback(async (result: {
    mappedVariables: { name: string; value: string }[];
    stylesXml: string | null;
    preservedFolders: PreservedFolders;
    customScssFiles: CustomScssFile[];
    fontFiles: ImportedFontFile[];
  }) => {
    // Apply mapped variables to existing state
    setVariables(prev => {
      const mappedMap = new Map(result.mappedVariables.map(v => [v.name, v.value]));
      const existingNames = new Set(prev.map(v => v.name));
      
      // Update existing variables
      const updated = prev.map(variable => {
        const mappedValue = mappedMap.get(variable.name);
        if (mappedValue !== undefined) {
          return { ...variable, value: mappedValue };
        }
        return variable;
      });
      
      // Add any new variables that weren't in the existing list
      const newVariables = result.mappedVariables
        .filter(mv => !existingNames.has(mv.name))
        .map(mv => ({
          name: mv.name,
          value: mv.value,
          defaultValue: mv.value,
          type: mv.name.includes('color') ? 'color' as const : 'string' as const,
          category: 'other',
          mainSection: 'other',
          subSection: 'imported',
          description: 'Imported from legacy theme'
        }));
      
      return [...updated, ...newVariables];
    });

    // Store preserved folders for export
    setPreservedFolders(result.preservedFolders);

    // Parse and import styles.xml
    if (result.stylesXml) {
      try {
        const response = await apiRequest('POST', '/api/parse-styles-xml', { content: result.stylesXml });
        const parsed = await response.json();
        if (parsed.success) {
          setImportedCssClassesData(parsed.data);
          toast({
            title: 'CSS classes imported',
            description: `Imported ${parsed.groupCount} groups with ${parsed.classCount} classes from styles.xml`,
          });
        } else {
          toast({
            title: 'Failed to import CSS classes',
            description: parsed.error || 'Could not parse styles.xml',
            variant: 'destructive',
          });
        }
      } catch (err) {
        console.error('Failed to parse styles.xml:', err);
        toast({
          title: 'Failed to import CSS classes',
          description: 'Could not parse styles.xml file',
          variant: 'destructive',
        });
      }
    }

    // Import custom SCSS files
    if (result.customScssFiles.length > 0) {
      // Convert to ScssFile format and merge with existing files
      const importedFiles: ScssFile[] = result.customScssFiles.map((f, index) => ({
        id: `imported-${Date.now()}-${index}`,
        name: f.name,
        content: f.content
      }));
      
      setScssFiles(prev => {
        // Filter out the default empty file if it exists and has no content
        const filteredPrev = prev.filter(f => f.id !== 'default' || f.content.trim());
        return [...filteredPrev, ...importedFiles];
      });
      
      toast({
        title: 'Custom CSS files imported',
        description: `Imported ${result.customScssFiles.length} custom SCSS file(s) with converted variables`,
      });
    }

    // Import font files to Custom Fonts tab
    if (result.fontFiles.length > 0) {
      // Convert ImportedFontFile to FontFile format
      const importedFonts: FontFile[] = result.fontFiles.map(f => ({
        id: f.id,
        name: f.name,
        data: f.data,
        type: f.type,
        size: f.size
      }));
      
      setCustomFonts(prev => {
        // Avoid duplicates based on filename
        const existingNames = new Set(prev.map(f => f.name.toLowerCase()));
        const newFonts = importedFonts.filter(f => !existingNames.has(f.name.toLowerCase()));
        return [...prev, ...newFonts];
      });
      
      toast({
        title: 'Font files imported',
        description: `Imported ${result.fontFiles.length} font file(s) to Custom Fonts`,
      });
    }
  }, [toast]);

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
        
        // Add @font-face rules for custom fonts
        const fontFaceCss = generateFontFaceCssForExport(customFonts);
        if (fontFaceCss) {
          fullCss += `\n\n${fontFaceCss}`;
        }
        
        // Append all custom SCSS files
        const nonEmptyFiles = scssFiles.filter(f => f.content.trim());
        if (nonEmptyFiles.length > 0) {
          fullCss += '\n\n/* Custom SCSS Files */';
          for (const file of nonEmptyFiles) {
            fullCss += `\n\n/* ${file.name} */\n${file.content}`;
          }
        }
        
        themeFolder.file('theme.scss', fullCss);
        
        // Also add individual SCSS files to a custom folder for reference
        if (nonEmptyFiles.length > 0) {
          const customFolder = themeFolder.folder('custom');
          if (customFolder) {
            for (const file of nonEmptyFiles) {
              customFolder.file(file.name, file.content);
            }
          }
        }
        
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
        
        // Add preserved folders from legacy import with proper directory structure
        if (preservedFolders) {
          const addFolderContents = (folderMap: Map<string, Uint8Array>) => {
            folderMap.forEach((data, filePath) => {
              // filePath is like "charts/subfolder/file.png" - create proper path
              themeFolder.file(filePath, data);
            });
          };
          addFolderContents(preservedFolders.charts);
          addFolderContents(preservedFolders.fonts);
          addFolderContents(preservedFolders.release);
        }
        
        // Add custom fonts from Custom Fonts tab
        if (customFonts.length > 0) {
          const fontsFolder = themeFolder.folder('fonts');
          if (fontsFolder) {
            for (const font of customFonts) {
              fontsFolder.file(font.name, font.data);
            }
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
  }, [variables, baseScss, toast, cssClassesData, scssFiles, preservedFolders, customFonts]);

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
            <TabsTrigger 
              value="custom-fonts" 
              className="gap-2 px-4 py-2"
              data-testid="tab-custom-fonts"
            >
              <FileType className="h-4 w-4" />
              Custom Fonts
              {customFonts.length > 0 && (
                <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {customFonts.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <input
            ref={themeImportInputRef}
            type="file"
            accept=".zip"
            onChange={handleImportTheme}
            className="hidden"
            data-testid="input-import-theme"
          />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => themeImportInputRef.current?.click()}
            data-testid="button-import-theme"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Theme
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setLegacyImportModalOpen(true)}
            data-testid="button-legacy-import"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Legacy Theme
          </Button>
        </div>
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
                  onResetAll={handleResetVariables}
                  onResetCategory={handleResetCategory}
                  customFonts={customFonts.map(font => ({
                    name: font.name.replace(/\.(ttf|woff|woff2|eot)$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    fontFamily: `'${font.name.replace(/\.(ttf|woff|woff2|eot)$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}'`,
                  }))}
                />
              </ResizablePanel>
              
              <ResizableHandle withHandle />
              
              <ResizablePanel defaultSize={65}>
                <PreviewPane variables={variables} previewHtml={previewHtml} customCssFiles={scssFiles} fontCss={fontCssForPreview} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        )}

        {activeTab === 'css-classes' && (
          <div className="flex-1 min-h-0">
            <CssClassesEditor onDataChange={setCssClassesData} importedData={importedCssClassesData} />
          </div>
        )}

        {activeTab === 'custom-css' && (
          <div className="flex-1 min-h-0">
            <CustomCssManager files={scssFiles} onFilesChange={setScssFiles} />
          </div>
        )}

        {activeTab === 'custom-fonts' && (
          <div className="flex-1 min-h-0">
            <CustomFontsManager 
              fonts={customFonts} 
              onFontsChange={setCustomFonts} 
              onFontCssChange={setFontCssForPreview}
            />
          </div>
        )}

        <ActionBar 
          onExport={handleExport} 
          onResetAll={handleResetEverything}
        />
      </div>

      <ExportModal
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        variables={variables}
      />

      <LegacyImportModal
        open={legacyImportModalOpen}
        onOpenChange={setLegacyImportModalOpen}
        onImportComplete={handleLegacyImportComplete}
      />
    </div>
  );
}
