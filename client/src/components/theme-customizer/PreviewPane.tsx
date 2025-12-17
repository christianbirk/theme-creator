import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, Tablet, Smartphone } from 'lucide-react';
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

// HTML content from https://dominik.gopublic.dk/webpage
const goPublicPreviewHtml = `
<!DOCTYPE html>
<html lang="da">
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
                        <p style="margin-top: 1rem;">This is regular body text demonstrating the base font settings. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
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
                    <p style="color: var(--font-base-color-bg-dark); margin-top: 1rem;">This section demonstrates text on a dark background using the dark background color variables.</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem;">
                        <button class="btn" style="background: var(--button-background-color-bg-dark); color: var(--button-font-color-bg-dark);">Button on Dark</button>
                        <button class="btn btn-outline" style="border-color: var(--button-outline-border-color-bg-dark); color: var(--button-outline-font-color-bg-dark);">Outline on Dark</button>
                    </div>
                </section>

                <!-- Cards/Boxes Section -->
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

  const cssVariablesStyle = useMemo(() => {
    return variables.map(v => `${v.name}: ${v.value};`).join('\n      ');
  }, [variables]);

  const iframeSrcDoc = useMemo(() => {
    // Insert custom CSS variables into the HTML
    const customCss = `
      :root {
        ${cssVariablesStyle}
      }
    `;
    
    // Replace the placeholder style tag with actual variables
    return goPublicPreviewHtml.replace(
      '<style id="custom-variables"></style>',
      `<style id="custom-variables">${customCss}</style>`
    );
  }, [cssVariablesStyle]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-3 border-b bg-muted/30">
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
            srcDoc={iframeSrcDoc}
            className="w-full h-[800px] border-0"
            title="Theme Preview"
            data-testid="preview-iframe"
          />
        </div>
      </div>
    </div>
  );
}

export default PreviewPane;
