import { useState, useCallback, useEffect, useRef } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ControlPanel } from '@/components/theme-customizer/ControlPanel';
import { PreviewPane, SelectedElement } from '@/components/theme-customizer/PreviewPane';
import { ActionBar } from '@/components/theme-customizer/ActionBar';
import { ExportModal } from '@/components/theme-customizer/ExportModal';
import { CssClassesEditor } from '@/components/theme-customizer/CssClassesEditor';
import { defaultCategories, CSSVariable, VariableCategory } from '@/components/theme-customizer/types';
import { parseScssContent, compileTheme, compileFullTheme, fetchSampleScss } from '@/lib/theme-api';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Settings2, Tag, Code, Braces, Package, Recycle, FileType, Image as ImageIcon, RefreshCw, Layers, Sun, Moon } from 'lucide-react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CustomCssManager, ScssFile } from '@/components/theme-customizer/CustomCssManager';
import { CustomJsManager, JsFile } from '@/components/theme-customizer/CustomJsManager';
import { CustomFontsManager, FontFile, generateFontFaceCssForExport, generateFontFaceCssForPreview } from '@/components/theme-customizer/CustomFontsManager';
import { CustomGraphicsManager, GraphicFile } from '@/components/theme-customizer/CustomGraphicsManager';
import { LegacyImportModal, PreservedFolders, CustomScssFile, ImportedFontFile, ImportedGraphicFile } from '@/components/theme-customizer/LegacyImportModal';
import { BatchConvertModal } from '@/components/theme-customizer/BatchConvertModal';
import type { CssClassesData } from '@shared/schema';
import JSZip from 'jszip';
import {
  loadPersistedState,
  schedulePersistedSave,
  clearPersistedState,
} from '@/lib/theme-persistence';

