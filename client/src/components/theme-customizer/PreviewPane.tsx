import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, Tablet, Smartphone, Loader2, ExternalLink } from 'lucide-react';
import { CSSVariable } from './types';

interface PreviewPaneProps {
  variables: CSSVariable[];
  previewHtml: string;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';
type ZoomLevel = 50 | 75 | 100;

const deviceWidths: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

const DEFAULT_TEMPLATE_URL = 'https://dominik.gopublic.dk/theme-creator-template';

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

export function PreviewPane({ variables, previewHtml }: PreviewPaneProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [zoom, setZoom] = useState<ZoomLevel>(100);
  const [templateHtml, setTemplateHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [templateUrl, setTemplateUrl] = useState(DEFAULT_TEMPLATE_URL);
  const [urlInput, setUrlInput] = useState(DEFAULT_TEMPLATE_URL);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load template HTML
  const loadTemplate = useCallback(async (url: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/fetch-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (response.ok && data.html) {
        setTemplateHtml(data.html);
        setTemplateUrl(url);
      }
    } catch (err) {
      console.warn('Could not load template:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  // Parse hex color to RGB
  const hexToRgb = useCallback((hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      };
    }
    const shortResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
    if (shortResult) {
      return {
        r: parseInt(shortResult[1] + shortResult[1], 16),
        g: parseInt(shortResult[2] + shortResult[2], 16),
        b: parseInt(shortResult[3] + shortResult[3], 16)
      };
    }
    return null;
  }, []);

  // Calculate relative luminance (WCAG formula)
  const getLuminance = useCallback((colorValue: string): number | null => {
    const resolvedColor = resolveVarReferences(colorValue);
    const rgb = hexToRgb(resolvedColor);
    if (!rgb) return null;
    
    const { r, g, b } = rgb;
    const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c => 
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    );
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }, [resolveVarReferences, hexToRgb]);

  // Determine if a color is light (luminance > 0.5 means light background)
  const isLightColor = useCallback((colorValue: string): boolean => {
    const luminance = getLuminance(colorValue);
    return luminance !== null && luminance > 0.5;
  }, [getLuminance]);

  // Generate CSS content with !important to override existing styles
  const cssVariablesImportant = useMemo(() => {
    return variables.map(v => {
      const resolvedValue = resolveVarReferences(v.value);
      return `${v.name}: ${resolvedValue} !important;`;
    }).join('\n        ');
  }, [variables, resolveVarReferences]);

  // Generate surface overrides for .bg-color-* classes with luminance-aware foreground colors
  // Following the SCSS surface-theme mixin pattern with --text, --heading, --link, --btn-bg, etc.
  const surfaceOverrides = useMemo(() => {
    const colorMappings = [
      { class: 'bg-color-a', variable: '--color-brand-a' },
      { class: 'bg-color-b', variable: '--color-brand-b' },
      { class: 'bg-color-c', variable: '--color-brand-c' },
      { class: 'bg-color-d', variable: '--color-brand-d' },
      { class: 'bg-color-e', variable: '--color-brand-e' },
      { class: 'bg-color-f', variable: '--color-brand-f' },
      { class: 'bg-color-g', variable: '--color-brand-g' },
    ];

    // Get light background tone variables (for light backgrounds, use dark text)
    const getLightBgVars = () => {
      const text = resolveVarReferences(variableMap.get('--font-base-color') || 'var(--color-neutral-a)');
      const heading = resolveVarReferences(variableMap.get('--font-heading-color') || text);
      const preHeading = resolveVarReferences(variableMap.get('--pre-heading-color') || text);
      const lead = resolveVarReferences(variableMap.get('--lead-color') || text);
      const link = resolveVarReferences(variableMap.get('--link-color') || 'var(--color-brand-a)');
      const accent = resolveVarReferences(variableMap.get('--universal-accent-color') || 'var(--color-brand-a)');
      const btnBg = resolveVarReferences(variableMap.get('--button-primary-background-color') || 'var(--color-brand-a)');
      const btnFg = resolveVarReferences(variableMap.get('--button-primary-text-color') || 'var(--color-neutral-f)');
      const btnOutlineFg = resolveVarReferences(variableMap.get('--button-outline-color') || text);
      const btnOutlineBorder = resolveVarReferences(variableMap.get('--button-outline-border-color') || text);
      const iconBg = resolveVarReferences(variableMap.get('--icon-background-color') || btnBg);
      const iconFg = resolveVarReferences(variableMap.get('--icon-color') || btnFg);
      return { text, heading, preHeading, lead, link, accent, btnBg, btnFg, btnOutlineFg, btnOutlineBorder, iconBg, iconFg };
    };

    // Get dark background tone variables (for dark backgrounds, use light text)
    const getDarkBgVars = () => {
      const text = resolveVarReferences(variableMap.get('--font-base-color-on-bg-dark') || 'var(--color-neutral-f)');
      const heading = resolveVarReferences(variableMap.get('--font-heading-color-on-bg-dark') || text);
      const preHeading = resolveVarReferences(variableMap.get('--pre-heading-color-on-bg-dark') || text);
      const lead = resolveVarReferences(variableMap.get('--lead-color-on-bg-dark') || text);
      const link = resolveVarReferences(variableMap.get('--link-color-on-bg-dark') || text);
      const accent = resolveVarReferences(variableMap.get('--universal-accent-color-on-bg-dark') || text);
      const btnBg = resolveVarReferences(variableMap.get('--button-primary-background-color-on-bg-dark') || 'var(--color-neutral-f)');
      const btnFg = resolveVarReferences(variableMap.get('--button-primary-text-color-on-bg-dark') || 'var(--color-neutral-a)');
      const btnOutlineFg = resolveVarReferences(variableMap.get('--button-outline-color-on-bg-dark') || text);
      const btnOutlineBorder = resolveVarReferences(variableMap.get('--button-outline-border-color-on-bg-dark') || text);
      const iconBg = resolveVarReferences(variableMap.get('--icon-background-color-on-bg-dark') || btnBg);
      const iconFg = resolveVarReferences(variableMap.get('--icon-color-on-bg-dark') || btnFg);
      return { text, heading, preHeading, lead, link, accent, btnBg, btnFg, btnOutlineFg, btnOutlineBorder, iconBg, iconFg };
    };
    
    return colorMappings.map(({ class: className, variable }) => {
      const colorValue = variableMap.get(variable) || '';
      const isDark = !isLightColor(colorValue);
      const toneVars = isDark ? getDarkBgVars() : getLightBgVars();
      
      // Set the surface-level CSS variables that the template's CSS reads from
      return `
      .${className} {
        --surface: var(${variable}) !important;
        background-color: var(${variable}) !important;
        
        /* Surface tokens for ${isDark ? 'dark' : 'light'} background (WCAG compliant) */
        --text: ${toneVars.text} !important;
        --heading: ${toneVars.heading} !important;
        --pre-heading: ${toneVars.preHeading} !important;
        --lead: ${toneVars.lead} !important;
        --link: ${toneVars.link} !important;
        --accent: ${toneVars.accent} !important;
        --fg: var(--text) !important;
        
        /* Button tokens */
        --btn-bg: ${toneVars.btnBg} !important;
        --btn-fg: ${toneVars.btnFg} !important;
        --btn-outline-fg: ${toneVars.btnOutlineFg} !important;
        --btn-outline-border: ${toneVars.btnOutlineBorder} !important;
        
        /* Icon tokens */
        --icon-bg: ${toneVars.iconBg} !important;
        --icon-fg: ${toneVars.iconFg} !important;
        
        /* Derived tokens */
        --muted-bg: color-mix(in srgb, var(--fg) 5%, var(--surface)) !important;
        --border: color-mix(in srgb, var(--fg) 25%, var(--surface)) !important;
        --btn-bg-hover: color-mix(in srgb, var(--btn-bg) 90%, var(--surface)) !important;
        
        /* Apply base text color */
        color: var(--text) !important;
      }
      
      /* Direct element overrides for ${className} */
      .${className} h1, .${className} h2, .${className} h3, 
      .${className} h4, .${className} h5, .${className} h6,
      .${className} .heading {
        color: var(--heading) !important;
      }
      .${className} .pre-heading {
        color: var(--pre-heading) !important;
      }
      .${className} .lead {
        color: var(--lead) !important;
      }
      .${className} a, .${className} a.link-arrow {
        color: var(--link) !important;
      }
      .${className} p, .${className} span, .${className} li {
        color: var(--text) !important;
      }
      .${className} .btn {
        background-color: var(--btn-bg) !important;
        color: var(--btn-fg) !important;
      }
      .${className} .btn:hover, .${className} .btn:focus {
        background-color: var(--btn-bg-hover) !important;
      }
      .${className} .btn-outline {
        color: var(--btn-outline-fg) !important;
        box-shadow: inset 0 0 0 var(--button-outline-border-size, 1px) var(--btn-outline-border) !important;
      }
      .${className} .media i:before {
        background-color: var(--icon-bg) !important;
        color: var(--icon-fg) !important;
      }
    `;
    }).join('\n');
  }, [variableMap, isLightColor, resolveVarReferences]);

  const customCssContent = useMemo(() => {
    return `
      :root, html, body {
        ${cssVariablesImportant}
      }
      
      /* Surface overrides for bg-color-* classes */
      ${surfaceOverrides}
    `;
  }, [cssVariablesImportant, surfaceOverrides]);

  // Get the current HTML - template or loading
  const getCurrentHtml = useCallback(() => {
    if (templateHtml) {
      return templateHtml;
    }
    return loadingHtml;
  }, [templateHtml]);

  // Base HTML for initial iframe load - only changes when template loads, NOT when variables change
  const iframeSrcDoc = useMemo(() => {
    const baseHtml = getCurrentHtml();
    const styleTag = `<style id="custom-variables"></style>`;
    
    let cleanedHtml = baseHtml.replace(/<style id="custom-variables">[\s\S]*?<\/style>/g, '');
    
    if (cleanedHtml.includes('</body>')) {
      return cleanedHtml.replace('</body>', `${styleTag}</body>`);
    }
    
    if (cleanedHtml.includes('</html>')) {
      return cleanedHtml.replace('</html>', `${styleTag}</html>`);
    }
    
    return `${cleanedHtml}${styleTag}`;
  }, [getCurrentHtml]);

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
  }, []);

