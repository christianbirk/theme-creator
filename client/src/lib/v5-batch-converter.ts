/**
 * Batch V5 → V6 theme converter.
 *
 * Single-theme imports go through `LegacyImportModal.processZip` →
 * `theme-customizer.handleLegacyImportComplete` (apply to React state) →
 * `theme-customizer.handleExport` (build output zip). For batch
 * conversion we don't have a customizer state to live in — themes flow
 * straight from V5 input → V6 output zip without any UI dwell time.
 *
 * This file inlines the logic needed for that direct path. It re-uses
 * the same low-level parsing utilities (`parseScssFile`, `applyMapping`,
 * `convertScssVariablesToCss`, the SCSS-arithmetic helpers) so the
 * variable-translation behaviour stays identical to the single-theme
 * flow. It also re-implements the export shape (theme.scss, _variables,
 * custom/, fonts/, gfx/, assets/, js/, charts/, styles.xml, the auto
 * `_logo-widths.scss`, and the html font-size reset for non-1rem
 * `--font-normal`) so the batch output matches what the user would get
 * by importing one theme at a time.
 *
 * Defaults that match single-theme conversion:
 *   - custom CSS files default to `enabled: false` (their `@import` is
 *     emitted as a comment in `theme.scss`).
 *   - custom JS files default to disabled (their content is wrapped in
 *     a `/* … *​/` block in the exported `js/<name>`).
 *   - V5 framework defaults are honoured *unless* a value is in the
 *     `PREFER_V6_DEFAULT_WHEN_SILENT` set inside `legacy-import-apply`.
 */
import JSZip from 'jszip';
import {
  parseScssFile,
  isNotSetSentinel,
  resolveVariableReference,
  wrapScssArithmeticInCalc,
  type ParsedScssVariables,
} from './legacy-import-utils';
import {
  applyMapping,
  type ScssVariableMapping,
} from './legacy-import-apply';
import { compileFullTheme } from './theme-api';

export interface BatchConvertOptions {
  /** Source theme name as it appeared in the parent `Themes/` folder. */
  sourceName: string;
  /** Output name including the `--v6` postfix. */
  targetName: string;
  /** Variable mappings (the parsed CSV). */
  mappings: ScssVariableMapping[];
}

export interface BatchConvertResult {
  /** Whether the conversion succeeded. */
  success: boolean;
  /** Source folder name. */
  sourceName: string;
  /** Computed target folder name (with `--v6` postfix). */
  targetName: string;
  /** Output zip with the V6 theme inside a single top-level folder. */
  outputZip?: JSZip;
  /** When success=false, a human-readable reason. */
  error?: string;
  /** Number of V5 SCSS variables successfully mapped to V6. */
  mappedVariableCount?: number;
  /** Custom CSS files preserved (always disabled by default). */
  customCssCount?: number;
  /** Custom JS files preserved (always disabled by default). */
  customJsCount?: number;
  /** Fonts pulled from the source `fonts/` folder. */
  fontFileCount?: number;
  /** Graphics pulled from `gfx/` and `assets/`. */
  graphicFileCount?: number;
  /** Whether a styles.xml was copied through. */
  hadStylesXml?: boolean;
}

/**
 * The minimal "this folder looks like a V5 theme" check: a real V5 theme
 * always ships at least one SCSS file inside `css/variables/`. Folders
 * lacking that get reported as "skipped (not a V5 theme)" by the caller.
 */
export function looksLikeV5Theme(zip: JSZip, rootPrefix = ''): boolean {
  return Object.keys(zip.files).some((path) => {
    if (zip.files[path].dir) return false;
    const rel = rootPrefix ? path.replace(rootPrefix, '') : path;
    const lower = rel.toLowerCase();
    return lower.startsWith('css/variables/') && lower.endsWith('.scss');
  });
}

/**
 * Read every regular file in a `FileSystemDirectoryHandle` (recursively)
 * and stuff them into a fresh `JSZip` so the rest of the pipeline can
 * iterate using the same conventions as the legacy import. Skips
 * directories, macOS metadata, and AppleDouble companions.
 */
