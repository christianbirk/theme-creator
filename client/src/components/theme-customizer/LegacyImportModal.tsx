import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileArchive, FolderOpen, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import { parseMappingCsv, parseScssFile, applyMapping, ParsedScssVariables, convertScssVariablesToCss } from '@/lib/legacy-import';

export interface PreservedFolders {
  charts: Map<string, Uint8Array>;
  fonts: Map<string, Uint8Array>;
  release: Map<string, Uint8Array>;
}

export interface CustomScssFile {
  id: string;
  name: string;
  content: string;
}

export interface ImportedFontFile {
  id: string;
  name: string;
  data: Uint8Array;
  type: string;
  size: number;
  blobUrl?: string;
  originalPath?: string;
}

interface ImportResult {
  mappedVariables: { name: string; value: string }[];
  /**
   * V6 variable names that the V5 theme explicitly cleared via the
   * `notset` sentinel. The consumer should overwrite its own V6
   * defaults for these with empty values so the user sees them as
   * intentionally unset (e.g. an empty Border control) rather than
   * leftover V6 defaults.
   */
  clearedVariables: string[];
  unmappedScssCount: number;
  stylesXml: string | null;
  preservedFolders: PreservedFolders;
  scssFilesProcessed: number;
  customScssFiles: CustomScssFile[];
  fontFiles: ImportedFontFile[];
}

interface LegacyImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (result: ImportResult) => void;
}

type ImportStep = 'upload' | 'processing' | 'review' | 'complete';