  // Reset iframe loaded state when template changes
  useEffect(() => {
    setIframeLoaded(false);
  }, [templateHtml]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleUrlKeyDown}
            placeholder="Enter template URL..."
            className="flex-1 h-8 text-sm"
            data-testid="preview-url-input"
          />
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
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading template...</span>
              </>
            ) : (
              <span className="font-medium">Theme Preview</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
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

            <Select value={zoom.toString()} onValueChange={(v) => setZoom(parseInt(v) as ZoomLevel)}>
              <SelectTrigger className="w-20 h-8" data-testid="preview-zoom-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50%</SelectItem>
                <SelectItem value="75">75%</SelectItem>
                <SelectItem value="100">100%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/50 p-4">
        <div 
          className="mx-auto bg-background border rounded-md shadow-sm overflow-hidden transition-all duration-200"
          style={{ 
            width: deviceWidths[device],
            maxWidth: '100%',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            height: zoom < 100 ? `${100 / (zoom / 100)}%` : 'auto',
          }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={iframeSrcDoc}
            onLoad={handleIframeLoad}
            className="w-full h-[800px] border-0"
            title="Theme Preview"
            sandbox="allow-same-origin"
            data-testid="preview-iframe"
          />
        </div>
      </div>
    </div>
  );
}

export default PreviewPane;
