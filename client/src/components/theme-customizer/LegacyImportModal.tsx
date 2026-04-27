import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileArchive, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
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

  const processZip = useCallback(async (file: File) => {
    setStep('processing');
    setProgress(0);
    setValidationErrors([]);

    try {
      setStatusMessage('Reading zip file...');
      setProgress(10);
      
      const zip = await JSZip.loadAsync(file);
      
      let rootPrefix = '';
      const entries = Object.keys(zip.files);
      // Filter out __MACOSX and .DS_Store entries for detection
      const relevantEntries = entries.filter(e => 
        !e.startsWith('__MACOSX') && !e.includes('.DS_Store')
      );
      const firstEntry = relevantEntries.find(e => !e.endsWith('/'));
      if (firstEntry && firstEntry.includes('/')) {
        const parts = firstEntry.split('/');
        if (parts.length > 1) {
          const potentialRoot = parts[0] + '/';
          // Check if all relevant entries are under the potential root
          const allUnderRoot = relevantEntries.every(e => 
            e.startsWith(potentialRoot) || e === parts[0] || e === potentialRoot
          );
          if (allUnderRoot) {
            rootPrefix = potentialRoot;
          }
        }
      }
      
      setStatusMessage('Validating structure...');
      setProgress(20);
      
      // Case-insensitive check for styles.xml
      const hasStyles = relevantEntries.some(e => {
        const relativePath = rootPrefix ? e.replace(rootPrefix, '') : e;
        return relativePath.toLowerCase() === 'styles.xml';
      });
      // Case-insensitive check for css folder
      const hasCss = relevantEntries.some(e => {
        const relativePath = rootPrefix ? e.replace(rootPrefix, '') : e;
        return relativePath.toLowerCase().startsWith('css/');
      });
      
      const errors: string[] = [];
      if (!hasStyles) {
        errors.push('Missing styles.xml file');
      }
      if (!hasCss) {
        errors.push('Missing css/ folder');
      }
      
      if (errors.length > 0) {
        setValidationErrors(errors);
        setStep('upload');
        return;
      }
      
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
      const mappedVariables = applyMapping(scssVariables, mappings);
      
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
        description: err instanceof Error ? err.message : 'Failed to process the zip file',
        variant: 'destructive'
      });
      setStep('upload');
    }
  }, [toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a .zip file',
          variant: 'destructive'
        });
        return;
      }
      processZip(file);
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
            Upload a zip file containing your legacy theme folder to convert it to the new format.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate cursor-pointer"
              onClick={() => document.getElementById('legacy-zip-input')?.click()}
              data-testid="dropzone-legacy-import"
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Click to upload zip file</p>
              <p className="text-xs text-muted-foreground">
                Must contain: css/, styles.xml
              </p>
              <p className="text-xs text-muted-foreground">
                Optional: charts/, fonts/, release/
              </p>
              <input
                id="legacy-zip-input"
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-legacy-zip"
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