export function LegacyImportModal({ open, onOpenChange, onImportComplete }: LegacyImportModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<ImportStep>('upload');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const resetState = useCallback(() => {
    setStep('upload');
    setProgress(0);
    setStatusMessage('');
    setImportResult(null);
    setValidationErrors([]);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [onOpenChange, resetState]);

  const processZip = useCallback(async (zip: JSZip) => {
    setStep('processing');
    setProgress(0);
    setValidationErrors([]);

    try {
      setStatusMessage('Analyzing files...');
      setProgress(10);

      const entries = Object.keys(zip.files);
      // Filter out macOS metadata that should never be considered theme files.
      const relevantEntries = entries.filter(e => {
        const lower = e.toLowerCase();
        if (e.startsWith('__MACOSX')) return false;
        // .DS_Store and AppleDouble (._*) companion files
        const fileName = e.split('/').filter(Boolean).pop() || '';
        if (fileName === '.DS_Store') return false;
        if (fileName.startsWith('._')) return false;
        return lower.length > 0;
      });

      // Diagnostic: surface what JSZip actually saw so we can debug folder
      // imports that mysteriously fail validation in real browsers.
      console.log(
        '[LegacyImport] zip entries:', entries.length,
        'relevant:', relevantEntries.length,
        'first paths:', relevantEntries.slice(0, 12),
      );

      setStatusMessage('Validating structure...');
      setProgress(20);

      // Helper: number of path segments (depth) for ranking candidate roots.
      const depthOf = (prefix: string): number =>
        prefix === '' ? 0 : prefix.split('/').filter(Boolean).length;

      // Locate every directory that contains a styles.xml (case-insensitive).
      const stylesDirs = new Set<string>();
      for (const path of relevantEntries) {
        const segments = path.split('/');
        const lastSegment = segments[segments.length - 1];
        if (lastSegment.toLowerCase() === 'styles.xml') {
          const dir = segments.slice(0, -1).join('/');
          stylesDirs.add(dir ? dir + '/' : '');
        }
      }

      // Locate every directory that has an immediate css/ subfolder.
      const cssDirs = new Set<string>();
      for (const path of relevantEntries) {
        const lower = path.toLowerCase();
        const idx = lower.indexOf('css/');
        if (idx === -1) continue;
        // The css/ must appear as a full path segment (start of path or right
        // after a slash) and be followed by something (not just "css/" alone).
        if (idx !== 0 && lower[idx - 1] !== '/') continue;
        if (lower.length <= idx + 'css/'.length) continue;
        const dirPrefix = path.slice(0, idx); // preserves original case
        cssDirs.add(dirPrefix);
      }

      // A directory is a valid theme root only if it contains BOTH styles.xml
      // and a css/ folder side by side.
      const candidateRoots = Array.from(stylesDirs).filter(d => cssDirs.has(d));

      // Independent diagnostics so error messages don't lie.
      const hasStyles = stylesDirs.size > 0;
      const hasCss = cssDirs.size > 0;

      if (candidateRoots.length === 0) {
        const topLevels = new Set<string>();
        for (const e of relevantEntries) {
          const seg = e.split('/').filter(Boolean)[0];
          if (seg) topLevels.add(seg);
        }
        const errors: string[] = [];
        if (!hasStyles) errors.push('Missing styles.xml file');
        if (!hasCss) errors.push('Missing css/ folder');
        if (hasStyles && hasCss) {
          // Both exist somewhere but never as siblings.
          errors.push('Could not find a folder containing both styles.xml and css/ together');
        }
        // Always include diagnostics so the user (and we) can tell what
        // actually arrived from the picker.
        errors.push(`Read ${entries.length} entries (${relevantEntries.length} after filtering metadata).`);
        if (relevantEntries.length > 0) {
          const samplePaths = relevantEntries.slice(0, 5).join(' | ');
          errors.push(`First entries: ${samplePaths}`);
        }
        const preview = Array.from(topLevels).slice(0, 8).join(', ');
        if (preview) {
          errors.push(`Top-level folders: ${preview}${topLevels.size > 8 ? ', …' : ''}`);
        }
        errors.push('Tip: pick the folder that directly contains styles.xml and css/.');
        setValidationErrors(errors);
        setStep('upload');
        return;
      }

      // Rank by true depth (segment count), then by string length as a stable
      // tie-breaker. Deepest = most-specific theme folder.
      candidateRoots.sort((a, b) => {
        const depthDiff = depthOf(b) - depthOf(a);
        if (depthDiff !== 0) return depthDiff;
        return b.length - a.length;
      });

      // If two or more candidates tie at the same maximum depth, the archive
      // contains multiple themes side by side and we can't pick one safely.
      const topDepth = depthOf(candidateRoots[0]);
      const tied = candidateRoots.filter(r => depthOf(r) === topDepth);
      if (tied.length > 1) {
        const list = tied
          .map(r => r === '' ? '(root)' : r.replace(/\/$/, ''))
          .slice(0, 6)
          .join(', ');
        setValidationErrors([
          'Multiple themes detected in the selected folder',
          `Found styles.xml + css/ in: ${list}${tied.length > 6 ? ', …' : ''}`,
          'Tip: pick the specific theme folder you want to import.',
        ]);
        setStep('upload');
        return;
      }

      const rootPrefix = candidateRoots[0];
      
      setStatusMessage('Extracting SCSS variables...');
      setProgress(40);
      
      const scssVariables: ParsedScssVariables = {};
      let scssFilesProcessed = 0;
      
      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        
        const relativePath = rootPrefix ? path.replace(rootPrefix, '') : path;
        const lowerRelativePath = relativePath.toLowerCase();
        
        if (lowerRelativePath.startsWith('css/variables/') && lowerRelativePath.endsWith('.scss')) {
          const content = await zipEntry.async('string');
          const parsed = parseScssFile(content);
          Object.assign(scssVariables, parsed);
          scssFilesProcessed++;
        }
      }
      
      setStatusMessage('Applying variable mapping...');
      setProgress(60);
      
      const mappings = parseMappingCsv();
      const { mapped: mappedVariables, cleared: clearedVariables } = applyMapping(
        scssVariables,
        mappings,
      );
      
      const totalScssVars = Object.keys(scssVariables).length;
      const unmappedScssCount = totalScssVars - mappedVariables.length;
      
      setStatusMessage('Reading styles.xml...');
      setProgress(80);
      
      let stylesXml: string | null = null;
      // Find styles.xml case-insensitively
      const stylesEntry = Object.entries(zip.files).find(([path]) => {
        const relativePath = rootPrefix ? path.replace(rootPrefix, '') : path;
        return relativePath.toLowerCase() === 'styles.xml';
      });
      if (stylesEntry) {
        stylesXml = await stylesEntry[1].async('string');
      }
      
      setStatusMessage('Extracting font files...');
      setProgress(82);
      
      const preservedFolders: PreservedFolders = {
        charts: new Map(),
        fonts: new Map(),
        release: new Map()
      };
      
      // Supported font extensions for Custom Fonts tab
      const SUPPORTED_FONT_EXTENSIONS = ['ttf', 'woff', 'woff2', 'eot'];
      const fontFiles: ImportedFontFile[] = [];
      let fontFileId = 1;
      
      // Map of font paths to their blob URLs for use in SCSS conversion
      const fontBlobUrls: Map<string, string> = new Map();
      
      // Helper to create blob URL from Uint8Array
      const arrayToBlobUrl = (data: Uint8Array, mimeType: string): string => {
        const blob = new Blob([data], { type: mimeType });
        return URL.createObjectURL(blob);
      };
      
      // Helper to get MIME type for font extension
      const getFontMimeType = (ext: string): string => {
        const mimeTypes: Record<string, string> = {
          'ttf': 'font/ttf',
          'woff': 'font/woff',
          'woff2': 'font/woff2',
          'eot': 'application/vnd.ms-fontobject'
        };
        return mimeTypes[ext] || 'application/octet-stream';
      };
      
      // First pass: extract fonts and build blob URL map
      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        
        const relativePath = rootPrefix ? path.replace(rootPrefix, '') : path;
        const lowerPath = relativePath.toLowerCase();
        
        if (lowerPath.startsWith('charts/')) {
          const data = await zipEntry.async('uint8array');
          const normalizedPath = 'charts/' + relativePath.slice(relativePath.indexOf('/') + 1);
          preservedFolders.charts.set(normalizedPath, data);
        } else if (lowerPath.startsWith('fonts/')) {
          const data = await zipEntry.async('uint8array');
          // Get the path after 'fonts/' for matching in SCSS
          const fontSubPath = relativePath.slice(relativePath.toLowerCase().indexOf('fonts/') + 6);
          const normalizedPath = 'fonts/' + fontSubPath;
          preservedFolders.fonts.set(normalizedPath, data);
          
          // Extract supported font files for Custom Fonts tab
          const filename = relativePath.split('/').pop() || '';
          const ext = filename.split('.').pop()?.toLowerCase() || '';
          
          if (SUPPORTED_FONT_EXTENSIONS.includes(ext)) {
            // Create blob URL for this font
            const mimeType = getFontMimeType(ext);
            const blobUrl = arrayToBlobUrl(data, mimeType);
            fontBlobUrls.set(fontSubPath.toLowerCase(), blobUrl);
            
            fontFiles.push({
              id: `imported-font-${fontFileId++}`,
              name: filename,
              data: data,
              type: `font/${ext}`,
              size: data.length,
              blobUrl: blobUrl,
              originalPath: fontSubPath
            });
          }
        } else if (lowerPath.startsWith('release/')) {
          const data = await zipEntry.async('uint8array');
          const normalizedPath = 'release/' + relativePath.slice(relativePath.indexOf('/') + 1);
          preservedFolders.release.set(normalizedPath, data);
        }
      }
      
      setStatusMessage('Extracting custom SCSS files...');
      setProgress(88);
      
      // Helper to convert SCSS font URLs to blob URLs
      const convertFontUrls = (content: string): string => {
        // Match patterns like: url($font_route + 'path/to/font.ext')
        // and url($font-route + 'path/to/font.ext')
        // and url($font_route+'path/to/font.ext') (no spaces)
        const fontUrlPattern = /url\s*\(\s*\$font[-_]route\s*\+\s*['"]([^'"]+)['"]\s*\)/gi;
        
        return content.replace(fontUrlPattern, (match, fontPath) => {
          // Normalize the path and look up in our blob URL map
          const normalizedPath = fontPath.toLowerCase().replace(/^\/+/, '');
          const blobUrl = fontBlobUrls.get(normalizedPath);
          
          if (blobUrl) {
            return `url('${blobUrl}')`;
          }
          
          // If not found, leave as-is (will be handled during export)
          console.warn(`Font not found for path: ${fontPath}`);
          return match;
        });
      };
      
      const customScssFiles: CustomScssFile[] = [];
      let customFileId = 1;
      
      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        
        const relativePath = rootPrefix ? path.replace(rootPrefix, '') : path;
        const lowerRelativePath = relativePath.toLowerCase();
        
        // Look for files in css/custom/ or css/fonts/ folders
        const isCustomScss = lowerRelativePath.startsWith('css/custom/') && lowerRelativePath.endsWith('.scss');
        const isFontsScss = lowerRelativePath.startsWith('css/fonts/') && lowerRelativePath.endsWith('.scss');
        
        if (isCustomScss || isFontsScss) {
          let content = await zipEntry.async('string');
          
          // Convert SCSS variables using 3-tier resolution:
          // 1. Mapped variables -> var(--css-var)
          // 2. Unmapped but defined in zip -> literal value
          // 3. Unknown -> leave as-is
          content = convertScssVariablesToCss(content, mappings, scssVariables);
          
          // For font SCSS files, also convert font URLs to data URLs
          if (isFontsScss) {
            content = convertFontUrls(content);
          }
          
          // Extract filename from path
          const pathParts = relativePath.split('/');
          const filename = pathParts[pathParts.length - 1];
          
          customScssFiles.push({
            id: `imported-${customFileId++}`,
            name: filename,
            content: content
          });
        }
      }
      
      setStatusMessage('Finishing import...');
      setProgress(95);
      
      setProgress(100);
      setStatusMessage('Import complete!');
      
      const result: ImportResult = {
        mappedVariables,
        clearedVariables,
        unmappedScssCount,
        stylesXml,
        preservedFolders,
        scssFilesProcessed,
        customScssFiles,
        fontFiles
      };
      
      setImportResult(result);
      setStep('review');
      
    } catch (err) {
      console.error('Import error:', err);
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Failed to process the legacy theme',
        variant: 'destructive'
      });
      setStep('upload');
    }
  }, [toast]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.endsWith('.zip')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a .zip file',
        variant: 'destructive'
      });
      return;
    }
    try {
      const zip = await JSZip.loadAsync(file);
      processZip(zip);
    } catch (err) {
      toast({
        title: 'Could not read zip',
        description: err instanceof Error ? err.message : 'Failed to open zip file',
        variant: 'destructive'
      });
    }
  }, [processZip, toast]);

  const handleFolderChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.target;
    // CRITICAL: snapshot the FileList into a stable array BEFORE doing
    // anything that might mutate the input. Setting `inputEl.value = ''`
    // clears the input's FileList in real browsers, which makes the cached
    // FileList reference go to length 0 and silently breaks file reads.
    const fileArray: File[] = inputEl.files ? Array.from(inputEl.files) : [];
    const fileCount = fileArray.length;
    console.log('[LegacyImport] folder change fired, file count:', fileCount);

    if (fileCount === 0) {
      // User cancelled the picker, the folder was empty, or the browser
      // could not read any files. Surface this so the user knows why
      // nothing happened.
      inputEl.value = '';
      toast({
        title: 'No files were read from the folder',
        description: 'The folder picker returned no files. Try again, pick a folder that contains your theme files (styles.xml, css/, etc.), or use "Choose Zip" instead.',
        variant: 'destructive'
      });
      return;
    }

    setStep('processing');
    setProgress(0);
    setStatusMessage(`Reading folder (0 of ${fileCount} files)...`);
    setValidationErrors([]);

    try {
      const zip = new JSZip();
      const total = fileArray.length;
      // Yield to the browser every few files so the progress bar can paint.
      // requestAnimationFrame guarantees a paint cycle (setTimeout 0 may be
      // batched away by React on fast loops with small files).
      const YIELD_EVERY = 3;
      const yieldToBrowser = () =>
        new Promise<void>(resolve => {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resolve());
          } else {
            setTimeout(resolve, 16);
          }
        });
      for (let i = 0; i < total; i++) {
        const file = fileArray[i];
        const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const data = await file.arrayBuffer();
        zip.file(relPath, data);
        const done = i + 1;
        setProgress(Math.round((done / total) * 100));
        setStatusMessage(`Reading folder (${done} of ${total} files)...`);
        if (done % YIELD_EVERY === 0 || done === total) {
          await yieldToBrowser();
        }
      }
      // Reset only AFTER the data has been copied into the zip. This lets
      // the user re-pick the same folder later if they need to.
      inputEl.value = '';
      processZip(zip);
    } catch (err) {
      inputEl.value = '';
      toast({
        title: 'Could not read folder',
        description: err instanceof Error ? err.message : 'Failed to read folder contents',
        variant: 'destructive'
      });
      setStep('upload');
    }
  }, [processZip, toast]);

  const handleApplyImport = useCallback(() => {
    if (importResult) {
      onImportComplete(importResult);
      toast({
        title: 'Theme imported',
        description: `Applied ${importResult.mappedVariables.length} variables from legacy theme`,
      });
      handleClose();
    }
  }, [importResult, onImportComplete, toast, handleClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Convert Legacy Theme
          </DialogTitle>
          <DialogDescription>
            Upload a zip file or pick a folder containing your legacy theme to convert it to the new format.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center"
              data-testid="dropzone-legacy-import"
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Upload your legacy theme</p>
              <p className="text-xs text-muted-foreground">
                Must contain: css/, styles.xml
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Optional: charts/, fonts/, release/
              </p>
              <div className="flex gap-2 justify-center">
                <Button 
                  variant="outline"
                  onClick={() => document.getElementById('legacy-zip-input')?.click()}
                  data-testid="button-choose-zip"
                >
                  <FileArchive className="h-4 w-4 mr-2" />
                  Choose Zip
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => document.getElementById('legacy-folder-input')?.click()}
                  data-testid="button-choose-folder"
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Choose Folder
                </Button>
              </div>
              <input
                id="legacy-zip-input"
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-legacy-zip"
              />
              <input
                id="legacy-folder-input"
                type="file"
                multiple
                className="hidden"
                onChange={handleFolderChange}
                data-testid="input-legacy-folder"
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              />
            </div>

            {validationErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Validation errors</span>
                </div>
                <ul className="text-sm text-destructive space-y-1">
                  {validationErrors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">{statusMessage}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === 'review' && importResult && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Ready to import</span>
              </div>
              
              <ScrollArea className="h-40">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SCSS files processed:</span>
                    <span className="font-medium">{importResult.scssFilesProcessed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Variables mapped:</span>
                    <span className="font-medium">{importResult.mappedVariables.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unmapped variables:</span>
                    <span className="font-medium">{importResult.unmappedScssCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">styles.xml found:</span>
                    <span className="font-medium">{importResult.stylesXml ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Custom CSS files:</span>
                    <span className="font-medium">{importResult.customScssFiles.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Font files:</span>
                    <span className="font-medium">{importResult.fontFiles.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preserved files:</span>
                    <span className="font-medium">
                      {importResult.preservedFolders.charts.size + 
                       importResult.preservedFolders.fonts.size + 
                       importResult.preservedFolders.release.size}
                    </span>
                  </div>
                </div>
              </ScrollArea>
            </div>

            <p className="text-sm text-muted-foreground">
              This will update the theme variables with values from your legacy theme. 
              The styles.xml will be loaded into the CSS classes tab.
              Font files will be added to the Custom Fonts tab. 
              Charts and release folders will be included in the export.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-import">
            Cancel
          </Button>
          {step === 'review' && (
            <Button onClick={handleApplyImport} data-testid="button-apply-import">
              Apply Import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
