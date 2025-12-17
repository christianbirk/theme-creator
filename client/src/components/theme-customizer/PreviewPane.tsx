import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, Tablet, Smartphone, Loader2, X, ExternalLink } from 'lucide-react';
import { CSSVariable } from './types';
import { useToast } from '@/hooks/use-toast';

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

// Default preview HTML with GoPublic theme structure
const defaultPreviewHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://poc.media.gopublic.eu/Assets/Clients/dominiktest/Themes/new-v6-style/Release/theme.min.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
    <style id="custom-variables"></style>
    <title>Theme Preview</title>
</head>
<body id="body" class="wide-page">
<div class="overflow">
    <header class="header">
        <div class="header-container">
            <div class="logo">
                <div>
                    <a aria-label="Go to homepage" href="#">
                        <img loading="lazy" src="https://poc.media.gopublic.eu/dominiktest/Media/638965430310767602/logo.png" alt="Logo" style="max-width: 180px;" />
                    </a>
                </div>
            </div>
            <div class="services burger-active">
                <div class="service-menu">
                    <button class="site-search-toggler"><span></span></button>
                    <nav aria-label="Mobile Menu" class="mobile tree-nav burger">
                        <div class="nav-toggle">
                            <span class="dropdown-toggle no-smoothscroll" role="button" tabindex="0">
                                <span aria-hidden class="title">menu</span>
                                <span class="button"></span>
                            </span>
                        </div>
                    </nav>
                </div>
            </div>
        </div>
    </header>

    <div id="wrapper" class="wrapper">
        <div role="main">
            <div class="tool-section">
                <div>
                    <nav aria-label="Breadcrumb" class="breadcrumb">
                        <div>
                            <ul>
                                <li><span class="breadcrumb-label">You are here:</span></li>
                                <li><a href="#"><span>Home</span></a></li>
                                <li class="active"><span>Theme Preview</span></li>
                            </ul>
                        </div>
                    </nav>
                </div>
            </div>

            <div name="content" id="content-main">
                <!-- Brand Colors Section -->
                <section class="module boxed" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading">
                        <h2>Brand Colors</h2>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1rem;">
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 80px; background: var(--color-brand-a); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Color Brand A</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 80px; background: var(--color-brand-b); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Color Brand B</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 80px; background: var(--color-brand-c); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Color Brand C</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 80px; background: var(--color-brand-d); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Color Brand D</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 80px; background: var(--color-brand-e); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Color Brand E</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 80px; background: var(--color-brand-f); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Color Brand F</p>
                        </div>
                        <div style="text-align: center;">
                            <div style="width: 100%; height: 80px; background: var(--color-brand-g); border-radius: var(--universal-border-radius);"></div>
                            <p style="margin-top: 0.5rem; font-size: var(--font-small);">Color Brand G</p>
                        </div>
                    </div>
                </section>

                <!-- Typography Section -->
                <section class="module" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading alternate">
                        <h2>Typography</h2>
                    </div>
                    <div style="margin-top: 1rem;">
                        <h1>Heading 1</h1>
                        <h2>Heading 2</h2>
                        <h3>Heading 3</h3>
                        <h4>Heading 4</h4>
                        <h5>Heading 5</h5>
                        <h6>Heading 6</h6>
                        <p class="lead" style="margin-top: 1rem;">This is a lead paragraph with larger text for introductions.</p>
                        <p style="margin-top: 1rem;">This is regular body text demonstrating the base font settings. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                        <p class="pre-heading" style="margin-top: 1rem;">Pre-heading text</p>
                    </div>
                </section>

                <!-- Buttons Section -->
                <section class="module boxed" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading">
                        <h2>Buttons</h2>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem;">
                        <button class="btn">Primary Button</button>
                        <button class="btn btn-outline">Outline Button</button>
                        <button class="btn btn-alternate">Alternate Button</button>
                        <a href="#" class="link-arrow">Link with Arrow</a>
                    </div>
                </section>

                <!-- Labels Section -->
                <section class="module" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading alternate">
                        <h2>Labels</h2>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem;">
                        <span class="label">Default Label</span>
                        <span class="label">Category</span>
                        <span class="label">Tag</span>
                    </div>
                </section>

                <!-- Icons Section -->
                <section class="module boxed" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading">
                        <h2>Icons</h2>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 1rem;">
                        <div class="icon-circle">
                            <i class="fa-light fa-home"></i>
                        </div>
                        <div class="icon-circle">
                            <i class="fa-light fa-user"></i>
                        </div>
                        <div class="icon-circle">
                            <i class="fa-light fa-envelope"></i>
                        </div>
                        <div class="icon-circle">
                            <i class="fa-light fa-cog"></i>
                        </div>
                    </div>
                </section>

                <!-- Form Section -->
                <section class="module" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading alternate">
                        <h2>Form Elements</h2>
                    </div>
                    <form style="max-width: 400px; margin-top: 1rem;">
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem;">Text Input</label>
                            <input type="text" class="form-control" placeholder="Enter text..." style="width: 100%; height: var(--form-field-height); padding: 0 1rem; border: 1px solid var(--boxed-border-color); border-radius: var(--universal-border-radius);" />
                        </div>
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label style="display: block; margin-bottom: 0.5rem;">Email Input</label>
                            <input type="email" class="form-control" placeholder="Enter email..." style="width: 100%; height: var(--form-field-height); padding: 0 1rem; border: 1px solid var(--boxed-border-color); border-radius: var(--universal-border-radius);" />
                        </div>
                        <button type="submit" class="btn">Submit</button>
                    </form>
                </section>

                <!-- Dark Background Section -->
                <section class="module bg-dark" style="padding: 2rem; margin: 1rem; background: var(--color-brand-a);">
                    <div class="module-heading">
                        <h2 style="color: var(--font-heading-color-bg-dark);">Dark Background</h2>
                    </div>
                    <p style="color: var(--font-base-color-bg-dark); margin-top: 1rem;">This section demonstrates text on a dark background.</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem;">
                        <button class="btn" style="background: var(--button-background-color-bg-dark); color: var(--button-font-color-bg-dark);">Button on Dark</button>
                        <button class="btn btn-outline" style="border-color: var(--button-outline-border-color-bg-dark); color: var(--button-outline-font-color-bg-dark);">Outline on Dark</button>
                    </div>
                </section>

                <!-- Cards Section -->
                <section class="module" style="padding: 2rem; margin: 1rem;">
                    <div class="module-heading alternate">
                        <h2>Cards</h2>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
                        <div class="boxed" style="padding: var(--grid-box-padding);">
                            <h3>Boxed Card</h3>
                            <p style="margin-top: 0.5rem; color: var(--color-neutral-b);">This is a boxed card using the boxed border styles.</p>
                            <button class="btn" style="margin-top: 1rem;">Learn More</button>
                        </div>
                        <div class="highlighted" style="padding: var(--grid-box-padding);">
                            <h3>Highlighted Card</h3>
                            <p style="margin-top: 0.5rem; color: var(--color-neutral-b);">This card uses the highlighted box shadow.</p>
                            <button class="btn btn-alternate" style="margin-top: 1rem;">Explore</button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    </div>

    <footer class="footer" style="padding: 2rem; margin-top: 2rem; background: var(--footer-background-color, var(--color-neutral-e));">
        <div style="max-width: var(--grid-container-max-width); margin: 0 auto;">
            <h3 style="font-family: var(--footer-heading-font-family); font-weight: var(--footer-heading-font-weight);">Footer</h3>
            <p style="margin-top: 0.5rem; color: var(--color-neutral-b);">Footer content area with customizable styling.</p>
        </div>
    </footer>
