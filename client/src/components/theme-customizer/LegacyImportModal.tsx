import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileArchive, FolderOpen, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import { parseMappingCsv, parseScssFile, applyMapping, ParsedScssVariables, convertScssVariablesToCss } from '@/lib/legacy-import';
import {
  isNotSetSentinel,
  resolveVariableReference,
  wrapScssArithmeticInCalc,
} from '@/lib/legacy-import-utils';

export interface PreservedFolders {
  charts: Map<string, Uint8Array>;
  fonts: Map<string, Uint8Array>;
}

export interface CustomScssFile {
  id: string;
  name: string;
  content: string;
  fromFontsFolder?: boolean;
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

export interface ImportedGraphicFile {
  id: string;
  name: string; // path inside gfx/, e.g. "logo.svg" or "icons/star.svg"
  data: Uint8Array;
  type: string;
  size: number;
}

export interface ImportedJsFile {
  id: string;
  name: string; // path inside js/, e.g. "main.js" or "utils/helpers.js"
  content: string;
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
  graphicFiles: ImportedGraphicFile[];
  jsFiles: ImportedJsFile[];
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

      // Themes occasionally redeclare the same variable in two files —
      // notably BRK has `$header-background-color` in both
      // `_header.scss` (the component's local file) and
      // `_overwritable-variables.scss` (the theme's central override
      // sheet). Convention: the overwritable file always wins. JSZip
      // doesn't guarantee iteration order, so we collect files into two
      // buckets and merge the overwritable bucket LAST so its values
      // overwrite any duplicates from component-level files.
      const overwritablePathRe = /(^|\/)_*overwritable[-_]variables\.scss$/i;
      const variableFiles: Array<{ path: string; entry: JSZip.JSZipObject }> = [];
      const overwritableFiles: Array<{ path: string; entry: JSZip.JSZipObject }> = [];

      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;

        const relativePath = rootPrefix ? path.replace(rootPrefix, '') : path;
        const lowerRelativePath = relativePath.toLowerCase();

        if (lowerRelativePath.startsWith('css/variables/') && lowerRelativePath.endsWith('.scss')) {
          if (overwritablePathRe.test(lowerRelativePath)) {
            overwritableFiles.push({ path: relativePath, entry: zipEntry });
          } else {
            variableFiles.push({ path: relativePath, entry: zipEntry });
          }
        }
      }

      // Pass 1: component-level / partial variable files.
      for (const { entry } of variableFiles) {
        const content = await entry.async('string');
        Object.assign(scssVariables, parseScssFile(content));
        scssFilesProcessed++;
      }
      // Pass 2: overwritable-variables wins on key collision.
      for (const { entry } of overwritableFiles) {
        const content = await entry.async('string');
        Object.assign(scssVariables, parseScssFile(content));
        scssFilesProcessed++;
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
      };
      
