import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Monitor, Tablet, Smartphone, Loader2, ExternalLink, AlertCircle, AlertTriangle, X, Home } from 'lucide-react';
import { CSSVariable } from './types';
import { ScssFile } from './CustomCssManager';
import { useToast } from '@/hooks/use-toast';

export interface SelectedElement {
  id: string;
  name: string;
  variables: string[];
}

interface PreviewPaneProps {
  variables: CSSVariable[];
  previewHtml: string;
  customCssFiles?: ScssFile[];
  fontCss?: string;
  // Source SCSS of the theme being edited. When the previewed site
  // bakes its brand colors in at compile time (compiled-no-vars), the
  // server uses this — compiled with the current variables — as the
  // substitute stylesheet so the page actually shows the user's theme.
  baseScss?: string;
  onElementSelect?: (element: SelectedElement | null) => void;
  inspectorMode?: boolean;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const deviceWidths: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

const DEFAULT_TEMPLATE_URL = 'https://municipality-template.gopublic.dk/';

const loadingHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0;
            background: #f5f5f5;
        }
        .loading { 
            text-align: center; 
            color: #666; 
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #e0e0e0;
            border-top-color: #666;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="loading">
        <div class="spinner"></div>
        <p>Loading template...</p>
    </div>
</body>
</html>
`;

export function PreviewPane({ variables, previewHtml, customCssFiles = [], fontCss = '', baseScss = '', onElementSelect, inspectorMode = false }: PreviewPaneProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [templateHtml, setTemplateHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [, setTemplateUrl] = useState(DEFAULT_TEMPLATE_URL);
  const [urlInput, setUrlInput] = useState(DEFAULT_TEMPLATE_URL);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Compatibility verdict from /api/fetch-preview. `compiled-no-vars`
  // means the loaded site's stylesheet has the brand colors hard-coded
  // at compile time and does not reference --color-brand-* variables.
  // When that happens, the server also swaps the site's theme stylesheet
  // for a known-good blank V6 theme so the customizer's variables still
  // take effect — `themeSwapped` says whether that swap actually ran.
  const [themeCompatibility, setThemeCompatibility] =
    useState<'compatible' | 'compiled-no-vars' | 'unknown'>('unknown');
  const [themeSwapped, setThemeSwapped] = useState(false);
  const [themeSwapSource, setThemeSwapSource] =
    useState<'user-theme' | 'fallback-template' | null>(null);
  const [compatBannerDismissed, setCompatBannerDismissed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const customCssRef = useRef<string>('');
  // Mirror variables / baseScss into refs so loadTemplate can read the
  // latest values without becoming a new function on every edit (which
  // would re-trigger the mount-effect that loads the default URL).
  const variablesRef = useRef(variables);
  const baseScssRef = useRef(baseScss);
  useEffect(() => { variablesRef.current = variables; }, [variables]);
  useEffect(() => { baseScssRef.current = baseScss; }, [baseScss]);
  const { toast } = useToast();

  // Load template HTML
  const loadTemplate = useCallback(async (url: string) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/fetch-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the user's currently-edited theme so the server can use
        // it as the swap substitute for compiled-no-vars sites.
        body: JSON.stringify({
          url,
          variables: variablesRef.current.map((v) => ({ name: v.name, value: v.value })),
          baseScss: baseScssRef.current,
        }),
      });
      const data = await response.json();
      if (response.ok && data.html) {
        setTemplateHtml(data.html);
        setTemplateUrl(url);
        setFetchError(null);
        setThemeCompatibility(
          data.themeCompatibility === 'compatible' ||
          data.themeCompatibility === 'compiled-no-vars'
            ? data.themeCompatibility
            : 'unknown',
        );
        setThemeSwapped(Boolean(data.themeSwapped));
        setThemeSwapSource(
          data.themeSwapSource === 'user-theme' || data.themeSwapSource === 'fallback-template'
            ? data.themeSwapSource
            : null,
        );
        // Surface a fresh banner whenever a new URL is loaded.
        setCompatBannerDismissed(false);
        toast({
          title: 'Preview loaded',
          description: `Successfully loaded ${new URL(url).hostname}`,
        });
      } else {
        const errorMsg = data.error || `Failed to load (${response.status})`;
        setFetchError(errorMsg);
        toast({
          title: 'Failed to load preview',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      setFetchError(errorMsg);
      toast({
        title: 'Failed to load preview',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Load template on mount
  useEffect(() => {
    loadTemplate(DEFAULT_TEMPLATE_URL);
  }, [loadTemplate]);

  const handleLoadUrl = useCallback(() => {
    if (urlInput.trim()) {
      loadTemplate(urlInput.trim());
    }
  }, [urlInput, loadTemplate]);

  const handleUrlKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLoadUrl();
    }
  }, [handleLoadUrl]);

  // Build a map for resolving var() references
  const variableMap = useMemo(() => {
    const map = new Map<string, string>();
    variables.forEach(v => map.set(v.name, v.value));
    return map;
  }, [variables]);

  // Resolve var() references to their computed values
  const resolveVarReferences = useCallback((value: string, depth = 0): string => {
    if (depth > 10) return value;
    
    const varRegex = /var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]+))?\)/g;
    
    return value.replace(varRegex, (match, varName, fallback) => {
      const resolvedValue = variableMap.get(varName);
      if (resolvedValue) {
        return resolveVarReferences(resolvedValue, depth + 1);
      }
      return fallback ? resolveVarReferences(fallback.trim(), depth + 1) : match;
    });
  }, [variableMap]);

  // (Previously: hexToRgb / getLuminance / isLightColor helpers and a
  // ~200-line `surfaceOverrides` block that re-implemented baseStylesV6's
  // .bg-color-* surface tokens with auto-luminance contrast. Removed —
  // V6's own `misc/classes/_background-colors.scss` already maps
  // .bg-color-a..g to --text/--heading/--link/--btn-bg/--btn-fg/--surface
  // for both light and dark variants. Themes with proper -bg-dark
  // variant variables get the right contrast for free; themes that
  // don't would have failed in the exported `theme.css` anyway, so the
  // preview now matches export behavior.)

  // Generate CSS content with !important to override existing styles.
  // Skip variables whose value is empty — these are intentionally cleared
  // (e.g. via V5 → V6 conversion of a `notset` declaration). Emitting
  // `--name: !important;` would be an invalid declaration; dropping the
  // line lets the cascade fall back to whatever default is upstream,
  // which is what the cleared/empty-control state is meant to represent.
  const cssVariablesImportant = useMemo(() => {
    return variables
      .filter(v => v.value !== '')
      .map(v => {
        const resolvedValue = resolveVarReferences(v.value);
        return `${v.name}: ${resolvedValue} !important;`;
      })
      .join('\n        ');
  }, [variables, resolveVarReferences]);

  // Per-surface contrast overrides. V6's `surface-theme` SASS mixin
  // chooses light- vs. dark-mode tokens based on `auto-contrast($surface)`
  // at compile time — so the compiled stylesheet has ONE branch baked
  // per surface (whatever the source template's brand colour landed on).
  // When the user flips brand-a from dark to light (or vice versa) the
  // surface's `--text` / `--heading` / `--btn-fg` etc. stay on the
  // original branch, leaving e.g. white text on a light cream surface.
  // Recompute the contrast in JS, decide which branch each surface
  // should use given the *current* brand colour, and emit `!important`
  // overrides that pull every surface token from the correct chain.
  //
  // The thresholds and chained fallbacks mirror V6's surface-theme
  // mixin so the output reads like what V6 would have compiled if the
  // source brand colour were the user's value.
  const surfaceContrastOverrides = useMemo(() => {
    // Lightness from a hex / shorthand-hex string. Returns a value in
    // [0, 1]. Anything that doesn't parse as a literal hex (e.g. var()
    // chains, `transparent`) falls back to 0.5 — that means "ambiguous,
    // don't emit an override" and we skip the surface below.
    const hexLightness = (raw: string): number | null => {
      const v = raw.trim().toLowerCase();
      const m = /^#([0-9a-f]{3,8})$/.exec(v);
      if (!m) return null;
      let h = m[1];
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      if (h.length === 4) h = h.split('').map((c) => c + c).join('');
      if (h.length !== 6 && h.length !== 8) return null;
      const r = parseInt(h.slice(0, 2), 16) / 255;
      const g = parseInt(h.slice(2, 4), 16) / 255;
      const b = parseInt(h.slice(4, 6), 16) / 255;
      // Relative luminance (sRGB perceptual). Same coefficients V6's
      // SASS `_lum` helper uses — keeps our threshold consistent with
      // what `auto-contrast` would have decided at compile time.
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    // V6's `is-dark` test in SASS is contrast-based, not a fixed
    // luminance threshold. A 0.45 lightness cutoff approximates it
    // closely for the colour space V6 themes use (saturated brand
    // colours and pastels) without bringing in a full WCAG contrast
    // calc on the client side.
    const SURFACES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;
    const blocks: string[] = [];

    for (const slot of SURFACES) {
      const variable = variables.find(
        (v) => v.name === `--color-brand-${slot}`,
      );
      if (!variable || !variable.value) continue;
      const resolved = resolveVarReferences(variable.value);
      const lum = hexLightness(resolved);
      // Skip when we can't read a literal hex — leave the framework's
      // compiled branch alone rather than guess.
      if (lum === null) continue;
      const isDark = lum < 0.45;

      // V6's `surface-theme` mixin computes its `--btn-bg` / `--btn-fg`
      // fallbacks via `auto-contrast()` against the *surface itself*.
      // We can't run that calc in CSS, but we can match the result with
      // `--color-neutral-a` (dark contrast) and `--color-neutral-f`
      // (light contrast) — same neutrals every V6 theme keeps fixed.
      // Crucially we DON'T fall back to `var(--color-brand-X)` — for
      // surface X that's a self-reference (brand-a text on brand-a
      // background = invisible), and that's exactly why earlier the
      // contrast switch worked for b–g but not a.
      if (isDark) {
        // Dark surface: text/headings/links flip to bg-dark variants.
        // Filled buttons default to a *light* fill with *dark* text.
        // Outline buttons default to white border + white text.
        blocks.push(`.bg-color-${slot} {
  --text: var(--font-base-color-bg-dark, var(--color-neutral-f)) !important;
  --heading: var(--font-heading-color-bg-dark, var(--text)) !important;
  --pre-heading: var(--pre-heading-color-bg-dark, var(--text)) !important;
  --lead: var(--lead-color-bg-dark, var(--text)) !important;
  --link: var(--link-color-bg-dark, var(--text)) !important;
  --accent: var(--universal-accent-color-on-bg-dark, var(--text)) !important;
  --btn-bg: var(--button-background-color-bg-dark, var(--color-neutral-f)) !important;
  --btn-fg: var(--button-font-color-bg-dark, var(--color-neutral-a)) !important;
  --btn-outline-bg: var(--button-outline-background-color-bg-dark, transparent) !important;
  --btn-outline-fg: var(--button-outline-font-color-bg-dark, var(--text)) !important;
  --btn-outline-border: var(--button-outline-border-color-bg-dark, var(--text)) !important;
  --btn-alt-bg: var(--button-alternate-background-color-bg-dark, var(--btn-bg)) !important;
  --btn-alt-fg: var(--button-alternate-font-color-bg-dark, var(--btn-fg)) !important;
  --icon-bg: var(--icon-background-color-bg-dark, var(--btn-bg)) !important;
  --icon-fg: var(--icon-color-bg-dark, var(--btn-fg)) !important;
  --label-bg: var(--label-background-bg-dark, color-mix(in srgb, var(--color-neutral-f) 7.5%, transparent)) !important;
  --label-fg: var(--label-color-bg-dark, var(--text)) !important;
  --label-border: var(--label-border-bg-dark, color-mix(in srgb, var(--color-neutral-f) 50%, transparent)) !important;
  --boxed-border: var(--boxed-border-color-bg-dark, color-mix(in srgb, var(--color-neutral-f) 20%, transparent)) !important;
  --module-heading-border: var(--module-heading-border-color-bg-dark, var(--text)) !important;
}`);
      } else {
        // Light surface: regular (non-bg-dark) variants. Filled buttons
        // default to a *dark* fill with *light* text. Links default to
        // the surface's own text colour (NOT brand-a — that would make
        // links on a light brand-a surface vanish).
        blocks.push(`.bg-color-${slot} {
  --text: var(--font-base-color, var(--color-neutral-a)) !important;
  --heading: var(--font-heading-color, var(--text)) !important;
  --pre-heading: var(--pre-heading-color, var(--text)) !important;
  --lead: var(--lead-color, var(--text)) !important;
  --link: var(--link-color, var(--text)) !important;
  --accent: var(--universal-accent-color, var(--text)) !important;
  --btn-bg: var(--button-background-color, var(--color-neutral-a)) !important;
  --btn-fg: var(--button-color, var(--color-neutral-f)) !important;
  --btn-outline-bg: var(--button-outline-background-color, transparent) !important;
  --btn-outline-fg: var(--button-outline-color, var(--text)) !important;
  --btn-outline-border: var(--button-outline-border-color, var(--text)) !important;
  --btn-alt-bg: var(--button-alternate-background-color, var(--btn-bg)) !important;
  --btn-alt-fg: var(--button-alternate-color, var(--btn-fg)) !important;
  --icon-bg: var(--icon-background-color, var(--btn-bg)) !important;
  --icon-fg: var(--icon-color, var(--btn-fg)) !important;
  --label-bg: var(--label-background, color-mix(in srgb, var(--color-neutral-a) 7.5%, transparent)) !important;
  --label-fg: var(--label-color, var(--text)) !important;
  --label-border: var(--label-border-color, color-mix(in srgb, var(--color-neutral-a) 50%, transparent)) !important;
  --boxed-border: var(--boxed-border-color, color-mix(in srgb, var(--color-neutral-a) 20%, transparent)) !important;
  --module-heading-border: var(--module-heading-border-color, var(--text)) !important;
}`);
      }
    }

    return blocks.join('\n\n');
  }, [variables, resolveVarReferences]);


  // Combine all custom CSS file contents for injection. Skip files marked
  // `enabled === false` — they're preserved in the export zip with a
  // commented-out @import line and intentionally don't load in the preview.
  const customCssFilesContent = useMemo(() => {
    if (!customCssFiles || customCssFiles.length === 0) return '';
    return customCssFiles
      .filter(file => file.enabled !== false)
      .map(file => `/* ${file.name} */\n${file.content}`)
      .join('\n\n');
  }, [customCssFiles]);

  // Collect Google Font URLs to load into the iframe via <link> tags.
  // We can't use @import here because the customCssContent is appended
  // to iframeDoc.body (not <head>), and @import in body-level <style>
  // tags isn't reliably processed by browsers. A dedicated useEffect
  // (further down) syncs <link rel="stylesheet"> elements in the iframe
  // <head> based on this list whenever the font variables change.
  const googleFontUrls = useMemo(() => {
    const families = new Set<string>();
    for (const v of variables) {
      if (v.type !== 'font') continue;
      const raw = v.value || v.defaultValue;
      if (!raw || raw.startsWith('var(')) continue;
      // Take the first comma-delimited family, THEN strip surrounding
      // quotes. Doing it the other way around leaves the inner quote in
      // place when the value is `'Plus Jakarta Sans', sans-serif`.
      const family = raw.split(',')[0].trim().replace(/^['"]|['"]$/g, '').trim();
      if (family && !family.startsWith('var(')) families.add(family);
    }
    return Array.from(families).map(
      f => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap`
    );
  }, [variables]);

  const customCssContent = useMemo(() => {
    const css = `
      /* Font-face declarations */
      ${fontCss}

      /* Custom CSS files (fonts, etc.) */
      ${customCssFilesContent}

      :root, html, body {
        ${cssVariablesImportant}
      }

      /* Pin the iframe root to 16px (browser default). V5 themes were
         all authored against a root of 16px — the \`$font-normal\`
         variable only ever applied to \`body\`, never \`html\`. So
         \`1.145rem\` should render at \`1.145 × 16 = 18.32px\` per the
         math, regardless of what \`--font-normal\` is set to.

         V6's baseStyles rebases the root via
         \`html { font-size: var(--font-normal) }\`, which would scale
         all rem values when \`--font-normal ≠ 1rem\`. We override
         that here so the preview matches the V5 mental model. */
      html {
        font-size: 16px !important;
      }

      /* Per-surface contrast overrides — flips light/dark token chains
         based on the current brand colour's lightness. See the comment
         on surfaceContrastOverrides above. */
      ${surfaceContrastOverrides}
    `;
    customCssRef.current = css;
    return css;
  }, [cssVariablesImportant, customCssFilesContent, fontCss, surfaceContrastOverrides]);

  const navigationScript = useMemo(() => {
    return `<script id="nav-intercept-script">
(function() {
  document.addEventListener('click', function(e) {
    if (document.getElementById('inspector-script')) return;
    var anchor = e.target.closest('a');
    if (!anchor) return;
    var href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      var resolved = new URL(href, document.baseURI).href;
      window.parent.postMessage({ type: 'preview-navigate', url: resolved }, '*');
    } catch(err) {}
  }, true);
})();
</script>`;
  }, []);

  // Get the current HTML - template or loading
  const getCurrentHtml = useCallback(() => {
    if (templateHtml) {
      return templateHtml;
    }
    return loadingHtml;
  }, [templateHtml]);

  // Inspector script for detecting element clicks
  const inspectorScript = useMemo(() => {
    if (!inspectorMode) return '';
    
    return `
    <script id="inspector-script">
    (function() {
      const elementMappings = [
        { id: 'h1', name: 'Heading 1 (H1)', selectors: ['h1', '.h1'], variables: ['--font-heading-family', '--font-heading-weight', '--font-heading-color', '--font-heading-hyphens', '--h1-font-family', '--h1-font-weight', '--h1-text-transform', '--font-xlarge', '--font-xlarge-line-height'] },
        { id: 'h2', name: 'Heading 2 (H2)', selectors: ['h2', '.h2'], variables: ['--font-heading-family', '--font-heading-weight', '--font-heading-color', '--font-heading-hyphens', '--h2-font-family', '--h2-font-weight', '--h2-text-transform', '--font-large', '--font-large-line-height'] },
        { id: 'h3', name: 'Heading 3 (H3)', selectors: ['h3', '.h3'], variables: ['--font-heading-family', '--font-heading-weight', '--font-heading-color', '--font-heading-hyphens', '--h3-font-family', '--h3-font-weight', '--h3-text-transform', '--font-xmedium', '--font-xmedium-line-height'] },
        { id: 'h4', name: 'Heading 4 (H4)', selectors: ['h4', '.h4'], variables: ['--font-heading-family', '--font-heading-weight', '--font-heading-color', '--font-heading-hyphens', '--h4-font-family', '--h4-font-weight', '--h4-text-transform', '--font-medium', '--font-medium-line-height'] },
        { id: 'h5', name: 'Heading 5 (H5)', selectors: ['h5', '.h5'], variables: ['--font-heading-family', '--font-heading-weight', '--font-heading-color', '--font-heading-hyphens', '--h5-font-family', '--h5-font-weight', '--h5-text-transform', '--font-xnormal', '--font-xnormal-line-height'] },
        { id: 'h6', name: 'Heading 6 (H6)', selectors: ['h6', '.h6'], variables: ['--font-heading-family', '--font-heading-weight', '--font-heading-color', '--font-heading-hyphens', '--h6-font-family', '--h6-font-weight', '--h6-text-transform', '--font-normal', '--font-normal-line-height'] },
        { id: 'paragraph', name: 'Body Text', selectors: ['p', '.body-text', '.text', '.rich-text'], variables: ['--font-base-family', '--font-base-weight', '--font-base-color', '--font-normal', '--font-normal-line-height'] },
        { id: 'lead', name: 'Lead Text', selectors: ['.lead', '.intro'], variables: ['--lead-font-family', '--lead-font-weight', '--lead-font-size', '--lead-font-line-height', '--lead-color'] },
        { id: 'pre-heading', name: 'Pre-heading', selectors: ['.pre-heading', '.eyebrow', '.overline'], variables: ['--pre-heading-family', '--pre-heading-weight', '--pre-heading-text-transform', '--pre-heading-font-size', '--pre-heading-color'] },
        { id: 'button-outline', name: 'Outline Button', selectors: ['.btn-outline', '.button-outline', '.btn-bordered'], variables: ['--button-universal-padding', '--button-universal-text-transform', '--button-universal-font-size', '--button-universal-font-weight', '--button-universal-font-family', '--button-universal-border-radius', '--button-outline-border-size', '--button-outline-color', '--button-outline-border-color', '--button-outline-hover-color'] },
        { id: 'button-primary', name: 'Primary Button', selectors: ['.btn-primary', '.button-primary'], variables: ['--button-universal-padding', '--button-universal-text-transform', '--button-universal-font-size', '--button-universal-font-weight', '--button-universal-font-family', '--button-universal-border-radius', '--button-background-color', '--button-color'] },
        { id: 'button-secondary', name: 'Secondary Button', selectors: ['.btn-secondary', '.button-secondary'], variables: ['--button-universal-padding', '--button-universal-text-transform', '--button-universal-font-size', '--button-universal-font-weight', '--button-universal-font-family', '--button-universal-border-radius', '--button-secondary-background-color', '--button-secondary-color'] },
        { id: 'button-alternate', name: 'Alternate Button', selectors: ['.btn-alternate', '.button-alternate', '.btn-alt'], variables: ['--button-universal-padding', '--button-universal-text-transform', '--button-universal-font-size', '--button-universal-font-weight', '--button-universal-font-family', '--button-universal-border-radius', '--button-alternate-background-color', '--button-alternate-color'] },
        { id: 'button-text', name: 'Text Button', selectors: ['.btn-text', '.button-text', '.btn-link'], variables: ['--button-universal-padding', '--button-universal-text-transform', '--button-universal-font-size', '--button-universal-font-weight', '--button-universal-font-family', '--button-text-color'] },
        { id: 'button', name: 'Button (Generic)', selectors: ['button', '.btn', '.button'], variables: ['--button-universal-padding', '--button-universal-text-transform', '--button-universal-font-size', '--button-universal-font-weight', '--button-universal-font-family', '--button-universal-border-radius', '--button-background-color', '--button-color'] },
        { id: 'link', name: 'Link', selectors: ['a'], variables: ['--link-style', '--link-color'] },
        { id: 'nav-main', name: 'Main Navigation', selectors: ['.nav-main', '.main-nav', '.navigation-main', '.main-navigation', '.header-navigation', 'nav.main', 'nav[aria-label="Hovedmenu"]', 'nav.mobile', 'nav[aria-label="Mobil Menu"]'], variables: ['--nav-main-align', '--nav-main-background-color', '--nav-main-container-background-color', '--nav-main-container-padding-inline', '--nav-main-border-top', '--nav-main-border-bottom', '--nav-main-active-state-height', '--nav-main-active-state-color', '--nav-main-font-family', '--nav-main-link-gap', '--nav-main-link-padding', '--nav-main-link-font-size', '--nav-main-link-font-weight', '--nav-main-link-text-transform', '--nav-main-link-color'] },
        { id: 'header', name: 'Header', selectors: ['header', '.header', '.site-header'], variables: ['--header-container-padding', '--header-background-color'] },
        { id: 'footer', name: 'Footer', selectors: ['footer', '.footer', '.site-footer'], variables: ['--footer-background-color', '--footer-heading-font-size', '--footer-heading-text-transform', '--footer-heading-font-family', '--footer-heading-font-weight'] },
        { id: 'label', name: 'Label / Badge', selectors: ['.label', '.badge', '.tag', '.chip'], variables: ['--label-border-radius', '--label-text-transform', '--label-font-family', '--label-font-weight', '--label-padding', '--label-background', '--label-color', '--label-border-color'] },
        { id: 'icon', name: 'Icon', selectors: ['.icon', 'i', 'svg'], variables: ['--icon-default-font-family', '--icon-default-font-size', '--icon-font-weight', '--icon-small-font-size', '--icon-background-size', '--icon-background-border-radius', '--icon-background-color', '--icon-color'] },
        { id: 'form', name: 'Form Field', selectors: ['input', 'textarea', 'select', '.form-control', '.input'], variables: ['--form-field-height', '--universal-border-radius'] },
        { id: 'hero', name: 'Hero Section', selectors: ['.hero', '.banner', '.jumbotron'], variables: ['--hero-ratio-full-width', '--hero-ratio-desktop', '--hero-ratio-mobile', '--hero-h1-font-size', '--hero-h1-line-height', '--hero-h2-font-size', '--hero-h2-line-height'] },
        { id: 'card', name: 'Card / Box', selectors: ['.card', '.box', '.module', '.boxed', '.highlighted'], variables: ['--universal-border-radius', '--boxed-border-width', '--boxed-border-color', '--highlighted-box-shadow', '--grid-box-padding', '--grid-box-padding-mobile'] },
        { id: 'nav-service', name: 'Service Navigation', selectors: ['.service-navigation', '.nav-service', '.service-nav', '.service-links', 'nav.service', 'nav[aria-label="Service Menu"]'], variables: ['--service-color', '--service-font-weight', '--service-font-family', '--service-font-size', '--service-text-transform'] },
        { id: 'breadcrumb', name: 'Breadcrumb', selectors: ['.breadcrumb', '.breadcrumbs', 'nav[aria-label="breadcrumb"]', '.breadcrumb-nav'], variables: ['--breadcrumb-bg-color', '--breadcrumb-padding', '--breadcrumb-link-color', '--breadcrumb-label-color', '--breadcrumb-active-color', '--breadcrumb-divider-color'] },
        { id: 'colors-brand', name: 'Brand Colors', selectors: ['.bg-color-a', '.bg-color-b', '.bg-color-c', '.bg-color-d', '.bg-color-e', '.bg-color-f', '.bg-color-g', '.bg-brand-a', '.bg-brand-b', '.bg-brand-c', '.bg-brand-d', '.bg-brand-e', '.bg-brand-f', '.bg-brand-g'], variables: ['--color-brand-a', '--color-brand-b', '--color-brand-c', '--color-brand-d', '--color-brand-e', '--color-brand-f', '--color-brand-g'] },
        { id: 'colors-neutral', name: 'Neutral Colors', selectors: ['.bg-neutral-a', '.bg-neutral-b', '.bg-neutral-c', '.bg-neutral-d', '.bg-neutral-e', '.bg-neutral-f', '.neutral-bg'], variables: ['--color-neutral-a', '--color-neutral-b', '--color-neutral-c', '--color-neutral-d', '--color-neutral-e', '--color-neutral-f'] },
      ];
      
      function matchElement(el) {
        const tagName = el.tagName.toLowerCase();
        const classList = Array.from(el.classList);
        
        for (const mapping of elementMappings) {
          for (const selector of mapping.selectors) {
            if (selector.startsWith('.')) {
              const className = selector.slice(1);
              if (classList.some(c => c === className || c.includes(className))) {
                return mapping;
              }
            } else if (selector.startsWith('[')) {
              if (el.matches && el.matches(selector)) {
                return mapping;
              }
            } else if (selector.includes('.') || selector.includes('[')) {
              try {
                if (el.matches && el.matches(selector)) {
                  return mapping;
                }
              } catch(e) {}
            }
          }
        }
        return null;
      }

      function matchTag(el) {
        const tagName = el.tagName.toLowerCase();
        for (const mapping of elementMappings) {
          for (const selector of mapping.selectors) {
            if (!selector.startsWith('.') && !selector.startsWith('[') && selector === tagName) {
              return mapping;
            }
          }
        }
        return null;
      }

      const darkBgVarMap = {
        'h1': ['--font-heading-color-bg-dark'],
        'h2': ['--font-heading-color-bg-dark'],
        'h3': ['--font-heading-color-bg-dark'],
        'h4': ['--font-heading-color-bg-dark'],
        'h5': ['--font-heading-color-bg-dark'],
        'h6': ['--font-heading-color-bg-dark'],
        'paragraph': ['--font-base-color-bg-dark'],
        'lead': ['--lead-color-bg-dark'],
        'pre-heading': ['--pre-heading-color-bg-dark'],
        'link': ['--link-color-bg-dark'],
        'button': ['--button-background-color-bg-dark', '--button-font-color-bg-dark', '--button-outline-border-color-bg-dark', '--button-outline-font-color-bg-dark', '--button-outline-hover-color-bg-dark', '--button-alternate-background-color-bg-dark', '--button-alternate-font-color-bg-dark'],
        'button-primary': ['--button-background-color-bg-dark', '--button-font-color-bg-dark'],
        'button-outline': ['--button-outline-border-color-bg-dark', '--button-outline-font-color-bg-dark', '--button-outline-hover-color-bg-dark'],
        'button-alternate': ['--button-alternate-background-color-bg-dark', '--button-alternate-font-color-bg-dark'],
        'button-secondary': ['--button-background-color-bg-dark', '--button-font-color-bg-dark'],
        'button-text': ['--button-font-color-bg-dark'],
        'label': ['--label-background-bg-dark', '--label-color-bg-dark', '--label-border-bg-dark'],
        'icon': ['--icon-background-color-bg-dark', '--icon-color-bg-dark'],
        'card': ['--boxed-border-color-bg-dark', '--module-heading-border-color-bg-dark'],
      };
      const universalDarkBgVars = ['--universal-accent-color-on-bg-dark'];

      function getSurfaceInfo(el) {
        let current = el;
        while (current && current !== document.body && current !== document.documentElement) {
          const classList = Array.from(current.classList || []);
          const bgMatch = classList.find(c => /^bg-color-[a-g]$/.test(c));
          if (bgMatch) {
            const colorLetter = bgMatch.replace('bg-color-', '');
            const bg = getComputedStyle(current).backgroundColor;
            const match = bg.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
            let isDark = true;
            if (match) {
              var rr = parseInt(match[1]) / 255;
              var gg = parseInt(match[2]) / 255;
              var bb = parseInt(match[3]) / 255;
              var rl = rr <= 0.03928 ? rr / 12.92 : Math.pow((rr + 0.055) / 1.055, 2.4);
              var gl = gg <= 0.03928 ? gg / 12.92 : Math.pow((gg + 0.055) / 1.055, 2.4);
              var bl = bb <= 0.03928 ? bb / 12.92 : Math.pow((bb + 0.055) / 1.055, 2.4);
              var luminance = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
              isDark = luminance <= 0.179;
            }
            return { onSurface: true, isDark: isDark, colorLetter: colorLetter, bgClass: bgMatch };
          }
          current = current.parentElement;
        }
        return { onSurface: false, isDark: false, colorLetter: null, bgClass: null };
      }

      const navContainerIds = ['nav-main', 'nav-service', 'breadcrumb'];

      function findMapping(element) {
        const directMatch = matchElement(element);
        if (directMatch) {
          return directMatch;
        }

        const tagMatch = matchTag(element);

        let ancestor = element.parentElement;
        let parentMapping = null;
        while (ancestor && ancestor !== document.body) {
          const am = matchElement(ancestor);
          if (am) {
            parentMapping = am;
            break;
          }
          ancestor = ancestor.parentElement;
        }

        if (tagMatch && parentMapping && navContainerIds.includes(parentMapping.id)) {
          const genericTagIds = ['link', 'icon'];
          if (genericTagIds.includes(tagMatch.id)) {
            return parentMapping;
          }
        }

        if (tagMatch) {
          return tagMatch;
        }

        if (parentMapping) {
          return parentMapping;
        }

        return null;
      }

      function augmentMapping(mapping, element) {
        if (!mapping) return mapping;
        const surface = getSurfaceInfo(element);
        if (!surface.onSurface) return mapping;

        const surfaceColorVar = surface.colorLetter ? '--color-brand-' + surface.colorLetter : null;
        let extraVars = [];
        let label = '';

        if (surface.isDark) {
          extraVars = darkBgVarMap[mapping.id] || [];
          extraVars = [...extraVars, ...universalDarkBgVars];
          label = ' (Dark Surface: ' + (surface.bgClass || '') + ')';
        } else {
          label = ' (Light Surface: ' + (surface.bgClass || '') + ')';
        }

        if (surfaceColorVar) {
          extraVars = [surfaceColorVar, ...extraVars];
        }

        if (extraVars.length === 0 && !label) return mapping;

        return {
          id: mapping.id,
          name: mapping.name + label,
          selectors: mapping.selectors,
          variables: [...mapping.variables, ...extraVars],
        };
      }
      
      if (window.__inspectorInitialized) return;
      window.__inspectorInitialized = true;
      
      let hoveredElement = null;
      
      function isInspectorActive() {
        return !!document.getElementById('inspector-script');
      }
      
      document.addEventListener('mouseover', function(e) {
        if (!isInspectorActive()) return;
        const target = e.target;
        if (hoveredElement) {
          hoveredElement.style.outline = '';
          hoveredElement.style.outlineOffset = '';
        }
        const mapping = findMapping(target);
        if (mapping) {
          target.style.outline = '2px solid #3b82f6';
          target.style.outlineOffset = '2px';
          target.style.cursor = 'pointer';
          hoveredElement = target;
        }
      }, true);
      
      document.addEventListener('mouseout', function(e) {
        if (!isInspectorActive()) return;
        if (hoveredElement) {
          hoveredElement.style.outline = '';
          hoveredElement.style.outlineOffset = '';
          hoveredElement.style.cursor = '';
          hoveredElement = null;
        }
      }, true);
      
      document.addEventListener('click', function(e) {
        if (!isInspectorActive()) return;
        e.preventDefault();
        e.stopPropagation();
        const target = e.target;
        const mapping = findMapping(target);
        if (mapping) {
          const augmented = augmentMapping(mapping, target);
          window.parent.postMessage({ type: 'element-selected', element: augmented }, '*');
        }
      }, true);
    })();
    </script>
    <style id="inspector-styles">
      * { cursor: default !important; }
    </style>
    `;
  }, [inspectorMode]);

  // Base HTML for initial iframe load - only changes when template loads, NOT when variables change
  const iframeSrcDoc = useMemo(() => {
    const baseHtml = getCurrentHtml();
    const styleTag = `<style id="custom-variables">${customCssRef.current}</style>${navigationScript}`;
    
    let cleanedHtml = baseHtml.replace(/<style id="custom-variables">[\s\S]*?<\/style>/g, '');
    cleanedHtml = cleanedHtml.replace(/<script id="inspector-script">[\s\S]*?<\/script>/g, '');
    cleanedHtml = cleanedHtml.replace(/<style id="inspector-styles">[\s\S]*?<\/style>/g, '');
    cleanedHtml = cleanedHtml.replace(/<script id="nav-intercept-script">[\s\S]*?<\/script>/g, '');
    
    const lastBodyIdx = cleanedHtml.lastIndexOf('</body>');
    if (lastBodyIdx !== -1) {
      return cleanedHtml.slice(0, lastBodyIdx) + styleTag + cleanedHtml.slice(lastBodyIdx);
    }
    
    const lastHtmlIdx = cleanedHtml.lastIndexOf('</html>');
    if (lastHtmlIdx !== -1) {
      return cleanedHtml.slice(0, lastHtmlIdx) + styleTag + cleanedHtml.slice(lastHtmlIdx);
    }
    
    return `${cleanedHtml}${styleTag}`;
  }, [getCurrentHtml]);

  // Dynamically inject/remove inspector script without reloading iframe
  useEffect(() => {
    if (!iframeLoaded || !iframeRef.current) return;
    
    try {
      const iframeDoc = iframeRef.current.contentDocument;
      if (!iframeDoc) return;
      
      // Remove existing inspector elements
      const existingScript = iframeDoc.getElementById('inspector-script');
      const existingStyles = iframeDoc.getElementById('inspector-styles');
      if (existingScript) existingScript.remove();
      if (existingStyles) existingStyles.remove();
      
      if (inspectorMode && inspectorScript) {
        const jsMatch = inspectorScript.match(/<script id="inspector-script">([\s\S]*?)<\/script>/);
        const jsCode = jsMatch ? jsMatch[1] : '';
        
        if (jsCode.trim() && iframeDoc.body) {
          const markerEl = iframeDoc.createElement('div');
          markerEl.id = 'inspector-script';
          markerEl.style.display = 'none';
          iframeDoc.body.appendChild(markerEl);
          
          const styleEl = iframeDoc.createElement('style');
          styleEl.id = 'inspector-styles';
          styleEl.textContent = '* { cursor: default !important; }';
          iframeDoc.body.appendChild(styleEl);
          
          try {
            const iframeWindow = iframeRef.current!.contentWindow;
            if (iframeWindow) {
              iframeWindow.eval(jsCode);
            }
          } catch (evalErr) {
            console.warn('Inspector script eval failed:', evalErr);
          }
        }
      }
    } catch (e) {
      console.warn('Could not update inspector script dynamically:', e);
    }
  }, [inspectorMode, iframeLoaded, inspectorScript]);

  // Sync Google Font <link> tags in the iframe <head>. Browsers ignore
  // @import inside dynamically-injected body-level <style> tags, so
  // <link rel="stylesheet"> in <head> is the only reliable way to pull
  // Google Fonts into the preview document.
  useEffect(() => {
    if (!iframeLoaded || !iframeRef.current) return;
    try {
      const iframeDoc = iframeRef.current.contentDocument;
      if (!iframeDoc) return;
      const head = iframeDoc.head || iframeDoc.querySelector('head');
      if (!head) return;

      const desired = new Set(googleFontUrls);
      const existing = new Map<string, HTMLLinkElement>();
      head.querySelectorAll<HTMLLinkElement>('link[data-customizer-google-font]').forEach(link => {
        existing.set(link.href, link);
      });

      // Remove links that are no longer needed
      existing.forEach((link, href) => {
        if (!desired.has(href)) link.remove();
      });

      // Add links that don't exist yet
      desired.forEach(href => {
        if (existing.has(href)) return;
        const link = iframeDoc.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-customizer-google-font', '');
        head.appendChild(link);
      });
    } catch (e) {
      console.warn('Could not update Google Font links in iframe:', e);
    }
  }, [googleFontUrls, iframeLoaded]);

  // Dynamically update CSS in iframe without re-rendering
  useEffect(() => {
    if (!iframeLoaded || !iframeRef.current) return;

    try {
      const iframeDoc = iframeRef.current.contentDocument;
      if (!iframeDoc) return;

      let styleEl = iframeDoc.getElementById('custom-variables') as HTMLStyleElement;
      
      if (!styleEl) {
        styleEl = iframeDoc.createElement('style');
        styleEl.id = 'custom-variables';
        if (iframeDoc.body) {
          iframeDoc.body.appendChild(styleEl);
        } else {
          const head = iframeDoc.head || iframeDoc.querySelector('head');
          if (head) {
            head.appendChild(styleEl);
          }
        }
      }
      
      if (styleEl.textContent !== customCssContent) {
        styleEl.textContent = customCssContent;
      }
    } catch (e) {
      console.warn('Could not update iframe styles dynamically:', e);
    }
  }, [customCssContent, iframeLoaded]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    if (iframeRef.current) {
      try {
        const iframeDoc = iframeRef.current.contentDocument;
        if (iframeDoc) {
          let styleEl = iframeDoc.getElementById('custom-variables') as HTMLStyleElement;
          if (!styleEl) {
            styleEl = iframeDoc.createElement('style');
            styleEl.id = 'custom-variables';
            (iframeDoc.body || iframeDoc.head)?.appendChild(styleEl);
          }
          if (customCssRef.current && styleEl.textContent !== customCssRef.current) {
            styleEl.textContent = customCssRef.current;
          }
        }
      } catch (e) {
        // Effect will handle CSS injection as fallback
      }
    }
  }, []);

  // Listen for messages from the iframe (element inspector)
  useEffect(() => {
    if (!inspectorMode || !onElementSelect) return;
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'element-selected' && event.data.element) {
        onElementSelect(event.data.element);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [inspectorMode, onElementSelect]);

  // Listen for navigation messages from iframe link clicks
  useEffect(() => {
    const handleNavMessage = (event: MessageEvent) => {
      if (event.data?.type === 'preview-navigate' && event.data.url) {
        const newUrl = event.data.url;
        setUrlInput(newUrl);
        loadTemplate(newUrl);
      }
    };
    window.addEventListener('message', handleNavMessage);
    return () => window.removeEventListener('message', handleNavMessage);
  }, [loadTemplate]);

  // Reset iframe loaded state when template changes
  useEffect(() => {
    setIframeLoaded(false);
  }, [templateHtml]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        <div className="flex items-center border rounded-md">
          <Button
            variant={device === 'desktop' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setDevice('desktop')}
            className="h-8 w-8 rounded-r-none"
            data-testid="preview-device-desktop"
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            variant={device === 'tablet' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setDevice('tablet')}
            className="h-8 w-8 rounded-none border-x"
            data-testid="preview-device-tablet"
          >
            <Tablet className="h-4 w-4" />
          </Button>
          <Button
            variant={device === 'mobile' ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setDevice('mobile')}
            className="h-8 w-8 rounded-l-none"
            data-testid="preview-device-mobile"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 relative">
          <Input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleUrlKeyDown}
            placeholder="Enter any website URL to preview..."
            className={`w-full h-8 text-sm pr-8 ${fetchError ? 'border-destructive' : ''}`}
            data-testid="preview-url-input"
          />
          {fetchError && (
            <div 
              className="absolute right-2 top-1/2 -translate-y-1/2 text-destructive"
              title={fetchError}
            >
              <AlertCircle className="h-4 w-4" />
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadUrl}
          disabled={isLoading}
          className="h-8"
          data-testid="preview-load-url"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
          <span className="ml-1">Load</span>
        </Button>
        {/* Reset-to-default button. Only visible when the user has
            navigated away from the bundled municipality template — it'd
            be a no-op when already on the default. Clicking sets the
            input back to the default URL and reloads the iframe. */}
        {urlInput.trim() !== DEFAULT_TEMPLATE_URL && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setUrlInput(DEFAULT_TEMPLATE_URL);
              loadTemplate(DEFAULT_TEMPLATE_URL);
            }}
            disabled={isLoading}
            className="h-8"
            title="Reset preview to the default V6 template"
            data-testid="preview-reset-url"
          >
            <Home className="h-4 w-4" />
            <span className="ml-1">Default</span>
          </Button>
        )}
      </div>

      {themeCompatibility === 'compiled-no-vars' && themeSwapped && !compatBannerDismissed && (
        <div
          className="flex items-start gap-2 px-3 py-2 border-b bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200 text-sm"
          role="status"
          data-testid="banner-theme-swapped"
          data-source={themeSwapSource ?? ''}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-medium">Theme swapped.</strong>{' '}
            {themeSwapSource === 'user-theme'
              ? "This site's own stylesheet had its brand colors baked in, so the customizer replaced it with the theme you're currently editing. The page may look different from the live site."
              : "This site's own stylesheet had its brand colors baked in, so the customizer replaced it with a reference V6 theme. Load a base theme into the editor to apply your own theme here instead."}
          </div>
          <button
            type="button"
            onClick={() => setCompatBannerDismissed(true)}
            className="shrink-0 p-1 -m-1 rounded hover:bg-sky-100 dark:hover:bg-sky-900/40"
            aria-label="Dismiss"
            data-testid="button-dismiss-compat-banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {themeCompatibility === 'compiled-no-vars' && !themeSwapped && !compatBannerDismissed && (
        <div
          className="flex items-start gap-2 px-3 py-2 border-b bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 text-sm"
          role="status"
          data-testid="banner-theme-incompatible"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="font-medium">This site's stylesheet was built without theme variables.</strong>{' '}
            Its <code className="text-xs px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40">theme.min.css</code>{' '}
            has the brand colors baked in as fixed values. We tried to swap it for a generic V6 theme so your changes would
            show through, but couldn't reach the source theme right now.
          </div>
          <button
            type="button"
            onClick={() => setCompatBannerDismissed(true)}
            className="shrink-0 p-1 -m-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40"
            aria-label="Dismiss"
            data-testid="button-dismiss-compat-banner-fallback"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto bg-muted/50 p-4">
        <div 
          className="mx-auto bg-background border rounded-md shadow-sm overflow-hidden transition-all duration-200 h-full"
          style={{ 
            width: deviceWidths[device],
            maxWidth: '100%',
          }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={iframeSrcDoc}
            onLoad={handleIframeLoad}
            className="w-full h-full border-0"
            title="Theme Preview"
            sandbox="allow-same-origin allow-scripts"
            data-testid="preview-iframe"
          />
        </div>
      </div>
    </div>
  );
}

export default PreviewPane;