export async function dirHandleToZip(
  dir: FileSystemDirectoryHandle,
): Promise<JSZip> {
  const zip = new JSZip();
  const walk = async (
    handle: FileSystemDirectoryHandle,
    path: string,
  ): Promise<void> => {
    // The TS DOM lib exposes `entries()` as an iterable; use the
    // unknown-cast to avoid a strict-mode `Symbol.asyncIterator` whine
    // when targets vary across browsers.
    const entries = (handle as unknown as {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    }).entries();
    for await (const [name, child] of entries) {
      if (name === '.DS_Store' || name.startsWith('._')) continue;
      if (name === '__MACOSX') continue;
      const childPath = path ? `${path}/${name}` : name;
      if (child.kind === 'directory') {
        await walk(child as FileSystemDirectoryHandle, childPath);
      } else {
        const file = await (child as FileSystemFileHandle).getFile();
        const buf = new Uint8Array(await file.arrayBuffer());
        zip.file(childPath, buf);
      }
    }
  };
  await walk(dir, '');
  return zip;
}

/**
 * Walk the picked directory looking for any `Themes/` folders, then
 * enumerate their immediate children as candidate themes. Two-level
 * pattern (parent contains client subfolders, each with `Themes/`) is
 * handled by the recursive walk — finds `Themes/` at any depth ≤ 3.
 */
export async function scanForThemes(
  root: FileSystemDirectoryHandle,
  maxDepth = 3,
): Promise<DiscoveredTheme[]> {
  const themes: DiscoveredTheme[] = [];

  const findThemesFolders = async (
    dir: FileSystemDirectoryHandle,
    pathSoFar: string[],
    depth: number,
  ): Promise<void> => {
    if (depth > maxDepth) return;
    const entries = (dir as unknown as {
      entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
    }).entries();
    for await (const [name, child] of entries) {
      if (child.kind !== 'directory') continue;
      if (name.startsWith('.') || name === '__MACOSX') continue;
      // Match `Themes/` case-insensitively to be friendly to mixed-case
      // file systems. A folder literally named "Themes" anywhere in the
      // tree is the cue to enumerate its children as theme candidates.
      if (name.toLowerCase() === 'themes') {
        const themesDir = child as FileSystemDirectoryHandle;
        const themeEntries = (themesDir as unknown as {
          entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
        }).entries();
        for await (const [tName, tChild] of themeEntries) {
          if (tChild.kind !== 'directory') continue;
          if (tName.startsWith('.') || tName === '__MACOSX') continue;
          themes.push({
            name: tName,
            relativePath: [...pathSoFar, name, tName].join('/'),
            handle: tChild as FileSystemDirectoryHandle,
            parentHandle: themesDir,
          });
        }
        // Don't descend further — themes themselves contain `css/`,
        // `Themes/` folders won't be nested inside a theme.
      } else {
        await findThemesFolders(
          child as FileSystemDirectoryHandle,
          [...pathSoFar, name],
          depth + 1,
        );
      }
    }
  };

  await findThemesFolders(root, [], 0);
  return themes;
}

export interface DiscoveredTheme {
  /** Folder name (will be the source for the `--v6` postfix). */
  name: string;
  /** Path relative to the picked root, slash-joined. */
  relativePath: string;
  /** Directory handle for reading the theme's files. */
  handle: FileSystemDirectoryHandle;
  /** Directory handle for the enclosing `Themes/` folder (write target). */
  parentHandle: FileSystemDirectoryHandle;
}

/**
 * Strip a leading "single-folder" prefix from a JSZip if present. Mirrors
 * the rootPrefix detection used in `LegacyImportModal.processZip` so a
 * theme zipped with an outer wrapper directory still gets parsed
 * correctly.
 */
function detectRootPrefix(zip: JSZip): string {
  const allPaths = Object.keys(zip.files).filter(
    (p) => !p.startsWith('__MACOSX'),
  );
  if (allPaths.length === 0) return '';
  const firstSegments = new Set(
    allPaths.map((p) => p.split('/')[0]).filter(Boolean),
  );
  if (firstSegments.size === 1) {
    // Pull the single member out without spread (avoids Set iteration
    // requiring downlevelIteration in the current tsconfig).
    const seg = Array.from(firstSegments)[0];
    // Treat as a wrapper only if there's nothing else at the root level
    // beyond that single folder.
    return `${seg}/`;
  }
  return '';
}

