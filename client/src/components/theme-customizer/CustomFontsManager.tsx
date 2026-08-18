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
  /**
   * For fonts that came from a legacy theme's `fonts/` folder, the
   * relative path inside that folder (e.g. `founders-grotesk/regular.woff2`).
   * On export, customFonts are written to `fonts/<originalPath>` if set,
   * otherwise to `fonts/<name>`. Preserves subfolder structures the
   * theme's @font-face declarations may reference.
   */
  originalPath?: string;
  /**
   * Theme-authored @font-face overrides. When the source theme's
   * `theme.scss` already declared this font (family/weight/style), the
   * importer records them here so we emit the *same* declaration on
   * preview and export instead of reverse-engineering it from the
   * filename. Filename-derived guesses go wrong when the theme picks
   * an arbitrary family name — most commonly variable fonts whose
   * filenames encode axis tags like `YTLC,opsz,wdth,wght` and whose
   * declared family name doesn't map back cleanly.
   */
  family?: string;
  weight?: string;
  style?: string;
}

interface CustomFontsManagerProps {
  fonts: FontFile[];
  onFontsChange: (fonts: FontFile[]) => void;
  onFontCssChange?: (css: string) => void; // Callback to update font-face CSS
}

const SUPPORTED_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2', 'eot'];

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
    case 'otf': return 'OpenType';
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
    case 'otf': return 'opentype';
    case 'woff': return 'woff';
    case 'woff2': return 'woff2';
    case 'eot': return 'embedded-opentype';
    default: return ext;
  }
}

// Ordered from most specific to least so "semibold" is matched before "bold".
const WEIGHT_MAP: { pattern: RegExp; weight: string }[] = [
  { pattern: /thin|hairline|100/i,                   weight: '100' },
  { pattern: /extralight|extra[-_]?light|200/i,      weight: '200' },
  { pattern: /light|300/i,                           weight: '300' },
  { pattern: /regular|normal|400/i,                  weight: '400' },
  { pattern: /medium|500/i,                          weight: '500' },
  { pattern: /semibold|semi[-_]?bold|demi|600/i,     weight: '600' },
  { pattern: /extrabold|extra[-_]?bold|800/i,        weight: '800' },
  { pattern: /black|heavy|900/i,                     weight: '900' },
  { pattern: /bold|700/i,                            weight: '700' },
];

interface FontFaceAttrs {
  family: string;
  weight: string;
  style: string;
}

// OpenType variable-font axis indicators that show up in Google Fonts
// filenames like "PlusJakartaSans-VariableFont_wght.woff2" — they describe
// which axes the font supports, not the typeface name, so they get stripped.
const VARIABLE_FONT_NOISE = /^(VariableFont|wght|wdth|slnt|opsz|ital|GRAD|XOPQ|YOPQ|XTRA|YTAS|YTDE|YTLC|YTUC)$/i;

/**
 * Split a CamelCase / PascalCase string into separate words.
 * "PlusJakartaSans" → ["Plus", "Jakarta", "Sans"]
 * "OpenSans"        → ["Open", "Sans"]
 * Already-spaced or all-lowercase tokens pass through unchanged.
 */
function splitCamelCase(token: string): string[] {
  // Insert a space between a lowercase→uppercase boundary, then between
  // an uppercase run and a following uppercase+lowercase (e.g. "ABCDef" →
  // "ABC Def"). Then split on whitespace.
  return token
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
}