      // Supported font extensions for Custom Fonts tab
      const SUPPORTED_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2', 'eot'];
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
          'otf': 'font/otf',
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
        }
        // Note: legacy `release/` folder is intentionally skipped — V6
        // doesn't ship per-theme releases anymore, so we drop it on
        // import rather than carrying it forward to the export.
      }

      // Pull `gfx/` and `assets/` into a dedicated graphic-files list so
      // the Custom Graphics tab can manage them. Both folder names are
      // common in the legacy themes; we treat them identically and
      // preserve each file's original sub-path in `name` so the export
      // round-trips. (Files from `assets/` are namespaced under
      // `assets/` in the resulting graphic name, so they don't collide
      // with same-named files from `gfx/`.)
      const graphicFiles: ImportedGraphicFile[] = [];
      let graphicFileId = 1;
      const GRAPHIC_PREFIXES = ['gfx/', 'assets/'];
      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        const relativePath = rootPrefix ? path.replace(rootPrefix, '') : path;
        const lowerPath = relativePath.toLowerCase();
        const matchedPrefix = GRAPHIC_PREFIXES.find((p) => lowerPath.startsWith(p));
        if (!matchedPrefix) continue;
        const data = await zipEntry.async('uint8array');
        // Strip the matched prefix; keep the rest as-is. For assets/
        // files, prefix the stored name with `assets/` so the export
        // writes them back under their original folder name and they
        // never collide with `gfx/` siblings of the same basename.
        const innerPath = relativePath.slice(
          relativePath.toLowerCase().indexOf(matchedPrefix) + matchedPrefix.length,
        );
        if (!innerPath) continue;
        const storedName = matchedPrefix === 'assets/' ? `assets/${innerPath}` : innerPath;
        const ext = innerPath.split('.').pop()?.toLowerCase() || '';
        const mimeMap: Record<string, string> = {
          svg: 'image/svg+xml',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          gif: 'image/gif',
          webp: 'image/webp',
          avif: 'image/avif',
          ico: 'image/x-icon',
        };
        graphicFiles.push({
          id: `imported-gfx-${graphicFileId++}`,
          name: storedName,
          data,
          type: mimeMap[ext] || 'application/octet-stream',
          size: data.length,
        });
      }

      setStatusMessage('Extracting custom SCSS files...');
      setProgress(88);
      
      // Helper to convert SCSS font URLs to blob URLs. Handles two
      // patterns commonly seen in legacy themes:
      //   1. `url($font_route + 'path/to/font.ext')` — V5 helper variable
      //   2. `url('../fonts/path/to/font.ext')` — raw relative paths
      // For both, we extract the part after the `fonts/` segment, look it
      // up in the blob URL map, and substitute. Anything that doesn't
      // resolve is left untouched.
      const convertFontUrls = (content: string): string => {
        // Pattern 1: $font_route helper
        content = content.replace(
          /url\s*\(\s*\$font[-_]route\s*\+\s*['"]([^'"]+)['"]\s*\)/gi,
          (match, fontPath) => {
            const normalizedPath = fontPath.toLowerCase().replace(/^\/+/, '');
            const blobUrl = fontBlobUrls.get(normalizedPath);
            if (blobUrl) return `url('${blobUrl}')`;
            console.warn(`Font not found for path: ${fontPath}`);
            return match;
          }
        );
        // Pattern 2: any url(...) whose path contains a `fonts/` segment.
        // Matches `url('../fonts/foo.woff2')`, `url("fonts/sub/foo.ttf")`,
        // even `url(../../fonts/foo.eot)` (unquoted). The blob URL map is
        // keyed by the path *after* `fonts/`, so we strip the prefix.
        content = content.replace(
          /url\s*\(\s*['"]?([^'")]*?fonts\/[^'")]+)['"]?\s*\)/gi,
          (match, fontPath) => {
            const idx = fontPath.toLowerCase().lastIndexOf('fonts/');
            if (idx < 0) return match;
            const subPath = fontPath.slice(idx + 'fonts/'.length).toLowerCase().replace(/^\/+/, '');
            const blobUrl = fontBlobUrls.get(subPath);
            if (blobUrl) return `url('${blobUrl}')`;
            return match;
          }
        );
        return content;
      };

      const customScssFiles: CustomScssFile[] = [];
      let customFileId = 1;
      const jsFiles: ImportedJsFile[] = [];
      let jsFileId = 1;

      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;

        const relativePath = rootPrefix ? path.replace(rootPrefix, '') : path;
        const lowerRelativePath = relativePath.toLowerCase();

        // Look for files in css/custom/ or css/fonts/ folders
        const isCustomScss = lowerRelativePath.startsWith('css/custom/') && lowerRelativePath.endsWith('.scss');
        const isFontsScss = lowerRelativePath.startsWith('css/fonts/') && lowerRelativePath.endsWith('.scss');
        // Custom JS lives in a top-level js/ folder. Skip the .min.js
        // bundles a few legacy themes ship alongside their source — those
        // are derived artifacts, not editable source the user should
        // round-trip through the customizer.
        const isCustomJs =
          lowerRelativePath.startsWith('js/') &&
          lowerRelativePath.endsWith('.js') &&
          !lowerRelativePath.endsWith('.min.js');

        if (isCustomScss || isFontsScss) {
          let content = await zipEntry.async('string');

          // Convert SCSS variables using 3-tier resolution:
          // 1. Mapped variables -> var(--css-var)
          // 2. Unmapped but defined in zip -> literal value
          // 3. Unknown -> leave as-is
          content = convertScssVariablesToCss(content, mappings, scssVariables);

          // Treat any custom SCSS that defines a @font-face the same as a
          // dedicated css/fonts/ file: rewrite its font URLs to blob URLs
          // and mark it so the consumer enables it by default. Some
          // themes (e.g. RIG-v5) keep @font-face in css/custom/_fonts.scss
          // instead of in a css/fonts/ folder.
          const hasFontFace = /@font-face\s*\{/i.test(content);
          if (isFontsScss || hasFontFace) {
            content = convertFontUrls(content);
          }

          // Extract filename from path
          const pathParts = relativePath.split('/');
          const filename = pathParts[pathParts.length - 1];

          customScssFiles.push({
            id: `imported-${customFileId++}`,
            name: filename,
            content: content,
            fromFontsFolder: isFontsScss || hasFontFace,
          });
        } else if (isCustomJs) {
          const content = await zipEntry.async('string');
          // Preserve the path inside js/ so subfolders survive the
          // round-trip (e.g. `vendor/foo.js` keeps that prefix).
          const insideJs = relativePath.replace(/^js\//i, '');
          jsFiles.push({
            id: `imported-js-${jsFileId++}`,
            name: insideJs,
            content,
          });
        }
      }

      // V5 sized the .logo img via SCSS variables ($logo-width and friends).
      // V6 doesn't have those variables — the framework's logo rule is just
      // `.logo img { width: 100%; height: auto }` and the CMS controls the
      // size from there. To preserve the V5 visual on activation, emit a
      // small CSS file with the resolved logo dimensions baked in. The CMS
      // can still override via inline styles or its own image controls, and
      // the user can disable / edit the file in the Custom CSS tab.
      const resolveLogoValue = (varName: string): string | null => {
        const raw = scssVariables[varName];
        if (!raw || isNotSetSentinel(raw)) return null;
        const resolved = resolveVariableReference(raw, scssVariables);
        if (isNotSetSentinel(resolved)) return null;
        // SCSS arithmetic like `$logo-width * 0.5` resolves to a string
        // like `160px * 0.5` after substitution — wrap so the export
        // produces valid CSS calc().
        return wrapScssArithmeticInCalc(resolved.trim());
      };
      const logoWidth = resolveLogoValue('$logo-width');
      const logoWidthTablet = resolveLogoValue('$logo-width-tablet');
      const logoWidthMobile = resolveLogoValue('$logo-width-mobile');
      const logoHeight = resolveLogoValue('$logo-height');
      const logoHeightTablet = resolveLogoValue('$logo-height-tablet');
      const logoHeightMobile = resolveLogoValue('$logo-height-mobile');
      if (
        logoWidth ||
        logoWidthTablet ||
        logoWidthMobile ||
        logoHeight ||
        logoHeightTablet ||
        logoHeightMobile
      ) {
        const indent = (s: string) => `  ${s}`;
        const lines: string[] = [
          '/*',
          ' * Logo dimensions imported from V5.',
          ' * V6 has no logo-size variables — the CMS controls the logo image size.',
          ' * These rules preserve the V5 visual when the theme is activated; the CMS',
          ' * (or any later override in this file or another custom stylesheet) can',
          ' * still override them. Disable in the Custom CSS tab if not needed.',
          ' */',
          '',
        ];

        const desktop: string[] = [];
        if (logoWidth) desktop.push(`max-width: ${logoWidth};`);
        if (logoHeight) desktop.push(`max-height: ${logoHeight};`);
        if (desktop.length > 0) {
          lines.push('.logo img {');
          desktop.forEach((d) => lines.push(indent(d)));
          lines.push('}');
          lines.push('');
        }

        const tablet: string[] = [];
        if (logoWidthTablet) tablet.push(`max-width: ${logoWidthTablet};`);
        if (logoHeightTablet) tablet.push(`max-height: ${logoHeightTablet};`);
        if (tablet.length > 0) {
          lines.push('@media (min-width: 768px) and (max-width: 991px) {');
          lines.push('  .logo img {');
          tablet.forEach((d) => lines.push(`    ${d}`));
          lines.push('  }');
          lines.push('}');
          lines.push('');
        }

        const mobile: string[] = [];
        if (logoWidthMobile) mobile.push(`max-width: ${logoWidthMobile};`);
        if (logoHeightMobile) mobile.push(`max-height: ${logoHeightMobile};`);
        if (mobile.length > 0) {
          lines.push('@media (max-width: 767px) {');
          lines.push('  .logo img {');
          mobile.forEach((d) => lines.push(`    ${d}`));
          lines.push('  }');
          lines.push('}');
          lines.push('');
        }

        customScssFiles.push({
          id: `imported-logo-widths`,
          name: '_logo-widths.scss',
          content: lines.join('\n'),
          // Reuse the "enabled by default" hint that the consumer maps
          // from `fromFontsFolder`. This file holds rendering rules the
          // converted theme actually needs to look right on first load.
          fromFontsFolder: true,
        });
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
        fontFiles,
        graphicFiles,
        jsFiles,
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
                Optional: charts/, fonts/, gfx/
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
                    <span className="text-muted-foreground">Custom JS files:</span>
                    <span className="font-medium">{importResult.jsFiles.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Font files:</span>
                    <span className="font-medium">{importResult.fontFiles.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Graphic files:</span>
                    <span className="font-medium">{importResult.graphicFiles.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preserved files:</span>
                    <span className="font-medium">
                      {importResult.preservedFolders.charts.size +
                       importResult.preservedFolders.fonts.size}
                    </span>
                  </div>
                </div>
              </ScrollArea>
            </div>

            <p className="text-sm text-muted-foreground">
              This will update the theme variables with values from your legacy theme.
              The styles.xml will be loaded into the CSS classes tab.
              Font files will be added to the Custom Fonts tab.
              Graphics from gfx/ will be added to the Custom Graphics tab.
              Charts will be included in the export.
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