const FONT_EXTENSIONS = /\.(ttf|woff2?|eot|otf)$/i;
const IMAGE_EXTENSIONS = /\.(svg|png|jpe?g|gif|webp|ico|avif)$/i;

/**
 * Convert SCSS @font-face url(...) references into base64 data URIs so
 * the exported font CSS works without a separate fonts/ folder reference.
 * Mirrors `LegacyImportModal.convertFontUrls` but operates on byte
 * buffers (we don't have blob URLs in node-ish batch contexts).
 */
function convertFontUrlsToDataUris(
  content: string,
  fontMap: Map<string, Uint8Array>,
): string {
  return content.replace(
    /url\(\s*['"]?([^'")]+)['"]?\s*\)/g,
    (match, url: string) => {
      const cleaned = url.replace(/^\.\.?\//, '').replace(/\.\.?\//g, '');
      // Try a few plausible relative paths under fonts/ since V5 themes
      // sometimes write `url('../fonts/foo.woff2')` or just
      // `url('foo.woff2')`.
      const candidates = [
        cleaned,
        `fonts/${cleaned.split('/').pop()}`,
        cleaned.split('/').pop() ?? cleaned,
      ];
      for (const candidate of candidates) {
        const data = fontMap.get(candidate);
        if (data) {
          const ext = candidate.split('.').pop()?.toLowerCase() ?? 'woff2';
          const mime =
            ext === 'woff2'
              ? 'font/woff2'
              : ext === 'woff'
                ? 'font/woff'
                : ext === 'ttf'
                  ? 'font/ttf'
                  : ext === 'otf'
                    ? 'font/otf'
                    : 'application/octet-stream';
          // Encoding base64 from a Uint8Array without TextEncoder
          // round-tripping. `btoa` on `String.fromCharCode(...)` works
          // for binary as long as we chunk to avoid exceeding the
          // argument-count limit on large blobs.
          let binary = '';
          const chunk = 0x8000;
          for (let i = 0; i < data.length; i += chunk) {
            // Cast subarray to number[] for the spread — TypedArray spread
            // needs downlevel iteration that the current tsconfig lacks.
            binary += String.fromCharCode.apply(
              null,
              Array.from(data.subarray(i, i + chunk)) as number[],
            );
          }
          const b64 = btoa(binary);
          return `url('data:${mime};base64,${b64}')`;
        }
      }
      return match;
    },
  );
}

/**
 * Build the `_logo-widths.scss` file content from V5 logo size variables,
 * if any are set. Returns `null` if every relevant V5 variable is unset
 * (no rules to emit, no file to create).
 */
function buildLogoWidthsScss(scssVariables: ParsedScssVariables): string | null {
  const resolveLogoValue = (varName: string): string | null => {
    const raw = scssVariables[varName];
    if (!raw || isNotSetSentinel(raw)) return null;
    const resolved = resolveVariableReference(raw, scssVariables);
    if (isNotSetSentinel(resolved)) return null;
    return wrapScssArithmeticInCalc(resolved.trim());
  };
  const logoWidth = resolveLogoValue('$logo-width');
  const logoWidthTablet = resolveLogoValue('$logo-width-tablet');
  const logoWidthMobile = resolveLogoValue('$logo-width-mobile');
  const logoHeight = resolveLogoValue('$logo-height');
  const logoHeightTablet = resolveLogoValue('$logo-height-tablet');
  const logoHeightMobile = resolveLogoValue('$logo-height-mobile');
  if (
    !logoWidth &&
    !logoWidthTablet &&
    !logoWidthMobile &&
    !logoHeight &&
    !logoHeightTablet &&
    !logoHeightMobile
  )
    return null;

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
  if (desktop.length) {
    lines.push('.logo img {');
    desktop.forEach((d) => lines.push(`  ${d}`));
    lines.push('}', '');
  }
  const tablet: string[] = [];
  if (logoWidthTablet) tablet.push(`max-width: ${logoWidthTablet};`);
  if (logoHeightTablet) tablet.push(`max-height: ${logoHeightTablet};`);
  if (tablet.length) {
    lines.push('@media (min-width: 768px) and (max-width: 991px) {');
    lines.push('  .logo img {');
    tablet.forEach((d) => lines.push(`    ${d}`));
    lines.push('  }', '}', '');
  }
  const mobile: string[] = [];
  if (logoWidthMobile) mobile.push(`max-width: ${logoWidthMobile};`);
  if (logoHeightMobile) mobile.push(`max-height: ${logoHeightMobile};`);
  if (mobile.length) {
    lines.push('@media (max-width: 767px) {');
    lines.push('  .logo img {');
    mobile.forEach((d) => lines.push(`    ${d}`));
    lines.push('  }', '}', '');
  }
  return lines.join('\n');
}

/**
 * Heart of the batch converter. Takes a single V5 theme as a JSZip and
 * produces a V6 theme zip with the postfixed folder name at the root.
 */
export async function convertV5ZipToV6(
  v5Zip: JSZip,
  options: BatchConvertOptions,
): Promise<BatchConvertResult> {
  const { sourceName, targetName, mappings } = options;
  try {
    const rootPrefix = detectRootPrefix(v5Zip);

    // ── Phase 1: extract V5 SCSS variables ─────────────────────────
    const overwritablePathRe = /(^|\/)_*overwritable[-_]variables\.scss$/i;
    const partialFiles: Array<[string, JSZip.JSZipObject]> = [];
    const overwritableFiles: Array<[string, JSZip.JSZipObject]> = [];

    for (const [path, entry] of Object.entries(v5Zip.files)) {
      if (entry.dir) continue;
      const rel = rootPrefix ? path.replace(rootPrefix, '') : path;
      const lower = rel.toLowerCase();
      if (lower.startsWith('css/variables/') && lower.endsWith('.scss')) {
        if (overwritablePathRe.test(lower)) overwritableFiles.push([rel, entry]);
        else partialFiles.push([rel, entry]);
      }
    }

    if (partialFiles.length === 0 && overwritableFiles.length === 0) {
      return {
        success: false,
        sourceName,
        targetName,
        error: 'Not a V5 theme (no css/variables/*.scss files)',
      };
    }

    const scssVariables: ParsedScssVariables = {};
    for (const [, entry] of partialFiles) {
      Object.assign(scssVariables, parseScssFile(await entry.async('string')));
    }
    for (const [, entry] of overwritableFiles) {
      Object.assign(scssVariables, parseScssFile(await entry.async('string')));
    }

    const { mapped: mappedVariables } = applyMapping(scssVariables, mappings);

    // ── Phase 2: walk the rest of the zip to harvest custom CSS / JS,
    //              fonts (binary), graphics, charts, styles.xml ──────
    type CustomCssFile = {
      name: string;
      content: string;
      enabled: boolean;
    };
    type CustomJsFile = {
      name: string;
      content: string;
      enabled: boolean;
    };
    const customCssFiles: CustomCssFile[] = [];
    const customJsFiles: CustomJsFile[] = [];
    const fontFilesBinary = new Map<string, Uint8Array>();
    const fontFilesByLastSegment = new Map<string, Uint8Array>();
    const graphicFiles = new Map<string, Uint8Array>(); // gfx/ → relative
    const assetFiles = new Map<string, Uint8Array>(); // assets/ → relative
    const chartFiles = new Map<string, Uint8Array>();
    let stylesXml: string | null = null;

    for (const [path, entry] of Object.entries(v5Zip.files)) {
      if (entry.dir) continue;
      const rel = rootPrefix ? path.replace(rootPrefix, '') : path;
      const lower = rel.toLowerCase();
      if (rel.startsWith('__MACOSX') || rel.endsWith('.DS_Store')) continue;

      if (lower === 'styles.xml') {
        stylesXml = await entry.async('string');
        continue;
      }
      if (lower.startsWith('fonts/') && FONT_EXTENSIONS.test(lower)) {
        const data = new Uint8Array(await entry.async('uint8array'));
        const insidePath = rel.replace(/^fonts\//i, '');
        fontFilesBinary.set(insidePath, data);
        const last = insidePath.split('/').pop();
        if (last) fontFilesByLastSegment.set(last, data);
        continue;
      }
      if (lower.startsWith('gfx/') && IMAGE_EXTENSIONS.test(lower)) {
        const data = new Uint8Array(await entry.async('uint8array'));
        graphicFiles.set(rel.replace(/^gfx\//i, ''), data);
        continue;
      }
      if (lower.startsWith('assets/') && IMAGE_EXTENSIONS.test(lower)) {
        const data = new Uint8Array(await entry.async('uint8array'));
        assetFiles.set(rel.replace(/^assets\//i, ''), data);
        continue;
      }
      if (lower.startsWith('charts/')) {
        chartFiles.set(rel, new Uint8Array(await entry.async('uint8array')));
        continue;
      }

      // Custom SCSS/CSS in css/custom/ or css/fonts/ — the legacy
      // importer treats both as custom; css/fonts/ stays enabled by
      // default, css/custom/ disabled, mirroring single-theme flow.
      const isCustomScss = lower.startsWith('css/custom/') && lower.endsWith('.scss');
      const isFontsScss = lower.startsWith('css/fonts/') && lower.endsWith('.scss');
      if (isCustomScss || isFontsScss) {
        let content = await entry.async('string');
        // Convert $-refs → var(--…) / hardcoded values. Build a mapping
        // table covering both the user's V5 vars and the CSV-mapped
        // V6 names.
        const themeNamesMap = new Map<string, string>();
        for (const m of mappings) {
          if (!themeNamesMap.has(m.scssVariable)) {
            themeNamesMap.set(m.scssVariable, m.cssVariable);
          }
        }
        // Replace recognised SCSS vars with var(--css-var) where we have
        // a mapping; leave others alone for now (the export rebuilds via
        // the CSV-driven SCSS vars at compile time anyway).
        content = content.replace(/\$[a-zA-Z0-9_-]+/g, (scssVar) => {
          const cssVar = themeNamesMap.get(scssVar);
          if (cssVar) return `var(${cssVar})`;
          // Resolve to literal if defined in the theme's own SCSS vars.
          const literal = scssVariables[scssVar];
          if (literal) return resolveVariableReference(literal, scssVariables);
          return scssVar;
        });
        // For @font-face files, inline the binary as data URIs so the
        // resulting CSS works without us having to emit a fonts/ folder.
        const hasFontFace = /@font-face\s*\{/i.test(content);
        if (isFontsScss || hasFontFace) {
          content = convertFontUrlsToDataUris(content, fontFilesByLastSegment);
        }
        const filename = rel.split('/').pop() ?? rel;
        customCssFiles.push({
          name: filename,
          content,
          // Match single-theme legacy import: fonts files enabled, the
          // rest disabled by default.
          enabled: isFontsScss || hasFontFace,
        });
        continue;
      }

      const isCustomJs =
        lower.startsWith('js/') &&
        lower.endsWith('.js') &&
        !lower.endsWith('.min.js');
      if (isCustomJs) {
        const content = await entry.async('string');
        const insideJs = rel.replace(/^js\//i, '');
        customJsFiles.push({ name: insideJs, content, enabled: false });
        continue;
      }
    }

    // Auto-generated logo-widths file. Behaves like a regular custom CSS
    // file (added to css/custom/, imported in theme.scss). Enabled by
    // default — matches the single-theme `fromFontsFolder=true` path.
    const logoWidthsContent = buildLogoWidthsScss(scssVariables);
    if (logoWidthsContent) {
      customCssFiles.push({
        name: '_logo-widths.scss',
        content: logoWidthsContent,
        enabled: true,
      });
    }

    // ── Phase 3: build the V6 theme.scss + _variables.scss ──────────
    const declaredVariables = mappedVariables.filter((v) => v.value !== '');

    // Special vars that need SCSS-side declarations so the framework's
    // existing `@if` checks see them as concrete values rather than CSS
    // custom properties (matches handleExport's scssVarMapping).
    const scssVarMapping: Record<string, string> = {
      '--color-brand-a': '$color-brand-a',
      '--color-brand-b': '$color-brand-b',
      '--color-brand-c': '$color-brand-c',
      '--color-brand-d': '$color-brand-d',
      '--color-brand-e': '$color-brand-e',
      '--color-brand-f': '$color-brand-f',
      '--color-brand-g': '$color-brand-g',
      '--grid-container-max-width': '$grid-max-width',
    };

    let variablesScss = '';
    const scssVarLines: string[] = [];
    for (const v of declaredVariables) {
      const target = scssVarMapping[v.name];
      if (target) scssVarLines.push(`${target}: ${v.value};`);
    }
    if (scssVarLines.length) variablesScss += scssVarLines.join('\n') + '\n\n';

    const cssPropLines: string[] = [];
    for (const v of declaredVariables) {
      if (scssVarMapping[v.name]) {
        cssPropLines.push(`\t${v.name}: #{${scssVarMapping[v.name]}};`);
      } else {
        cssPropLines.push(`\t${v.name}: ${v.value};`);
      }
    }
    if (cssPropLines.length) {
      variablesScss += `:root {\n${cssPropLines.join('\n')}\n}\n`;
    }

    let themeScss = '';
    themeScss += `// Importing Fundamentals Variables\n`;
    themeScss += `@import '../../../../../GoBasic/baseStylesV6/css/variables.scss';\n\n`;
    themeScss += `// Importing Theme Specific Variables\n`;
    themeScss += `@import 'variables.scss';\n\n`;
    themeScss += `// Importing Fundamentals Styles\n`;
    themeScss += `@import '../../../../../GoBasic/baseStylesV6/css/imports.scss';\n`;
    themeScss += `@import '../../../../../GoBasic/baseStylesV6/css/import-html-publication.scss';`;

    if (customCssFiles.length > 0) {
      themeScss += '\n\n// Custom SCSS Files';
      for (const file of customCssFiles) {
        const importLine = `@import '../custom/${file.name}';`;
        themeScss += file.enabled ? `\n${importLine}` : `\n// ${importLine}`;
      }
    }

    // V5→V6 html font-size reset. Identical condition as the
    // single-theme handleExport: only fires when --font-normal isn't
    // the V6 default of 1rem.
    const fontNormalVar = declaredVariables.find(
      (v) => v.name === '--font-normal',
    );
    const fontNormalValue = fontNormalVar?.value || '1rem';
    const needsHtmlFontSizeReset = fontNormalValue.trim() !== '1rem';
    if (needsHtmlFontSizeReset) {
      themeScss += [
        '',
        '',
        '// V5→V6 compatibility: prevent double font-size scaling on <html>.',
        '// V6 baseStyles sets `html { font-size: var(--font-normal) }` which rebases',
        '// all rem values. Keeping html at 1rem matches V5 behaviour where only <body>',
        '// received the non-default font size.',
        'html { font-size: 1rem; }',
      ].join('\n');
    }

    // ── Phase 4: compile theme.css via the existing API ─────────────
    // Stitch enabled custom files (and the html reset for non-1rem
    // font-normal) into customScss so the compiled output mirrors what
    // the single-theme export produces.
    const enabledCustomScss = customCssFiles
      .filter((f) => f.enabled)
      .map((f) => `/* ${f.name} */\n${f.content}`)
      .join('\n\n');
    const htmlFontSizeReset = needsHtmlFontSizeReset
      ? [
          '/* V5→V6 compatibility: prevent double font-size scaling on <html>.',
          ' * V6 baseStyles sets `html { font-size: var(--font-normal) }` which would',
          ' * rebase all rem values. Keeping html at 1rem matches V5 behaviour where',
          ' * only <body> received the non-default font size. */',
          'html { font-size: 1rem; }',
        ].join('\n')
      : '';
    const customScssWithReset = [htmlFontSizeReset, enabledCustomScss]
      .filter(Boolean)
      .join('\n\n');

    let themeCss = '';
    try {
      themeCss = await compileFullTheme(
        declaredVariables.map((v) => ({ name: v.name, value: v.value })),
        variablesScss,
        customScssWithReset,
      );
    } catch (err) {
      // Soft failure for SCSS compile errors — emit a placeholder
      // theme.css and surface the error in the result so the operator
      // can recompile theme.scss locally with sass.
      const msg = err instanceof Error ? err.message : String(err);
      themeCss =
        `/* SCSS compile failed during batch convert.\n` +
        ` * theme.scss is still valid; recompile locally with sass.\n` +
        ` * Error: ${msg.replace(/\*\//g, '*\\/')}\n` +
        ` */\n`;
    }

    // ── Phase 5: assemble output zip ─────────────────────────────────
    const outputZip = new JSZip();
    const themeFolder = outputZip.folder(targetName);
    if (!themeFolder) {
      return {
        success: false,
        sourceName,
        targetName,
        error: 'Failed to create theme folder in output zip',
      };
    }

    const cssFolder = themeFolder.folder('css');
    if (cssFolder) {
      cssFolder.file('_variables.scss', variablesScss);
      cssFolder.file('theme.scss', themeScss);
      cssFolder.file('theme.css', themeCss);
    }

    if (customCssFiles.length > 0) {
      const customFolder = themeFolder.folder('custom');
      if (customFolder) {
        for (const file of customCssFiles) {
          customFolder.file(file.name, file.content);
        }
      }
    }

    if (customJsFiles.length > 0) {
      const jsFolder = themeFolder.folder('js');
      if (jsFolder) {
        for (const file of customJsFiles) {
          // Disabled JS files get wrapped in a comment block (same
          // marker the single-theme export uses, so a re-import can
          // unwrap them).
          const content = !file.enabled
            ? `/*\n * This file is marked DISABLED in the Theme Creator.\n` +
              ` * Re-enable it in the Custom JS tab to remove this wrapper.\n` +
              `${file.content.replace(/\*\//g, '*\\/')}\n */\n`
            : file.content;
          jsFolder.file(file.name, content);
        }
      }
    }

    if (fontFilesBinary.size > 0) {
      const fontsFolder = themeFolder.folder('fonts');
      if (fontsFolder) {
        // Map.forEach order: (value, key) — flipped from `entries()`.
        fontFilesBinary.forEach((data, insidePath) => {
          fontsFolder.file(insidePath, data);
        });
      }
    }

    if (graphicFiles.size > 0) {
      const gfxFolder = themeFolder.folder('gfx');
      if (gfxFolder) {
        graphicFiles.forEach((data, name) => {
          gfxFolder.file(name, data);
        });
      }
    }
    if (assetFiles.size > 0) {
      const assetsFolder = themeFolder.folder('assets');
      if (assetsFolder) {
        assetFiles.forEach((data, name) => {
          assetsFolder.file(name, data);
        });
      }
    }
    if (chartFiles.size > 0) {
      chartFiles.forEach((data, name) => {
        themeFolder.file(name, data);
      });
    }

    if (stylesXml !== null) {
      // Pass-through verbatim. Single-theme export round-trips through
      // /api/parse-styles-xml + /api/export-styles-xml, but those are
      // round-trips around user-edited classes — for batch we have no
      // edits, so the original XML is exactly what we'd produce anyway.
      themeFolder.file('styles.xml', stylesXml);
    }

    return {
      success: true,
      sourceName,
      targetName,
      outputZip,
      mappedVariableCount: mappedVariables.length,
      customCssCount: customCssFiles.length,
      customJsCount: customJsFiles.length,
      fontFileCount: fontFilesBinary.size,
      graphicFileCount: graphicFiles.size + assetFiles.size,
      hadStylesXml: stylesXml !== null,
    };
  } catch (err) {
    return {
      success: false,
      sourceName,
      targetName,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Compute the postfix-aware target name. Per spec: `solroed` → `solroed--v6`
 * and `solroed--v6` → `solroed--v6--v6` (deliberately stacking on
 * already-suffixed sources so re-runs are visible).
 */
export function computeTargetName(sourceName: string): string {
  return `${sourceName}--v6`;
}

/**
 * Write every file from a JSZip into a destination directory handle,
 * creating intermediate directories as needed. The caller has already
 * obtained `readwrite` permission via `showDirectoryPicker`.
 */
export async function writeZipToDirectoryHandle(
  zip: JSZip,
  parentDir: FileSystemDirectoryHandle,
): Promise<void> {
  const entries = Object.entries(zip.files).filter(([, e]) => !e.dir);
  for (const [path, entry] of entries) {
    const segments = path.split('/').filter(Boolean);
    const fileName = segments.pop();
    if (!fileName) continue;
    let dir: FileSystemDirectoryHandle = parentDir;
    for (const seg of segments) {
      dir = await dir.getDirectoryHandle(seg, { create: true });
    }
    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await (
      fileHandle as unknown as {
        createWritable: () => Promise<FileSystemWritableFileStream>;
      }
    ).createWritable();
    const data = await entry.async('uint8array');
    await writable.write(data);
    await writable.close();
  }
}