function parseFontAttrs(filename: string): FontFaceAttrs {
  const nameWithoutExt = filename.replace(/\.(ttf|woff|woff2|eot)$/i, '');
  // Split on delimiters (hyphen, underscore, space), then break each
  // resulting token on CamelCase boundaries. So "PlusJakartaSans-VariableFont_wght-italic"
  // becomes ["Plus","Jakarta","Sans","Variable","Font","wght","italic"].
  const tokens = nameWithoutExt
    .split(/[-_ ]+/)
    .flatMap(splitCamelCase);

  const styleTokens = new Set<number>();
  let weight = '400';
  let style = 'normal';

  // Detect italic/oblique first (these are whole tokens)
  tokens.forEach((t, i) => {
    if (/^italic$/i.test(t)) { style = 'italic'; styleTokens.add(i); }
    else if (/^oblique$/i.test(t)) { style = 'oblique'; styleTokens.add(i); }
  });

  // Strip variable-font axis indicators ("VariableFont", "wght", …) — these
  // describe the file format, not the typeface, and would otherwise leak
  // into the family name. "Variable" + "Font" arrive as separate tokens
  // after CamelCase splitting, so check both forms.
  tokens.forEach((t, i) => {
    if (VARIABLE_FONT_NOISE.test(t)) styleTokens.add(i);
    if (/^Variable$/i.test(t) && /^Font$/i.test(tokens[i + 1] || '')) {
      styleTokens.add(i);
      styleTokens.add(i + 1);
    }
  });

  // Detect weight — scan the full name so compound tokens like "SemiBold" work
  for (const { pattern, weight: w } of WEIGHT_MAP) {
    if (pattern.test(nameWithoutExt)) {
      weight = w;
      // Mark the token(s) that carry the weight keyword so we can strip them
      tokens.forEach((t, i) => { if (pattern.test(t)) styleTokens.add(i); });
      break;
    }
  }

  const remainingTokens = tokens.filter((_, i) => !styleTokens.has(i));

  // Preserve the filename's separator style. CSS font-family names treat
  // hyphens and spaces as DIFFERENT characters (case is ignored, but
  // separators are not), so a CSS rule like
  //   font-family: "founders-grotesk-web"
  // won't match a @font-face declared as `'Founders Grotesk Web'`.
  // Heuristic: if the filename is all-lowercase (typical for kebab-case
  // foundry exports like `founders-grotesk-web-regular.woff2`), join the
  // family tokens with hyphens and keep them lowercase. Otherwise — for
  // CamelCase filenames typical of Google Fonts (`OpenSans-Regular.ttf`,
  // `PlusJakartaSans-VariableFont_wght.woff2`) — join with spaces and
  // Title Case each word, since those CSS values use Title Case + spaces.
  const isKebabCaseFilename = !/[A-Z]/.test(nameWithoutExt);
  const familyTokens = isKebabCaseFilename
    ? remainingTokens.map(t => t.toLowerCase())
    : remainingTokens.map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

  const family =
    familyTokens.length === 0
      ? nameWithoutExt
      : isKebabCaseFilename
        ? familyTokens.join('-')
        : familyTokens.join(' ');
  return { family, weight, style };
}

/**
 * Generate @font-face CSS for export (uses relative paths to fonts/ folder)
 */
export function generateFontFaceCssForExport(fonts: FontFile[]): string {
  if (fonts.length === 0) return '';

  const rules = fonts.map(font => {
    const parsed = parseFontAttrs(font.name);
    const family = font.family ?? parsed.family;
    const weight = font.weight ?? parsed.weight;
    const style = font.style ?? parsed.style;
    const format = getFontFormat(font.name);
    // Use originalPath (e.g. `founders-grotesk/regular.woff2`) when set,
    // so the URL matches where the export actually writes the file. Falls
    // back to the bare filename for newly-uploaded fonts.
    const urlPath = font.originalPath || font.name;

    return `@font-face {
  font-family: '${family}';
  src: url('../fonts/${urlPath}') format('${format}');
  font-weight: ${weight};
  font-style: ${style};
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

    const parsed = parseFontAttrs(font.name);
    const family = font.family ?? parsed.family;
    const weight = font.weight ?? parsed.weight;
    const style = font.style ?? parsed.style;
    const format = getFontFormat(font.name);

    return `@font-face {
  font-family: '${family}';
  src: url('${font.blobUrl}') format('${format}');
  font-weight: ${weight};
  font-style: ${style};
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
            ? <>The @font-face CSS above will be included in your exported theme. Fonts are placed in the <code className="bg-muted px-1 rounded">css/fonts/</code> folder.</>
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
