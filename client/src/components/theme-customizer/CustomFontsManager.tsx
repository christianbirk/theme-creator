import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Upload, Trash2, FileType, AlertCircle, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface FontFile {
  id: string;
  name: string;
  data: Uint8Array;
  type: string;
  size: number;
  blobUrl?: string; // For preview usage
}

interface CustomFontsManagerProps {
  fonts: FontFile[];
  onFontsChange: (fonts: FontFile[]) => void;
  onFontCssChange?: (css: string) => void; // Callback to update font-face CSS
}

const SUPPORTED_EXTENSIONS = ['ttf', 'woff', 'woff2', 'eot'];
const SUPPORTED_MIME_TYPES = [
  'font/ttf',
  'font/woff',
  'font/woff2',
  'application/vnd.ms-fontobject',
  'application/x-font-ttf',
  'application/x-font-woff',
  'application/font-woff',
  'application/font-woff2',
];

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function isSupportedFont(filename: string): boolean {
  const ext = getFileExtension(filename);
  return SUPPORTED_EXTENSIONS.includes(ext);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFontTypeLabel(filename: string): string {
  const ext = getFileExtension(filename);
  switch (ext) {
    case 'ttf': return 'TrueType';
    case 'woff': return 'WOFF';
    case 'woff2': return 'WOFF2';
    case 'eot': return 'EOT';
    default: return ext.toUpperCase();
  }
}

function getFontFormat(filename: string): string {
  const ext = getFileExtension(filename);
  switch (ext) {
    case 'ttf': return 'truetype';
    case 'woff': return 'woff';
    case 'woff2': return 'woff2';
    case 'eot': return 'embedded-opentype';
    default: return ext;
  }
}

function extractFontFamilyName(filename: string): string {
  // Remove extension and clean up the name
  const nameWithoutExt = filename.replace(/\.(ttf|woff|woff2|eot)$/i, '');
  // Convert kebab-case or snake_case to Title Case, preserving weight indicators
  return nameWithoutExt
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Generate @font-face CSS for export (uses relative paths to fonts/ folder)
 */
export function generateFontFaceCssForExport(fonts: FontFile[]): string {
  if (fonts.length === 0) return '';
  
  const rules = fonts.map(font => {
    const fontFamily = extractFontFamilyName(font.name);
    const format = getFontFormat(font.name);
    
    return `@font-face {
  font-family: '${fontFamily}';
  src: url('fonts/${font.name}') format('${format}');
  font-display: swap;
}`;
  });
  
  return `/* Custom Fonts */\n${rules.join('\n\n')}`;
}

/**
 * Generate @font-face CSS for preview (uses blob URLs)
 */
export function generateFontFaceCssForPreview(fonts: FontFile[]): string {
  if (fonts.length === 0) return '';
  
  const rules = fonts.map(font => {
    if (!font.blobUrl) return '';
    
    const fontFamily = extractFontFamilyName(font.name);
    const format = getFontFormat(font.name);
    
    return `@font-face {
  font-family: '${fontFamily}';
  src: url('${font.blobUrl}') format('${format}');
  font-display: swap;
}`;
  }).filter(Boolean);
  
  return rules.join('\n\n');
}

export function CustomFontsManager({ fonts, onFontsChange, onFontCssChange }: CustomFontsManagerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fontToDelete, setFontToDelete] = useState<string | null>(null);
  const [copiedCss, setCopiedCss] = useState(false);

  // Generate CSS for export display
  const generatedCss = useMemo(() => {
    return generateFontFaceCssForExport(fonts);
  }, [fonts]);

  // Create blob URLs for fonts that don't have them
  useEffect(() => {
    let hasChanges = false;
    const updatedFonts = fonts.map(font => {
      if (!font.blobUrl) {
        const blob = new Blob([font.data], { type: font.type });
        const blobUrl = URL.createObjectURL(blob);
        hasChanges = true;
        return { ...font, blobUrl };
      }
      return font;
    });
    
    if (hasChanges) {
      onFontsChange(updatedFonts);
    }
  }, [fonts, onFontsChange]);

  // Notify parent of CSS changes for preview
  useEffect(() => {
    if (onFontCssChange) {
      const previewCss = generateFontFaceCssForPreview(fonts);
      onFontCssChange(previewCss);
    }
  }, [fonts, onFontCssChange]);

  // Track previous fonts to clean up removed font blob URLs
  const previousFontsRef = useRef<FontFile[]>([]);
  
  useEffect(() => {
    // Find fonts that were removed and revoke their blob URLs
    const currentIds = new Set(fonts.map(f => f.id));
    previousFontsRef.current.forEach(prevFont => {
      if (!currentIds.has(prevFont.id) && prevFont.blobUrl) {
        URL.revokeObjectURL(prevFont.blobUrl);
      }
    });
    previousFontsRef.current = fonts;
  }, [fonts]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  const handleCopyCss = useCallback(() => {
    navigator.clipboard.writeText(generatedCss);
    setCopiedCss(true);
    setTimeout(() => setCopiedCss(false), 2000);
    toast({
      title: 'CSS copied',
      description: '@font-face rules copied to clipboard',
    });
  }, [generatedCss, toast]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFonts: FontFile[] = [];
    const unsupportedFiles: string[] = [];
    const duplicateFiles: string[] = [];

    for (const file of Array.from(files)) {
      if (!isSupportedFont(file.name)) {
        unsupportedFiles.push(file.name);
        continue;
      }

      if (fonts.some(f => f.name.toLowerCase() === file.name.toLowerCase())) {
        duplicateFiles.push(file.name);
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        newFonts.push({
          id: `font-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          data: new Uint8Array(arrayBuffer),
          type: file.type || `font/${getFileExtension(file.name)}`,
          size: file.size,
        });
      } catch (err) {
        console.error(`Failed to read font file ${file.name}:`, err);
      }
    }

    if (unsupportedFiles.length > 0) {
      toast({
        title: 'Unsupported file types',
        description: `The following files were not loaded (only ttf, woff, woff2, eot supported): ${unsupportedFiles.join(', ')}`,
        variant: 'destructive',
      });
    }

    if (duplicateFiles.length > 0) {
      toast({
        title: 'Duplicate fonts skipped',
        description: `The following fonts already exist: ${duplicateFiles.join(', ')}`,
      });
    }

    if (newFonts.length > 0) {
      onFontsChange([...fonts, ...newFonts]);
      toast({
        title: 'Fonts uploaded',
        description: `Added ${newFonts.length} font file(s)`,
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [fonts, onFontsChange, toast]);

  const handleDeleteFont = useCallback((fontId: string) => {
    setFontToDelete(fontId);
    setDeleteConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!fontToDelete) return;
    
    const fontName = fonts.find(f => f.id === fontToDelete)?.name;
    onFontsChange(fonts.filter(f => f.id !== fontToDelete));
    
    toast({
      title: 'Font deleted',
      description: `Removed ${fontName}`,
    });
    
    setDeleteConfirmOpen(false);
    setFontToDelete(null);
  }, [fontToDelete, fonts, onFontsChange, toast]);

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Custom Fonts</h2>
          <p className="text-sm text-muted-foreground">
            Upload custom font files (ttf, woff, woff2, eot) for use in your theme
          </p>
        </div>
        <Button onClick={handleUploadClick} data-testid="button-upload-fonts">
          <Upload className="h-4 w-4 mr-2" />
          Upload Fonts
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.woff,.woff2,.eot"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          data-testid="input-font-upload"
        />
      </div>

      {fonts.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg">
          <div className="text-center p-8">
            <FileType className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No fonts uploaded</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload custom font files to include them in your theme export
            </p>
            <Button variant="outline" onClick={handleUploadClick}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Fonts
            </Button>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1 border rounded-lg">
          <div className="p-4 space-y-2">
            {fonts.map((font) => (
              <div 
                key={font.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover-elevate"
                data-testid={`font-item-${font.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-background flex items-center justify-center border">
                    <FileType className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{font.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getFontTypeLabel(font.name)} • {formatFileSize(font.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteFont(font.id)}
                  className="text-destructive hover:text-destructive"
                  data-testid={`button-delete-font-${font.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {fonts.length > 0 && (
        <div className="mt-4 border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-2 bg-muted/50 border-b">
            <span className="text-sm font-medium">Generated @font-face CSS</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCss}
              data-testid="button-copy-font-css"
            >
              {copiedCss ? (
                <Check className="h-4 w-4 mr-1" />
              ) : (
                <Copy className="h-4 w-4 mr-1" />
              )}
              {copiedCss ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <pre className="p-3 text-xs overflow-auto max-h-48 bg-background">
            <code>{generatedCss}</code>
          </pre>
        </div>
      )}

      <div className="mt-4 p-3 bg-muted/30 rounded-lg flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          {fonts.length > 0 
            ? <>The @font-face CSS above will be included in your exported theme. Fonts are placed in the <code className="bg-muted px-1 rounded">fonts/</code> folder.</>
            : <>Upload custom font files to include them in your theme export. @font-face rules will be generated automatically.</>
          }
        </p>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Font</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this font? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFontToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CustomFontsManager;
