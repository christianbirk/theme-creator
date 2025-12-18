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

  // Generate CSS content with !important to override existing styles
  const cssVariablesImportant = useMemo(() => {
    return variables.map(v => {
      const resolvedValue = resolveVarReferences(v.value);
      return `${v.name}: ${resolvedValue} !important;`;
    }).join('\n        ');
  }, [variables, resolveVarReferences]);

  // Generate surface overrides for .bg-color-* classes
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
    
    return colorMappings.map(({ class: className, variable }) => `
      .${className} {
        --surface: var(${variable}) !important;
        background-color: var(${variable}) !important;
      }
    `).join('\n');
  }, []);

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