export default function ThemeCustomizer() {
  const { toast } = useToast();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [baseScss, setBaseScss] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [variables, setVariables] = useState<CSSVariable[]>(() =>
    defaultCategories.flatMap(cat => cat.variables)
  );

  const [categories, setCategories] = useState<VariableCategory[]>(defaultCategories);
  
  // CSS classes data for combined export
  const [cssClassesData, setCssClassesData] = useState<CssClassesData>({ groups: [] });
  
  // Custom SCSS files for appending to theme.css
  const [scssFiles, setScssFiles] = useState<ScssFile[]>([]);

  // Custom JS files written to the exported theme's `js/` folder.
  // Always disabled by default (legacy import + new files) so themes don't
  // accidentally execute custom scripts until the user opts back in.
  const [jsFiles, setJsFiles] = useState<JsFile[]>([]);

  // Custom font files
  const [customFonts, setCustomFonts] = useState<FontFile[]>([]);

  // Custom graphic files (gfx/ folder contents — logos, illustrations, SVGs)
  const [customGraphics, setCustomGraphics] = useState<GraphicFile[]>([]);
  
  // Font CSS for preview (uses blob URLs)
  const [fontCssForPreview, setFontCssForPreview] = useState<string>('');

  // Keep fontCssForPreview in sync with customFonts regardless of which tab
  // is active. CustomFontsManager only runs its effects when the Fonts tab is
  // open, so fonts imported via the legacy importer would never get blob URLs
  // (and therefore never appear in the preview) unless we do it here too.
  useEffect(() => {
    let cancelled = false;
    const fontsNeedingBlobs = customFonts.filter(f => !f.blobUrl);
    if (fontsNeedingBlobs.length === 0) {
      setFontCssForPreview(generateFontFaceCssForPreview(customFonts));
      return;
    }
    // Create blob URLs for any fonts that don't have one yet, then update
    // both the fonts state (so CustomFontsManager stays in sync) and the
    // preview CSS.
    const updated = customFonts.map(f => {
      if (f.blobUrl) return f;
      const blob = new Blob([f.data], { type: f.type });
      return { ...f, blobUrl: URL.createObjectURL(blob) };
    });
    if (!cancelled) {
      setCustomFonts(updated);
      setFontCssForPreview(generateFontFaceCssForPreview(updated));
    }
    return () => { cancelled = true; };
  }, [customFonts]);

  // Element inspector state
  const [inspectorMode, setInspectorMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  
  // Legacy import state
  const [legacyImportModalOpen, setLegacyImportModalOpen] = useState(false);
  const [batchConvertModalOpen, setBatchConvertModalOpen] = useState(false);
  const [preservedFolders, setPreservedFolders] = useState<PreservedFolders | null>(null);
  const [importedCssClassesData, setImportedCssClassesData] = useState<CssClassesData | null>(null);

  // baseStylesV6 cache state — when populated, theme.css compilation
  // pulls from the live mirror of beru-org/Assets instead of the
  // bundled fallback. Refresh on demand from the header button.
  const [baseStylesMeta, setBaseStylesMeta] = useState<{
    fetchedAt: string;
    commitSha: string;
    fileCount: number;
  } | null>(null);
  const [refreshingBaseStyles, setRefreshingBaseStyles] = useState(false);

  useEffect(() => {
    fetch('/api/base-styles-status')
      .then((r) => r.json())
      .then((d) => { if (d.cached && d.meta) setBaseStylesMeta(d.meta); })
      .catch(() => { /* status check is best-effort; fall back silently */ });
  }, []);

  const handleRefreshBaseStyles = useCallback(async () => {
    setRefreshingBaseStyles(true);
    try {
      const resp = await fetch('/api/refresh-base-styles', { method: 'POST' });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.message || data.error || 'Refresh failed');
      }
      setBaseStylesMeta({
        fetchedAt: data.fetchedAt,
        commitSha: data.commitSha,
        fileCount: data.fileCount,
      });

      // Re-pull the variables from the freshly-cached _variables.scss
      // and merge with the in-memory state. We update each variable's
      // defaultValue to the new framework default; the value is only
      // overwritten when the user hadn't customized it (i.e. value
      // still matched the previous defaultValue). Variables that exist
      // only in memory (e.g. legacy-import "other" entries) are kept.
      let preservedEdits = 0;
      let updatedDefaults = 0;
      let newAdded = 0;
      try {
        const { content } = await fetchSampleScss();
        setBaseScss(content);
        const parsed = await parseScssContent(content);
        const parsedByName = new Map(parsed.map((p) => [p.name, p]));

        setCategories((prevCats) => {
          const uniqueCategories = Array.from(new Set(parsed.map((v) => v.category)));
          return uniqueCategories.map((catId) => {
            const existing = prevCats.find((c) => c.id === catId) ||
              defaultCategories.find((c) => c.id === catId);
            return (
              existing || {
                id: catId,
                name: catId.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                icon: 'Circle',
                variables: [],
              }
            );
          });
        });

        setVariables((prev) => {
          const prevByName = new Map(prev.map((p) => [p.name, p]));
          const merged = parsed.map((nv) => {
            const existing = prevByName.get(nv.name);
            if (!existing) {
              newAdded++;
              return nv;
            }
            const userCustomized = existing.value !== existing.defaultValue;
            if (userCustomized) {
              preservedEdits++;
              return { ...nv, value: existing.value };
            }
            if (existing.defaultValue !== nv.defaultValue) updatedDefaults++;
            return nv; // matched default → adopt new framework value
          });
          // Keep variables that aren't in the new sample (e.g. imported
          // "other"-category vars from a legacy theme) so we don't drop
          // user data on refresh.
          const orphaned = prev.filter((p) => !parsedByName.has(p.name));
          return [...merged, ...orphaned];
        });
      } catch (mergeErr) {
        console.warn('baseStyles refreshed, but variable merge failed:', mergeErr);
      }

      toast({
        title: 'V6 framework synced',
        description:
          `${data.fileCount} files · commit ${data.commitSha.slice(0, 7)}.` +
          (updatedDefaults || preservedEdits || newAdded
            ? ` ${updatedDefaults} default${updatedDefaults === 1 ? '' : 's'} updated, ` +
              `${preservedEdits} user edit${preservedEdits === 1 ? '' : 's'} preserved` +
              (newAdded ? `, ${newAdded} new` : '') + '.'
            : ''),
      });
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const isProxyError = /proxy|8888|proxyconnect/i.test(rawMsg);
      toast({
        title: 'Sync failed',
        description: isProxyError
          ? 'Could not reach GitHub — a proxy (e.g. Charles) seems to be blocking the request. Disable the proxy and try again.'
          : rawMsg,
        variant: 'destructive',
      });
    } finally {
      setRefreshingBaseStyles(false);
    }
  }, [toast]);
  
  // Export name dialog state
  const [exportNameDialogOpen, setExportNameDialogOpen] = useState(false);
  const [exportThemeName, setExportThemeName] = useState('theme');
  // When true and showDirectoryPicker is supported, the export is
  // written as an unzipped folder structure (the user picks a parent
  // directory). Falls back to a zip download where unsupported.
  const [exportAsFolder, setExportAsFolder] = useState(
    typeof window !== 'undefined' && 'showDirectoryPicker' in window,
  );
  
  // Theme import file input ref
  const themeImportInputRef = useRef<HTMLInputElement>(null);
  
  // Store original default values from baseStylesV6 for reset functionality
  const [originalDefaults, setOriginalDefaults] = useState<Map<string, string>>(new Map());

  const handleVariableChange = useCallback((name: string, value: string) => {
    setVariables(prev => prev.map(v => 
      v.name === name ? { ...v, value } : v
    ));
  }, []);

  const handleResetVariables = useCallback(() => {
    setVariables(prev => prev.map(v => {
      const originalValue = originalDefaults.get(v.name);
      return { ...v, value: originalValue !== undefined ? originalValue : v.defaultValue };
    }));
    toast({
      title: 'Variables reset',
      description: 'All variables have been reset to their default values.',
    });
  }, [toast, originalDefaults]);

  const handleResetEverything = useCallback(() => {
    setVariables(prev => prev.map(v => {
      const originalValue = originalDefaults.get(v.name);
      return { ...v, value: originalValue !== undefined ? originalValue : v.defaultValue };
    }));
    setCustomFonts([]);
    setFontCssForPreview('');
    setScssFiles([]);
    setJsFiles([]);
    setCustomGraphics([]);
    // Drop the persisted snapshot too — otherwise the debounced saver
    // would just re-persist the freshly-reset state and it'd look like
    // nothing happened after the next reload.
    clearPersistedState();
    toast({
      title: 'Everything reset',
      description: 'All variables, custom fonts, custom graphics, custom CSS, and custom JS have been reset.',
    });
  }, [toast, originalDefaults]);

  const handleResetCategory = useCallback((categoryId: string) => {
    setVariables(prev => prev.map(v => {
      if (v.category !== categoryId) return v;
      const originalValue = originalDefaults.get(v.name);
      return { ...v, value: originalValue !== undefined ? originalValue : v.defaultValue };
    }));
    const categoryName = categories.find(c => c.id === categoryId)?.name || categoryId;
    toast({
      title: 'Category reset',
      description: `${categoryName} variables have been reset.`,
    });
  }, [toast, categories, originalDefaults]);

  const handleImportTheme = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // Find theme folder - could be named "theme" or a custom name
      // JSZip.folder() always returns a reference, so check if files exist in it
      const allPaths = Object.keys(zip.files);
      
      // Find unique top-level folder names
      const topLevelFolders = new Set<string>();
      allPaths.forEach(path => {
        const parts = path.split('/');
        if (parts.length > 1 && parts[0]) {
          topLevelFolders.add(parts[0]);
        }
      });
      
      // Check if "theme" folder exists, otherwise use the first folder found
      let themeFolderName = 'theme';
      if (!topLevelFolders.has('theme')) {
        const folderNames = Array.from(topLevelFolders);
        if (folderNames.length > 0) {
          themeFolderName = folderNames[0];
        } else {
          toast({
            title: 'Invalid theme file',
            description: 'The zip file does not contain a theme folder.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      }
      
      const themeFolder = zip.folder(themeFolderName);
      if (!themeFolder) {
        toast({
          title: 'Invalid theme file',
          description: 'The zip file does not contain a theme folder.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      
      // Import theme.scss and parse variables (check both root and css folder)
      let themeScsFile = themeFolder.file('css/theme.scss');
      if (!themeScsFile) {
        themeScsFile = themeFolder.file('theme.scss');
      }
      if (themeScsFile) {
        const content = await themeScsFile.async('string');
        setBaseScss(content);
        
        const parsedVariables = await parseScssContent(content);
        if (parsedVariables.length > 0) {
          // Create a map of imported variable values
          const importedValues = new Map<string, string>();
          parsedVariables.forEach(v => importedValues.set(v.name, v.value));
          
          // Update existing variables with imported values (preserves categories and structure)
          setVariables(prev => {
            const updated = prev.map(v => {
              const importedValue = importedValues.get(v.name);
              return importedValue !== undefined ? { ...v, value: importedValue } : v;
            });
            return updated;
          });
          
          // Keep existing categories (don't replace with potentially malformed ones)
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
      
      // Build a set of custom-import filenames whose @import lines are
      // commented out in theme.scss so we round-trip the per-file
      // enabled/disabled state across V6 export → V6 re-import. Matches
      // both `// @import '../custom/foo.scss';` and `/* @import ... */`.
      const disabledCustomImports = new Set<string>();
      if (themeScsFile) {
        const themeScssContent = await themeScsFile.async('string');
        const commentedImportRegex =
          /(?:\/\/|\/\*)\s*@import\s+['"]\.\.\/custom\/([^'"]+)['"]\s*;?/g;
        let match: RegExpExecArray | null;
        while ((match = commentedImportRegex.exec(themeScssContent)) !== null) {
          disabledCustomImports.add(match[1]);
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
              content,
              ...(disabledCustomImports.has(relativePath) ? { enabled: false } : {}),
            });
          }
        });

        // Wait a bit for async forEach to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        if (importedScssFiles.length > 0) {
          setScssFiles(prev => [...prev.filter(f => f.content.trim()), ...importedScssFiles]);
        }
      }

      // Import custom JS files from js/ folder. Files written as a
      // disabled-wrapped comment block (the marker we use on export) are
      // unwrapped here and re-flagged as `enabled: false` so the round-trip
      // preserves their state. Anything else is treated as enabled.
      const jsFolder = themeFolder.folder('js');
      if (jsFolder) {
        const importedJsFiles: JsFile[] = [];
        const jsPromises: Promise<void>[] = [];
        let jsIndex = 0;
        const DISABLED_MARKER =
          /^\/\*\n \* This file is marked DISABLED in the Theme Creator\.\n \* Re-enable it in the Custom JS tab to remove this wrapper\.\n([\s\S]*?)\n \*\/\n?$/;

        jsFolder.forEach((relativePath, file) => {
          if (!file.dir && /\.js$/i.test(relativePath)) {
            jsPromises.push(
              (async () => {
                const raw = await file.async('string');
                const m = raw.match(DISABLED_MARKER);
                const enabled = m === null;
                const content = m ? m[1].replace(/\*\\\//g, '*/') : raw;
                importedJsFiles.push({
                  id: `imported-js-${Date.now()}-${jsIndex++}`,
                  name: relativePath,
                  content,
                  ...(enabled ? {} : { enabled: false }),
                });
              })(),
            );
          }
        });
        await Promise.all(jsPromises);
        if (importedJsFiles.length > 0) {
          setJsFiles((prev) => [
            ...prev.filter((f) => f.content.trim()),
            ...importedJsFiles,
          ]);
        }
      }

      // Parse any @font-face rules the theme.scss ships with, so we can
      // attach the theme-authored family/weight/style to each imported
      // font file instead of guessing from the filename. Guessing goes
      // wrong when the theme picks an arbitrary family name — most
      // notably variable fonts whose filenames encode axis tags like
      // `YTLC,opsz,wdth,wght` and whose declared family name doesn't
      // reverse-map cleanly. Keyed by the basename of the font URL.
      const themeFontFace = new Map<string, { family: string; weight?: string; style?: string }>();
      if (themeScsFile) {
        const themeScssContent = await themeScsFile.async('string');
        // Match one @font-face block at a time; single-quoted, double-
        // quoted, or unquoted family names all accepted. `src` is
        // required (that's how we map to a file); weight/style are
        // optional and fall back to filename-derived guesses.
        const fontFaceRe = /@font-face\s*\{([^}]*)\}/gi;
        let ffMatch: RegExpExecArray | null;
        while ((ffMatch = fontFaceRe.exec(themeScssContent)) !== null) {
          const body = ffMatch[1];
          const familyMatch = body.match(/font-family\s*:\s*(?:'([^']+)'|"([^"]+)"|([^;,\n]+?))\s*(?:;|$)/i);
          const srcMatch = body.match(/src\s*:[^;]*url\(\s*['"]?([^'")]+)['"]?\s*\)/i);
          if (!familyMatch || !srcMatch) continue;
          const family = (familyMatch[1] || familyMatch[2] || familyMatch[3] || '').trim();
          const src = srcMatch[1].trim();
          const basename = src.split('/').pop() || src;
          const weightMatch = body.match(/font-weight\s*:\s*([^;]+?)\s*;/i);
          const styleMatch = body.match(/font-style\s*:\s*([^;]+?)\s*;/i);
          themeFontFace.set(basename, {
            family,
            weight: weightMatch ? weightMatch[1].trim() : undefined,
            style: styleMatch ? styleMatch[1].trim() : undefined,
          });
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
                const basename = relativePath.split('/').pop() || relativePath;
                const themeDecl = themeFontFace.get(basename);
                importedFonts.push({
                  id: `imported-font-${Date.now()}-${currentIndex}`,
                  name: relativePath,
                  data: uint8Data,
                  type: mimeTypes[ext] || 'font/ttf',
                  size: uint8Data.length,
                  ...(themeDecl ? {
                    family: themeDecl.family,
                    weight: themeDecl.weight,
                    style: themeDecl.style,
                  } : {}),
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
      
      // Import preserved folders (charts only — release/ is dropped, V6
      // doesn't ship per-theme releases, and gfx/ is handled by the
      // Custom Graphics tab below).
      const chartsMap = new Map<string, Uint8Array>();
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

      if (chartsMap.size > 0) {
        setPreservedFolders(prev => ({
          charts: chartsMap,
          fonts: prev?.fonts || new Map(),
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
      
      // Store original defaults from baseStylesV6 (only on initial load)
      setOriginalDefaults(prev => {
        if (prev.size === 0) {
          const defaults = new Map<string, string>();
          parsedVariables.forEach(v => defaults.set(v.name, v.defaultValue));
          return defaults;
        }
        return prev;
      });

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

  // Hydrate from localStorage if the user has a working session saved,
  // otherwise fall back to loading the bundled sample. `hydratedRef`
  // gates the auto-save effect below so we don't immediately overwrite
  // the persisted snapshot with the initial-state stub during the very
  // first render.
  const hydratedRef = useRef(false);
  useEffect(() => {
    const persisted = loadPersistedState();
    if (persisted) {
      setVariables(persisted.variables);
      setScssFiles(persisted.scssFiles);
      setJsFiles(persisted.jsFiles);
      setCssClassesData(persisted.cssClassesData);
      setOriginalDefaults(new Map(persisted.originalDefaults));
      setBaseScss(persisted.baseScss);
      // Derive categories from the restored variables so the accordion
      // groupings match the saved state.
      const uniqueCategories = Array.from(new Set(persisted.variables.map(v => v.category)));
      setCategories(uniqueCategories.map(catId => {
        const existing = defaultCategories.find(c => c.id === catId);
        return existing || {
          id: catId,
          name: catId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          icon: 'Circle',
          variables: [],
        };
      }));
      hydratedRef.current = true;
      return;
    }
    handleLoadSample(false).then(() => { hydratedRef.current = true; });
  }, []);

  // Load CSS classes data on mount (so it's available for export even
  // if tab is not visited). Skip when we already restored a saved
  // session — the persisted copy is the source of truth then.
  useEffect(() => {
    if (loadPersistedState()) return;
    const loadCssClasses = async () => {
      try {
        const response = await fetch('/api/styles-xml');
        const result = await response.json();
        if (result.success && result.data) {
          setCssClassesData(result.data);
        }
      } catch (err) {
        console.error('Failed to load CSS classes:', err);
      }
    };
    loadCssClasses();
  }, []);

  // Debounced auto-save of the working session. Fires whenever any of
  // the persisted slices change, but not before the initial hydrate
  // has completed (otherwise the empty first render would wipe the
  // saved snapshot before restore).
  useEffect(() => {
    if (!hydratedRef.current) return;
    schedulePersistedSave({
      variables,
      scssFiles,
      jsFiles,
      cssClassesData,
      originalDefaults: Array.from(originalDefaults.entries()),
      baseScss,
    });
  }, [variables, scssFiles, jsFiles, cssClassesData, originalDefaults, baseScss]);

  const handleLegacyImportComplete = useCallback(async (result: {
    mappedVariables: { name: string; value: string }[];
    clearedVariables?: string[];
    stylesXml: string | null;
    preservedFolders: PreservedFolders;
    customScssFiles: CustomScssFile[];
    fontFiles: ImportedFontFile[];
    graphicFiles: ImportedGraphicFile[];
    jsFiles?: { id: string; name: string; content: string }[];
  }) => {
    // Apply mapped variables to existing state
    setVariables(prev => {
      const mappedMap = new Map(result.mappedVariables.map(v => [v.name, v.value]));
      // V5 vars the theme explicitly set to `notset` — overwrite the
      // V6 default with empty so the user sees an unset control,
      // matching what V5's compile output would have produced (no
      // declaration → cascade default → no value). Without this the
      // V6 default leaks through and (e.g.) a notset border still
      // shows "1px solid color-brand-a".
      const clearedSet = new Set(result.clearedVariables ?? []);
      const existingNames = new Set(prev.map(v => v.name));
      
      // Update existing variables
      const updated = prev.map(variable => {
        const mappedValue = mappedMap.get(variable.name);
        if (mappedValue !== undefined) {
          return { ...variable, value: mappedValue };
        }
        if (clearedSet.has(variable.name)) {
          return { ...variable, value: '' };
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
        content: f.content,
        // Font files (css/fonts/) are enabled immediately — they contain
        // @font-face declarations the preview needs to render the correct
        // typeface. Other custom CSS (css/custom/) stays disabled until
        // the user opts in via the Custom CSS panel toggle.
        enabled: f.fromFontsFolder === true,
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

    // Import custom JS files. Always default to disabled — themes
    // shipping bespoke JS often have hardcoded selectors / API endpoints
    // that may break in the new V6 markup, so the user opts in by
    // flipping the toggle in the Custom JS tab.
    if (result.jsFiles && result.jsFiles.length > 0) {
      const importedJs: JsFile[] = result.jsFiles.map((f, index) => ({
        id: `imported-js-${Date.now()}-${index}`,
        name: f.name,
        content: f.content,
        enabled: false,
      }));
      setJsFiles((prev) => {
        const filteredPrev = prev.filter((f) => f.content.trim());
        return [...filteredPrev, ...importedJs];
      });
      toast({
        title: 'Custom JS files imported',
        description: `Imported ${result.jsFiles.length} custom JS file(s) (disabled by default)`,
      });
    }

    // Import font files to Custom Fonts tab
    if (result.fontFiles.length > 0) {
      // Convert ImportedFontFile to FontFile format. Preserve
      // `originalPath` so the export round-trips the subfolder
      // structure (e.g. `fonts/founders-grotesk/regular.woff2`).
      const importedFonts: FontFile[] = result.fontFiles.map(f => ({
        id: f.id,
        name: f.name,
        data: f.data,
        type: f.type,
        size: f.size,
        originalPath: f.originalPath,
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

    // Import graphic files to Custom Graphics tab (gfx/ folder)
    if (result.graphicFiles.length > 0) {
      const importedGraphics: GraphicFile[] = result.graphicFiles.map(g => ({
        id: g.id,
        name: g.name,
        data: g.data,
        type: g.type,
        size: g.size,
      }));
      setCustomGraphics(prev => {
        const existingNames = new Set(prev.map(g => g.name.toLowerCase()));
        const fresh = importedGraphics.filter(g => !existingNames.has(g.name.toLowerCase()));
        return [...prev, ...fresh];
      });
      toast({
        title: 'Graphic files imported',
        description: `Imported ${result.graphicFiles.length} graphic file(s) to Custom Graphics`,
      });
    }
  }, [toast]);

  const handleOpenExportDialog = useCallback(() => {
    setExportNameDialogOpen(true);
  }, []);

  const handleExport = useCallback(async () => {
    setExportNameDialogOpen(false);
    setIsLoading(true);
    try {
      // Sanitize theme name for filenames
      const safeName = exportThemeName.replace(/[^a-zA-Z0-9-_]/g, '') || 'theme';
      
      // Create zip file with theme.css and styles.xml
      const zip = new JSZip();
      const themeFolder = zip.folder(safeName);
      
      if (themeFolder) {
        // Filter out empty custom SCSS files
        const nonEmptyFiles = scssFiles.filter(f => f.content.trim());
        
        // Variables that need SCSS variable definitions first, then CSS custom properties referencing them
        const scssVarMapping: { [cssVar: string]: string } = {
          '--color-brand-a': '$color-brand-a',
          '--color-brand-b': '$color-brand-b',
          '--color-brand-c': '$color-brand-c',
          '--color-brand-d': '$color-brand-d',
          '--color-brand-e': '$color-brand-e',
          '--color-brand-f': '$color-brand-f',
          '--color-brand-g': '$color-brand-g',
          '--grid-container-max-width': '$grid-max-width',
        };
        
        // Generate SCSS variable definitions for special variables
        const generateScssVariableDefinitions = (vars: CSSVariable[]) => {
          const lines: string[] = [];
          for (const v of vars) {
            if (scssVarMapping[v.name] && v.value) {
              const scssVarName = scssVarMapping[v.name];
              lines.push(`${scssVarName}: ${v.value};`);
            }
          }
          return lines.join('\n');
        };
        
        // Generate CSS custom properties, with special ones referencing SCSS variables
        const generateCssCustomProperties = (vars: CSSVariable[]) => {
          const lines: string[] = [];
          let currentSection = '';
          
          for (const v of vars) {
            // An empty value is meaningful: it means the user (or a V5 →
            // V6 conversion of a `notset` declaration) intentionally
            // cleared this variable. Falling back to `defaultValue` here
            // would silently re-emit the V6 default in the exported
            // _variables.scss and undo the unset state. Skip the
            // declaration entirely so the cascade default applies, which
            // is what the empty-control state represents in the
            // customizer UI. Only fall through to defaultValue if `value`
            // is undefined (legacy / not yet initialized), not when it's
            // an explicit empty string.
            if (v.value === '') continue;
            if (v.value === undefined && !v.defaultValue) continue;
            
            // Add section comment for Identity Colors
            if (v.name === '--color-brand-a' && currentSection !== 'identity') {
              lines.push('\t/* Identity Colors */');
              currentSection = 'identity';
            }
            
            // Check if this variable should reference an SCSS variable
            if (scssVarMapping[v.name]) {
              const scssVarName = scssVarMapping[v.name];
              lines.push(`\t${v.name}: #{${scssVarName}};`);
            } else {
              // Regular CSS custom property
              lines.push(`\t${v.name}: ${v.value ?? v.defaultValue};`);
            }
          }
          return lines.join('\n');
        };
        
        // ── Build _variables.scss (SCSS vars + :root block only) ─────────
        let variablesScss = '';

        // 1. SCSS variable definitions (colors, grid)
        const scssVarDefs = generateScssVariableDefinitions(variables);
        if (scssVarDefs) {
          variablesScss += `${scssVarDefs}\n\n`;
        }

        // 2. :root CSS custom properties
        const cssProps = generateCssCustomProperties(variables);
        if (cssProps) {
          variablesScss += `:root {\n${cssProps}\n}\n`;
        }

        // ── Build theme.scss ──────────────────────────────────────────────
        let themeScss = '';

        // Custom @font-face declarations (at top of theme.scss)
        const fontFaceCss = generateFontFaceCssForExport(customFonts);
        if (fontFaceCss) {
          themeScss += `/* Custom Font Definitions */\n${fontFaceCss}\n\n`;
        }

        // Fundamentals variables import
        themeScss += `// Importing Fundamentals Variables\n`;
        themeScss += `@import '../../../../../GoBasic/baseStylesV6/css/variables.scss';\n\n`;

        // Theme-specific variables
        themeScss += `// Importing Theme Specific Variables\n`;
        themeScss += `@import 'variables.scss';\n\n`;

        // Fundamentals style imports
        themeScss += `// Importing Fundamentals Styles\n`;
        themeScss += `@import '../../../../../GoBasic/baseStylesV6/css/imports.scss';\n`;
        themeScss += `@import '../../../../../GoBasic/baseStylesV6/css/import-html-publication.scss';`;

        // Custom SCSS file imports (only non-empty). Files marked
        // `enabled === false` (the default for V5 → V6 conversions) are
        // still written to `custom/` below, but their @import line is
        // emitted as a comment so the legacy CSS doesn't load until the
        // user opts back in. The toggle lives in the Custom CSS panel.
        if (nonEmptyFiles.length > 0) {
          themeScss += '\n\n// Custom SCSS Files';
          for (const file of nonEmptyFiles) {
            const importLine = `@import '../custom/${file.name}';`;
            if (file.enabled === false) {
              themeScss += `\n// ${importLine}`;
            } else {
              themeScss += `\n${importLine}`;
            }
          }
        }

        // ── Compile theme.css from the bundled V6 baseStyles ──────────────
        // Up to this point we have the user's _variables.scss content and
        // any enabled custom SCSS files in scope; pass them to the server
        // so the compiled output is the real framework CSS rather than
        // just the :root variable block.
        const enabledCustomScss = nonEmptyFiles
          .filter((f) => f.enabled !== false)
          .map((f) => `/* ${f.name} */\n${f.content}`)
          .join('\n\n');
        // Auto-generated @font-face block from `customFonts` (the
        // binary uploads in the Custom Fonts tab). It's already at the
        // top of theme.scss for source builds, but we also need it in
        // the customizer-compiled theme.css — otherwise serving theme.css
        // directly (e.g. via a Charles Proxy mapping) leaves the browser
        // with no @font-face declarations and the fonts are never
        // requested. Stitched in via customScss (same compile lane).
        const customScssWithFontFace = [fontFaceCss, enabledCustomScss]
          .filter(Boolean)
          .join('\n\n');
        let css: string;
        try {
          css = await compileFullTheme(
            variables.map((v) => ({ name: v.name, value: v.value })),
            variablesScss,
            customScssWithFontFace,
          );
        } catch (compileErr) {
          // Fall back to the thin :root-only output so the export still
          // succeeds — the user can recompile theme.scss in their own
          // build pipeline. Surface the *actual* error message so the
          // user can see why the full compile failed (most often: an
          // imported custom SCSS file references an SCSS variable or
          // @import path that the converter couldn't resolve).
          const errMsg = compileErr instanceof Error ? compileErr.message : String(compileErr);
          console.warn('Full theme compile failed, falling back:', errMsg);
          css = await compileTheme(variables, baseScss);
          toast({
            title: 'theme.css incomplete',
            description: `SCSS compile failed: ${errMsg.slice(0, 240)}. theme.scss in the zip is still valid; recompile it locally with sass.`,
            variant: 'destructive',
            duration: 12000,
          });
        }

        // ── Populate zip ──────────────────────────────────────────────────
        const cssFolder = themeFolder.folder('css');
        if (cssFolder) {
          cssFolder.file('_variables.scss', variablesScss);
          cssFolder.file('theme.scss', themeScss);
          // Compiled CSS output
          cssFolder.file('theme.css', css);

        }

        // Custom fonts go in a top-level fonts/ folder (sibling of css/),
        // matching the V5/V6 theme structure. Use `originalPath` when set
        // (so a legacy theme's `fonts/founders-grotesk/regular.woff2`
        // round-trips into the same subfolder) — otherwise fall back to
        // the bare filename. JSZip handles nested paths transparently.
        if (customFonts.length > 0) {
          const fontsFolder = themeFolder.folder('fonts');
          if (fontsFolder) {
            for (const font of customFonts) {
              const targetPath = font.originalPath || font.name;
              fontsFolder.file(targetPath, font.data);
            }
          }
        }

        // Custom graphics — files whose `name` starts with `assets/` go
        // back to a top-level assets/ folder (they came from the legacy
        // theme's assets/ folder). Everything else lands in gfx/. JSZip
        // handles nested paths transparently when written to a folder.
        if (customGraphics.length > 0) {
          const gfxFolder = themeFolder.folder('gfx');
          const assetsFolder = themeFolder.folder('assets');
          for (const g of customGraphics) {
            if (g.name.startsWith('assets/') && assetsFolder) {
              assetsFolder.file(g.name.slice('assets/'.length), g.data);
            } else if (gfxFolder) {
              gfxFolder.file(g.name, g.data);
            }
          }
        }

        // Add individual SCSS files to custom folder (only non-empty)
        if (nonEmptyFiles.length > 0) {
          const customFolder = themeFolder.folder('custom');
          if (customFolder) {
            for (const file of nonEmptyFiles) {
              customFolder.file(file.name, file.content);
            }
          }
        }

        // Custom JS files land in a top-level js/ folder. Both enabled and
        // disabled files are written so the source survives a round-trip;
        // disabled files are wrapped in a comment block so any naive
        // <script> tag picking them up won't execute the code, while the
        // original content is still recoverable in the zip.
        const nonEmptyJsFiles = jsFiles.filter((f) => f.content.trim());
        if (nonEmptyJsFiles.length > 0) {
          const jsFolder = themeFolder.folder('js');
          if (jsFolder) {
            for (const file of nonEmptyJsFiles) {
              const content =
                file.enabled === false
                  ? `/*\n * This file is marked DISABLED in the Theme Creator.\n * Re-enable it in the Custom JS tab to remove this wrapper.\n` +
                    `${file.content.replace(/\*\//g, '*\\/')}\n */\n`
                  : file.content;
              jsFolder.file(file.name, content);
            }
          }
        }

        // Always add styles.xml (even if empty)
        try {
          const response = await apiRequest('POST', '/api/export-styles-xml', { data: cssClassesData });
          const result = await response.json();
          
          if (result.success) {
            themeFolder.file('styles.xml', result.xml);
          }
        } catch (xmlErr) {
          console.error('XML export error:', xmlErr);
        }
        
        // Add preserved folders from legacy import with proper directory structure
        if (preservedFolders) {
          const addFolderContents = (folderMap: Map<string, Uint8Array>) => {
            folderMap.forEach((data, filePath) => {
              themeFolder.file(filePath, data);
            });
          };
          addFolderContents(preservedFolders.charts);
          // Fonts are NOT written from preservedFolders here — `customFonts`
          // already carries every imported font (with its original sub-path
          // in `originalPath`) and writes them above. Including them here
          // would duplicate the files in the exported zip.
        }
        
        // Three save modes, in order of preference:
        //   1. exportAsFolder + showDirectoryPicker available → write
        //      every file from the in-memory zip directly into a chosen
        //      directory (the user gets an unpacked folder structure
        //      they can edit and re-zip themselves).
        //   2. showSaveFilePicker available → "Save As…" dialog for the
        //      zipped theme.
        //   3. Otherwise → anonymous download to the default Downloads
        //      folder (Firefox / Safari fallback).
        const win = window as unknown as {
          showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
          showSaveFilePicker?: (opts: {
            suggestedName?: string;
            types?: { description: string; accept: Record<string, string[]> }[];
          }) => Promise<FileSystemFileHandle>;
        };

        if (exportAsFolder && typeof win.showDirectoryPicker === 'function') {
          try {
            const parentDir = await win.showDirectoryPicker({ mode: 'readwrite' });
            // Create the theme's top-level folder under the chosen parent.
            const themeDir = await parentDir.getDirectoryHandle(safeName, { create: true });

            // Walk the in-memory JSZip and write each non-directory entry
            // into the picked directory, mirroring the path. Strip the
            // outer `<safeName>/` prefix the zip builder added so we
            // don't end up with a doubled `safeName/safeName/` nesting.
            const entries = Object.entries(zip.files).filter(([_, e]) => !e.dir);
            const stripPrefix = `${safeName}/`;
            for (const [path, entry] of entries) {
              const rel = path.startsWith(stripPrefix) ? path.slice(stripPrefix.length) : path;
              if (!rel) continue;
              const segments = rel.split('/').filter(Boolean);
              const fileName = segments.pop()!;
              let dir: FileSystemDirectoryHandle = themeDir;
              for (const seg of segments) {
                dir = await dir.getDirectoryHandle(seg, { create: true });
              }
              const fileHandle = await dir.getFileHandle(fileName, { create: true });
              const writable = await (fileHandle as unknown as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
              const data = await entry.async('uint8array');
              await writable.write(data);
              await writable.close();
            }
            toast({
              title: 'Export successful',
              description: `Theme written to "${safeName}/" in the chosen folder.`,
            });
          } catch (err) {
            if ((err as DOMException)?.name === 'AbortError') return;
            throw err;
          }
          return;
        }

        // Zip path
        const content = await zip.generateAsync({ type: 'blob' });
        const fileName = `${safeName}.zip`;

        if (typeof win.showSaveFilePicker === 'function') {
          try {
            const handle = await win.showSaveFilePicker({
              suggestedName: fileName,
              types: [{ description: 'Theme zip', accept: { 'application/zip': ['.zip'] } }],
            });
            const writable = await (handle as unknown as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
            await writable.write(content);
            await writable.close();
            toast({
              title: 'Export successful',
              description: `Theme "${safeName}" saved.`,
            });
          } catch (err) {
            if ((err as DOMException)?.name === 'AbortError') return;
            throw err;
          }
        } else {
          const url = URL.createObjectURL(content);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast({
            title: 'Export successful',
            description: `Theme "${safeName}" has been downloaded as ${fileName}.`,
          });
        }
      }
    } catch (err) {
      console.error('Compile error:', err);
      toast({
        title: 'Export failed',
        description: 'Unable to compile the theme. Please try again.',
        variant: 'destructive',
      });
    } finally {
      // Use `finally` rather than a tail call so isLoading flips back to
      // false even when the body short-circuits via early `return` —
      // notably (1) after a successful exportAsFolder write and (2) when
      // the user cancels showSaveFilePicker / showDirectoryPicker
      // (DOMException AbortError). Without this the in-dialog Export
      // button stays `disabled={isLoading}` forever after the first run.
      setIsLoading(false);
    }
  }, [variables, baseScss, toast, cssClassesData, scssFiles, jsFiles, preservedFolders, customFonts, customGraphics, exportThemeName, exportAsFolder]);

  const [activeTab, setActiveTab] = useState('design');
  const { scheme, toggle: toggleColorScheme } = useColorScheme();

  return (
    <div className="flex flex-col h-screen bg-muted/20">
      <header className="flex items-center gap-4 px-4 py-2.5 border-b bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur shrink-0 shadow-sm">
        <div className="shrink-0" data-testid="app-brand">
          <span className="font-semibold text-sm tracking-tight">
            GoPublic Theme Creator
          </span>
        </div>
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
              value="custom-js"
              className="gap-2 px-4 py-2"
              data-testid="tab-custom-js"
            >
              <Braces className="h-4 w-4" />
              Custom JS
              {jsFiles.length > 0 && (
                <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {jsFiles.length}
                </span>
              )}
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
            <TabsTrigger
              value="custom-graphics"
              className="gap-2 px-4 py-2"
              data-testid="tab-custom-graphics"
            >
              <ImageIcon className="h-4 w-4" />
              Custom Graphics
              {customGraphics.length > 0 && (
                <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                  {customGraphics.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {/* Hidden file input for the Import Theme button — has to live in
            the DOM so themeImportInputRef.current is available; placement
            doesn't matter visually since it's display:none. The visible
            button lives in the ActionBar at the bottom. */}
        <input
          ref={themeImportInputRef}
          type="file"
          accept=".zip"
          onChange={handleImportTheme}
          className="hidden"
          data-testid="input-import-theme"
        />
        {/* Header utility cluster — sync V6 framework + light/dark
            toggle. Pushed flush-right so the tabs stay flush-left with
            the brand wordmark. */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshBaseStyles}
            disabled={refreshingBaseStyles}
            title={
              baseStylesMeta
                ? `Synced ${new Date(baseStylesMeta.fetchedAt).toLocaleString()} · ` +
                  `commit ${baseStylesMeta.commitSha.slice(0, 7)} · ${baseStylesMeta.fileCount} files\n` +
                  'Click to pull the latest V6 framework from GitHub'
                : 'Pull the latest V6 framework styles from GitHub'
            }
            className="h-9 gap-2"
            data-testid="button-refresh-base-styles"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshingBaseStyles ? 'animate-spin' : ''}`}
            />
            <span className="hidden md:inline text-sm">
              {refreshingBaseStyles
                ? 'Syncing…'
                : baseStylesMeta
                  ? `V6 · ${new Date(baseStylesMeta.fetchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                  : 'Sync V6'}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleColorScheme}
            className="h-9 w-9"
            aria-label={
              scheme === 'dark'
                ? 'Switch to light mode'
                : 'Switch to dark mode'
            }
            title={
              scheme === 'dark'
                ? 'Switch to light mode'
                : 'Switch to dark mode'
            }
            data-testid="button-toggle-color-scheme"
          >
            {scheme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Keep the design pane MOUNTED across tab switches (just hide
            it when another tab is active). PreviewPane owns its URL,
            iframe document, and theme-swap response in local state —
            unmounting/remounting would reload the default URL and lose
            whatever the user had pasted in. The other tabs (Custom
            CSS / JS / Fonts / Graphics) keep their data in lifted parent
            state, so they tolerate unmounting; this one doesn't. */}
        <div
          className={`flex-1 min-h-0 ${activeTab === 'design' ? '' : 'hidden'}`}
          aria-hidden={activeTab !== 'design'}
        >
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
                inspectorMode={inspectorMode}
                onInspectorModeChange={setInspectorMode}
                selectedElement={selectedElement}
                onClearSelectedElement={() => setSelectedElement(null)}
              />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={65}>
              <PreviewPane
                variables={variables}
                previewHtml=""
                customCssFiles={scssFiles}
                fontCss={fontCssForPreview}
                baseScss={baseScss}
                inspectorMode={inspectorMode}
                onElementSelect={(element) => {
                  setSelectedElement(element);
                  if (element) {
                    setInspectorMode(false);
                  }
                }}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

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

        {activeTab === 'custom-js' && (
          <div className="flex-1 min-h-0">
            <CustomJsManager files={jsFiles} onFilesChange={setJsFiles} />
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

        {activeTab === 'custom-graphics' && (
          <div className="flex-1 min-h-0">
            <CustomGraphicsManager
              graphics={customGraphics}
              onGraphicsChange={setCustomGraphics}
            />
          </div>
        )}

        <ActionBar
          onExport={handleOpenExportDialog}
          onResetAll={handleResetEverything}
          secondaryActions={
            <>
              <Button
                variant="outline"
                onClick={() => themeImportInputRef.current?.click()}
                data-testid="button-import-theme"
              >
                <Package className="h-4 w-4 mr-2" />
                Import V6 theme
              </Button>
              {/* The two conversion buttons are flushed together to
                  visually signal "same family of action — convert V5
                  source into V6 output". `rounded-r-none` /
                  `rounded-l-none` removes the corners that face each
                  other; `-ml-px` collapses the doubled outline border. */}
              <div className="flex">
                <Button
                  variant="outline"
                  onClick={() => setLegacyImportModalOpen(true)}
                  data-testid="button-legacy-import"
                  className="rounded-r-none"
                >
                  <Recycle className="h-4 w-4 mr-2" />
                  Convert V5 theme
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setBatchConvertModalOpen(true)}
                  data-testid="button-batch-convert"
                  className="rounded-l-none -ml-px"
                >
                  <Layers className="h-4 w-4 mr-2" />
                  Batch convert V5 themes
                </Button>
              </div>
            </>
          }
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

      <BatchConvertModal
        open={batchConvertModalOpen}
        onOpenChange={setBatchConvertModalOpen}
      />

      <Dialog open={exportNameDialogOpen} onOpenChange={setExportNameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Theme</DialogTitle>
            <DialogDescription>
              Enter a name for your theme. This will be used for the zip file and folder.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="theme-name">Theme Name</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="theme-name"
                  value={exportThemeName}
                  onChange={(e) => setExportThemeName(e.target.value.replace(/[^a-zA-Z0-9-_\s]/g, ''))}
                  placeholder="theme"
                  className="flex-1"
                  data-testid="input-export-theme-name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && exportThemeName.trim()) {
                      handleExport();
                    }
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  {exportAsFolder ? '/ (folder)' : '.zip'}
                </span>
              </div>
            </div>
            {typeof window !== 'undefined' && 'showDirectoryPicker' in window && (
              <div className="flex items-start gap-2">
                <input
                  id="export-as-folder"
                  type="checkbox"
                  checked={exportAsFolder}
                  onChange={(e) => setExportAsFolder(e.target.checked)}
                  className="mt-1"
                  data-testid="checkbox-export-as-folder"
                />
                <Label htmlFor="export-as-folder" className="text-sm font-normal cursor-pointer">
                  <span className="font-medium">Export as folder</span> (instead of zip)
                  <span className="block text-xs text-muted-foreground">
                    Pick a destination folder; the theme is written there directly. Chromium browsers only.
                  </span>
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportNameDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleExport} 
              disabled={!exportThemeName.trim() || isLoading}
              data-testid="button-confirm-export"
            >
              {isLoading ? 'Exporting...' : 'Export'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
