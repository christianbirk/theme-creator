import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Monitor, Tablet, Smartphone, ZoomIn, ZoomOut } from 'lucide-react';
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

export function PreviewPane({ variables, previewHtml }: PreviewPaneProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [zoom, setZoom] = useState<ZoomLevel>(100);

  const cssVariablesStyle = useMemo(() => {
    return variables.reduce((acc, v) => {
      acc[v.name] = v.value;
      return acc;
    }, {} as Record<string, string>);
  }, [variables]);

  const styleTag = useMemo(() => {
    const cssVars = variables.map(v => `${v.name}: ${v.value};`).join('\n  ');
    return `
      :root {
        ${cssVars}
      }
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: var(--font-family-sans, 'Inter', sans-serif);
        font-size: var(--font-size-base, 16px);
        line-height: var(--line-height-normal, 1.5);
        color: var(--foreground, #0F172A);
        background: var(--background, #FFFFFF);
      }
      
      .preview-container {
        padding: var(--spacing-lg, 24px);
        min-height: 100%;
      }
      
      .preview-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--spacing-md, 16px) var(--spacing-lg, 24px);
        background: var(--card, #FFFFFF);
        border-bottom: var(--border-width, 1px) solid var(--border, #E2E8F0);
        margin-bottom: var(--spacing-lg, 24px);
      }
      
      .preview-nav-logo {
        font-size: var(--font-size-xl, 20px);
        font-weight: var(--font-weight-bold, 700);
        color: var(--primary, #3B82F6);
      }
      
      .preview-nav-links {
        display: flex;
        gap: var(--spacing-md, 16px);
      }
      
      .preview-nav-link {
        color: var(--muted-foreground, #64748B);
        text-decoration: none;
        font-size: var(--font-size-sm, 14px);
      }
      
      .preview-nav-link:hover {
        color: var(--foreground, #0F172A);
      }
      
      .preview-hero {
        text-align: center;
        padding: var(--spacing-3xl, 64px) var(--spacing-lg, 24px);
        background: linear-gradient(135deg, var(--primary, #3B82F6), var(--accent, #8B5CF6));
        border-radius: var(--radius-lg, 8px);
        margin-bottom: var(--spacing-xl, 32px);
      }
      
      .preview-hero h1 {
        font-size: var(--font-size-3xl, 30px);
        font-weight: var(--font-weight-bold, 700);
        color: var(--primary-foreground, #FFFFFF);
        margin-bottom: var(--spacing-md, 16px);
      }
      
      .preview-hero p {
        font-size: var(--font-size-lg, 18px);
        color: var(--primary-foreground, #FFFFFF);
        opacity: 0.9;
        margin-bottom: var(--spacing-lg, 24px);
      }
      
      .preview-btn {
        display: inline-block;
        padding: var(--spacing-sm, 8px) var(--spacing-lg, 24px);
        background: var(--background, #FFFFFF);
        color: var(--primary, #3B82F6);
        border-radius: var(--radius-md, 6px);
        font-weight: var(--font-weight-semibold, 600);
        font-size: var(--font-size-sm, 14px);
        border: none;
        cursor: pointer;
        transition: all var(--transition-normal, 200ms) var(--easing-default, ease-in-out);
      }
      
      .preview-btn:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md, 0 4px 6px rgba(0,0,0,0.1));
      }
      
      .preview-btn-primary {
        background: var(--primary, #3B82F6);
        color: var(--primary-foreground, #FFFFFF);
      }
      
      .preview-btn-secondary {
        background: var(--secondary, #64748B);
        color: var(--secondary-foreground, #FFFFFF);
      }
      
      .preview-btn-outline {
        background: transparent;
        color: var(--foreground, #0F172A);
        border: var(--border-width, 1px) solid var(--border, #E2E8F0);
      }
      
      .preview-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: var(--spacing-lg, 24px);
        margin-bottom: var(--spacing-xl, 32px);
      }
      
      .preview-card {
        background: var(--card, #FFFFFF);
        border: var(--border-width, 1px) solid var(--border, #E2E8F0);
        border-radius: var(--radius-lg, 8px);
        padding: var(--card-padding, 24px);
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
      }
      
      .preview-card h3 {
        font-size: var(--font-size-lg, 18px);
        font-weight: var(--font-weight-semibold, 600);
        margin-bottom: var(--spacing-sm, 8px);
      }
      
      .preview-card p {
        color: var(--muted-foreground, #64748B);
        font-size: var(--font-size-sm, 14px);
        margin-bottom: var(--spacing-md, 16px);
      }
      
      .preview-form {
        background: var(--card, #FFFFFF);
        border: var(--border-width, 1px) solid var(--border, #E2E8F0);
        border-radius: var(--radius-lg, 8px);
        padding: var(--card-padding, 24px);
        max-width: 400px;
      }
      
      .preview-form h3 {
        font-size: var(--font-size-lg, 18px);
        font-weight: var(--font-weight-semibold, 600);
        margin-bottom: var(--spacing-md, 16px);
      }
      
      .preview-form-group {
        margin-bottom: var(--spacing-md, 16px);
      }
      
      .preview-form-label {
        display: block;
        font-size: var(--font-size-sm, 14px);
        font-weight: var(--font-weight-medium, 500);
        margin-bottom: var(--spacing-xs, 4px);
      }
      
      .preview-form-input {
        width: 100%;
        height: var(--input-height, 40px);
        padding: 0 var(--spacing-sm, 8px);
        border: var(--border-width, 1px) solid var(--input, #E2E8F0);
        border-radius: var(--radius-md, 6px);
        font-size: var(--font-size-sm, 14px);
        background: var(--background, #FFFFFF);
        color: var(--foreground, #0F172A);
      }
      
      .preview-form-input:focus {
        outline: none;
        border-color: var(--primary, #3B82F6);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
      
      .preview-badges {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-sm, 8px);
        margin-bottom: var(--spacing-lg, 24px);
      }
      
      .preview-badge {
        display: inline-flex;
        align-items: center;
        padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
        border-radius: var(--radius-full, 9999px);
        font-size: 12px;
        font-weight: var(--font-weight-medium, 500);
      }
      
      .preview-badge-success {
        background: var(--success, #22C55E);
        color: var(--success-foreground, #FFFFFF);
      }
      
      .preview-badge-warning {
        background: var(--warning, #F59E0B);
        color: var(--warning-foreground, #FFFFFF);
      }
      
      .preview-badge-destructive {
        background: var(--destructive, #EF4444);
        color: var(--destructive-foreground, #FFFFFF);
      }
      
      .preview-badge-info {
        background: var(--info, #0EA5E9);
        color: var(--info-foreground, #FFFFFF);
      }
      
      .preview-typography {
        margin-bottom: var(--spacing-xl, 32px);
      }
      
      .preview-typography h2 {
        font-size: var(--font-size-2xl, 24px);
        font-weight: var(--font-weight-bold, 700);
        margin-bottom: var(--spacing-sm, 8px);
      }
      
      .preview-typography p {
        color: var(--muted-foreground, #64748B);
        line-height: var(--line-height-loose, 1.75);
      }
      
      .preview-code {
        font-family: var(--font-family-mono, 'JetBrains Mono', monospace);
        background: var(--muted, #F1F5F9);
        padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
        border-radius: var(--radius-sm, 4px);
        font-size: var(--font-size-sm, 14px);
      }
    `;
  }, [variables]);

  const defaultPreviewContent = `
    <nav class="preview-nav">
      <div class="preview-nav-logo">ThemeBrand</div>
      <div class="preview-nav-links">
        <a href="#" class="preview-nav-link">Home</a>
        <a href="#" class="preview-nav-link">Features</a>
        <a href="#" class="preview-nav-link">Pricing</a>
        <a href="#" class="preview-nav-link">Contact</a>
      </div>
    </nav>
    
    <div class="preview-container">
      <div class="preview-hero">
        <h1>Welcome to Your Brand</h1>
        <p>Build beautiful experiences with your custom theme</p>
        <button class="preview-btn">Get Started</button>
      </div>
      
      <div class="preview-badges">
        <span class="preview-badge preview-badge-success">Success</span>
        <span class="preview-badge preview-badge-warning">Warning</span>
        <span class="preview-badge preview-badge-destructive">Error</span>
        <span class="preview-badge preview-badge-info">Info</span>
      </div>
      
      <div class="preview-typography">
        <h2>Typography Preview</h2>
        <p>This paragraph demonstrates your typography settings including font family, size, and line height. The <code class="preview-code">--font-family-sans</code> variable controls the main text appearance.</p>
      </div>
      
      <div class="preview-cards">
        <div class="preview-card">
          <h3>Feature One</h3>
          <p>Customize every aspect of your design with CSS variables.</p>
          <button class="preview-btn preview-btn-primary">Learn More</button>
        </div>
        <div class="preview-card">
          <h3>Feature Two</h3>
          <p>Live preview updates instantly as you make changes.</p>
          <button class="preview-btn preview-btn-secondary">Explore</button>
        </div>
        <div class="preview-card">
          <h3>Feature Three</h3>
          <p>Export your theme as a ready-to-use CSS file.</p>
          <button class="preview-btn preview-btn-outline">Download</button>
        </div>
      </div>
      
      <div class="preview-form">
        <h3>Contact Form</h3>
        <div class="preview-form-group">
          <label class="preview-form-label">Name</label>
          <input type="text" class="preview-form-input" placeholder="Enter your name" />
        </div>
        <div class="preview-form-group">
          <label class="preview-form-label">Email</label>
          <input type="email" class="preview-form-input" placeholder="Enter your email" />
        </div>
        <button class="preview-btn preview-btn-primary" style="width: 100%;">Submit</button>
      </div>
    </div>
  `;

  const iframeSrcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=JetBrains+Mono:wght@100..800&display=swap" rel="stylesheet">
        <style>${styleTag}</style>
      </head>
      <body>
        ${previewHtml || defaultPreviewContent}
      </body>
    </html>
  `;

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
            className="w-full h-[600px] border-0"
            title="Theme Preview"
            data-testid="preview-iframe"
          />
        </div>
      </div>
    </div>
  );
}

export default PreviewPane;