</div>
</body>
</html>
`;

export function PreviewPane({ variables, previewHtml }: PreviewPaneProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [zoom, setZoom] = useState<ZoomLevel>(100);
  const [urlInput, setUrlInput] = useState('');
  const [customHtml, setCustomHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  // Build a map for resolving var() references
  const variableMap = useMemo(() => {
    const map = new Map<string, string>();
    variables.forEach(v => map.set(v.name, v.value));
    return map;
  }, [variables]);

  // Resolve var() references to their computed values
  const resolveVarReferences = useCallback((value: string, depth = 0): string => {
    if (depth > 10) return value; // Prevent infinite recursion
    
    const varRegex = /var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,\s*([^)]+))?\)/g;
    
    return value.replace(varRegex, (match, varName, fallback) => {
      const resolvedValue = variableMap.get(varName);
      if (resolvedValue) {
        // Recursively resolve if the value contains more var() references
        return resolveVarReferences(resolvedValue, depth + 1);
      }
      // Use fallback if provided, otherwise keep original
      return fallback ? resolveVarReferences(fallback.trim(), depth + 1) : match;
    });
  }, [variableMap]);

  // Generate CSS with all var() references resolved to computed values
  const cssVariablesStyle = useMemo(() => {
    return variables.map(v => {
      const resolvedValue = resolveVarReferences(v.value);
      return `${v.name}: ${resolvedValue};`;
    }).join('\n      ');
  }, [variables, resolveVarReferences]);

  const handleFetchUrl = useCallback(async () => {
    if (!urlInput.trim()) {
      toast({
        title: 'URL required',
        description: 'Please enter a URL to load',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/fetch-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch URL');
      }

      setCustomHtml(data.html);
      setLoadedUrl(data.url);
      toast({
        title: 'Preview loaded',
        description: `Loaded HTML from ${data.url}`,
      });
    } catch (err: any) {
      toast({
        title: 'Failed to load URL',
        description: err.message || 'Could not fetch the website',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [urlInput, toast]);

  const handleClearCustom = useCallback(() => {
    setCustomHtml(null);
    setLoadedUrl(null);
    setUrlInput('');
  }, []);

  // Generate CSS content
  const customCssContent = useMemo(() => {
    return `
      :root {
        ${cssVariablesStyle}
      }
    `;
  }, [cssVariablesStyle]);

  // Base HTML for initial iframe load (includes initial CSS, subsequent updates via useEffect)
  const iframeSrcDoc = useMemo(() => {
    const baseHtml = customHtml || defaultPreviewHtml;
    const initialCss = customCssContent;
    
    // Ensure there's a style placeholder for dynamic updates
    if (baseHtml.includes('<style id="custom-variables">')) {
      return baseHtml.replace(
        /<style id="custom-variables">.*?<\/style>/s,
        `<style id="custom-variables">${initialCss}</style>`
      );
    }
    
    // If no placeholder, inject before </head>
    if (baseHtml.includes('</head>')) {
      return baseHtml.replace(
        '</head>',
        `<style id="custom-variables">${initialCss}</style></head>`
      );
    }
    
    // If no head tag, inject before </body>
    if (baseHtml.includes('</body>')) {
      return baseHtml.replace(
        '</body>',
        `<style id="custom-variables">${initialCss}</style></body>`
      );
    }
    
    return `${baseHtml}<style id="custom-variables">${initialCss}</style>`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customHtml]); // Only rebuild iframe when HTML source changes

  // Dynamically update CSS in iframe without re-rendering
  useEffect(() => {
    if (!iframeLoaded || !iframeRef.current) return;
    
    try {
      const iframeDoc = iframeRef.current.contentDocument;
      if (!iframeDoc) return;
      
      let styleEl = iframeDoc.getElementById('custom-variables') as HTMLStyleElement;
      
      if (!styleEl) {
        // Create style element if it doesn't exist
        styleEl = iframeDoc.createElement('style');
        styleEl.id = 'custom-variables';
        const head = iframeDoc.head || iframeDoc.querySelector('head');
        if (head) {
          head.appendChild(styleEl);
        } else {
          iframeDoc.body?.appendChild(styleEl);
        }
      }
      
      styleEl.textContent = customCssContent;
    } catch (e) {
      // Cross-origin restrictions may prevent access
      console.warn('Could not update iframe styles dynamically:', e);
    }
  }, [customCssContent, iframeLoaded]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
  }, []);

  // Reset iframe loaded state when HTML changes
  useEffect(() => {
    setIframeLoaded(false);
  }, [customHtml]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 p-3 border-b bg-muted/30">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium">Preview</span>
          
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

        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter URL to load preview (e.g., https://example.com)"
              className="pr-8 h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
              data-testid="input-preview-url"
            />
            {loadedUrl && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearCustom}
                className="absolute right-0 top-0 h-8 w-8"
                data-testid="button-clear-url"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Button
            onClick={handleFetchUrl}
            disabled={isLoading}
            size="sm"
            className="h-8"
            data-testid="button-load-url"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Load
              </>
            )}
          </Button>
        </div>

        {loadedUrl ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Loaded:</span>
            <span className="truncate font-mono">{loadedUrl}</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Note: External URLs only work with sites that use GoBasic CSS variables
          </div>
        )}
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
