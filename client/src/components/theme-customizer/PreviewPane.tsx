import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Monitor, Tablet, Smartphone, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
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

export function PreviewPane({ variables, previewHtml, customCssFiles = [], fontCss = '', onElementSelect, inspectorMode = false }: PreviewPaneProps) {
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [templateHtml, setTemplateHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [templateUrl, setTemplateUrl] = useState(DEFAULT_TEMPLATE_URL);
  const [urlInput, setUrlInput] = useState(DEFAULT_TEMPLATE_URL);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  // Load template HTML
  const loadTemplate = useCallback(async (url: string) => {
    setIsLoading(true);
    setFetchError(null);
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
        setFetchError(null);
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

  // Build maps for Light Background Tones and Dark Background Tones sections
  const lightBgTonesMap = useMemo(() => {
    const map = new Map<string, string>();
    variables
      .filter(v => v.subSection === 'light-background-tones' || v.category === 'light-bg-tones')
      .forEach(v => map.set(v.name, v.value));
    return map;
  }, [variables]);

  const darkBgTonesMap = useMemo(() => {
    const map = new Map<string, string>();
    variables
      .filter(v => v.subSection === 'dark-background-tones' || v.category === 'dark-bg-tones' || 
                   v.name.includes('-bg-dark') || v.name.includes('-on-bg-dark'))
      .forEach(v => map.set(v.name, v.value));
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

    // Dynamic auto-contrast surface tokens - mirrors the SCSS surface-theme mixin
    // First check Color Combinations section for user-configured values, then fall back to auto-computation
    const computeSurfaceTokens = (bgColorValue: string, isDarkBg: boolean) => {
      // Get the neutral palette endpoints (darkest and lightest)
      const neutralDark = resolveVarReferences(variableMap.get('--color-neutral-a') || '#1a1a1a');
      const neutralLight = resolveVarReferences(variableMap.get('--color-neutral-f') || '#ffffff');
      
      // Get the brand primary color for accents
      const brandPrimary = resolveVarReferences(variableMap.get('--color-brand-a') || '#0066cc');
      const isBrandDark = !isLightColor(brandPrimary);
      
      // Helper to get user value or fall back to computed
      const getUserValueOrDefault = (varName: string, defaultValue: string): string => {
        const userValue = variableMap.get(varName);
        if (userValue) {
          return resolveVarReferences(userValue);
        }
        return defaultValue;
      };
      
      if (isDarkBg) {
        // Dark background: use light text, and light button fills
        // Variable names match SCSS: --font-base-color-bg-dark, --font-heading-color-bg-dark, etc.
        const text = getUserValueOrDefault('--font-base-color-bg-dark', neutralLight);
        const heading = getUserValueOrDefault('--font-heading-color-bg-dark', neutralLight);
        const preHeading = getUserValueOrDefault('--pre-heading-color-bg-dark', neutralLight);
        const lead = getUserValueOrDefault('--lead-color-bg-dark', neutralLight);
        const link = getUserValueOrDefault('--link-color-bg-dark', neutralLight);
        const accent = getUserValueOrDefault('--universal-accent-color-on-bg-dark', neutralLight);
        // Buttons on dark bg
        const btnBg = getUserValueOrDefault('--button-background-color-bg-dark', isLightColor(brandPrimary) ? brandPrimary : neutralLight);
        const btnFg = getUserValueOrDefault('--button-font-color-bg-dark', isLightColor(btnBg) ? neutralDark : neutralLight);
        const btnOutlineFg = getUserValueOrDefault('--button-outline-font-color-bg-dark', neutralLight);
        const btnOutlineBorder = getUserValueOrDefault('--button-outline-border-color-bg-dark', neutralLight);
        // Alternate buttons
        const btnAltBg = getUserValueOrDefault('--button-alternate-background-color-bg-dark', btnBg);
        const btnAltFg = getUserValueOrDefault('--button-alternate-font-color-bg-dark', btnFg);
        // Icons
        const iconBg = getUserValueOrDefault('--icon-background-color-bg-dark', btnBg);
        const iconFg = getUserValueOrDefault('--icon-color-bg-dark', btnFg);
        // Labels
        const labelBg = getUserValueOrDefault('--label-background-bg-dark', neutralLight);
        const labelFg = getUserValueOrDefault('--label-color-bg-dark', neutralDark);
        const labelBorder = getUserValueOrDefault('--label-border-bg-dark', neutralLight);
        // Borders
        const boxedBorder = getUserValueOrDefault('--boxed-border-color-bg-dark', 'transparent');
        const moduleHeadingBorder = getUserValueOrDefault('--module-heading-border-color-bg-dark', neutralLight);
        return { text, heading, preHeading, lead, link, accent, btnBg, btnFg, btnOutlineFg, btnOutlineBorder, btnAltBg, btnAltFg, iconBg, iconFg, labelBg, labelFg, labelBorder, boxedBorder, moduleHeadingBorder };
      } else {
        // Light background: use dark text, and brand or dark button fills
        // Variable names match SCSS: --font-base-color, --pre-heading-color, etc. (no -bg-light suffix)
        const text = getUserValueOrDefault('--font-base-color', neutralDark);
        const heading = getUserValueOrDefault('--font-heading-color', neutralDark);
        const preHeading = getUserValueOrDefault('--pre-heading-color', neutralDark);
        const lead = getUserValueOrDefault('--lead-color', neutralDark);
        const link = getUserValueOrDefault('--link-color', brandPrimary);
        const accent = getUserValueOrDefault('--universal-accent-color', brandPrimary);
        // Buttons on light bg
        const btnBg = getUserValueOrDefault('--button-background-color', isBrandDark ? brandPrimary : neutralDark);
        const btnFg = getUserValueOrDefault('--button-color', isLightColor(btnBg) ? neutralDark : neutralLight);
        const btnOutlineFg = getUserValueOrDefault('--button-outline-color', neutralDark);
        const btnOutlineBorder = getUserValueOrDefault('--button-outline-border-color', neutralDark);
        // Alternate buttons
        const btnAltBg = getUserValueOrDefault('--button-alternate-background-color', btnBg);
        const btnAltFg = getUserValueOrDefault('--button-alternate-color', btnFg);
        // Icons
        const iconBg = getUserValueOrDefault('--icon-background-color', btnBg);
        const iconFg = getUserValueOrDefault('--icon-color', btnFg);
        // Labels
        const labelBg = getUserValueOrDefault('--label-background', neutralDark);
        const labelFg = getUserValueOrDefault('--label-color', neutralLight);
        const labelBorder = getUserValueOrDefault('--label-border-color', neutralDark);
        // Borders
        const boxedBorder = getUserValueOrDefault('--boxed-border-color', 'transparent');
        const moduleHeadingBorder = getUserValueOrDefault('--module-heading-border-color', neutralDark);
        return { text, heading, preHeading, lead, link, accent, btnBg, btnFg, btnOutlineFg, btnOutlineBorder, btnAltBg, btnAltFg, iconBg, iconFg, labelBg, labelFg, labelBorder, boxedBorder, moduleHeadingBorder };
      }
    };
    
    // Pre-compute light surface tokens for boxed/highlighted modules (always white background)
    const lightSurfaceTokens = computeSurfaceTokens('#ffffff', false);
    
    return colorMappings.map(({ class: className, variable }) => {
      const colorValue = variableMap.get(variable) || '';
      const resolvedColor = resolveVarReferences(colorValue);
      const isDark = !isLightColor(resolvedColor);
      // Compute surface tokens dynamically based on the actual background color luminance
      const toneVars = computeSurfaceTokens(resolvedColor, isDark);
      
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
      
      /* Direct element overrides for ${className} - comprehensive selectors */
      
      /* Headings - all variations */
      .${className} h1, .${className} h2, .${className} h3, 
      .${className} h4, .${className} h5, .${className} h6,
      .${className} h1 a, .${className} h2 a, .${className} h3 a,
      .${className} h4 a, .${className} h5 a, .${className} h6 a,
      .${className} .heading,
      .${className} .heading a,
      .${className} .module .heading,
      .${className} .module .heading a,
      .${className} .text .heading,
      .${className} .introduction .heading,
      .${className} .container .heading {
        color: ${toneVars.heading} !important;
      }
      
      /* Pre-headings - high specificity to override template styles */
      .${className} .pre-heading,
      .${className} .module .pre-heading,
      .${className} .text .pre-heading,
      .${className} .introduction .pre-heading,
      .${className} .container .pre-heading,
      .${className} [class*="pre-heading"],
      .${className} span.pre-heading,
      .${className} p.pre-heading,
      .${className} div.pre-heading,
      .${className}.module .pre-heading,
      .${className} .module > .text > .pre-heading,
      .${className} .module > .pre-heading {
        color: ${toneVars.preHeading} !important;
      }
      
      /* Lead text */
      .${className} .lead,
      .${className} .module .lead {
        color: ${toneVars.lead} !important;
      }
      
      /* Links */
      .${className} a,
      .${className} a.link-arrow,
      .${className} .link-arrow {
        color: ${toneVars.link} !important;
      }
      
      /* Body text */
      .${className} p,
      .${className} span:not([class*="btn"]):not([class*="icon"]),
      .${className} li,
      .${className} .rich-text,
      .${className} .rich-text p,
      .${className} .rich-text li {
        color: ${toneVars.text} !important;
      }
      
      /* Primary/filled buttons */
      .${className} .btn,
      .${className} .btn-self-service,
      .${className} [class*="btn-icon-"],
      .${className} .button {
        background-color: ${toneVars.btnBg} !important;
        color: ${toneVars.btnFg} !important;
      }
      .${className} .btn i,
      .${className} .btn-self-service i,
      .${className} [class*="btn-icon-"] i {
        color: ${toneVars.btnFg} !important;
      }
      .${className} .btn:hover, .${className} .btn:focus,
      .${className} .btn-self-service:hover, .${className} .btn-self-service:focus {
        background-color: color-mix(in srgb, ${toneVars.btnBg} 90%, var(--surface)) !important;
        color: ${toneVars.btnFg} !important;
      }
      
      /* Alternate buttons */
      .${className} .btn-alternate {
        background-color: ${toneVars.btnAltBg} !important;
        color: ${toneVars.btnAltFg} !important;
      }
      
      /* Outline buttons */
      .${className} .btn-outline,
      .${className} .multi-section .foldAll {
        color: ${toneVars.btnOutlineFg} !important;
        box-shadow: inset 0 0 0 var(--button-outline-border-size, 1px) ${toneVars.btnOutlineBorder} !important;
        background-color: transparent !important;
      }
      .${className} .btn-outline i {
        color: ${toneVars.btnOutlineFg} !important;
      }
      .${className} .btn-outline:hover, .${className} .btn-outline:focus {
        background-color: ${toneVars.btnOutlineBorder} !important;
        color: ${toneVars.btnFg} !important;
      }
      
      /* Icons */
      .${className} .media i:before {
        background-color: ${toneVars.iconBg} !important;
        color: ${toneVars.iconFg} !important;
      }
      
      /* Small-icon and flex-list icons - transparent bg, text color */
      .${className}.module.small-icon > .media > a > i:before,
      .${className}.module.small-icon > .media > i:before,
      .${className}.module.flex-list > .media > a > i:before,
      .${className}.module.flex-list > .media > i:before,
      .${className} .module.small-icon > .media > a > i:before,
      .${className} .module.small-icon > .media > i:before,
      .${className} .module.flex-list > .media > a > i:before,
      .${className} .module.flex-list > .media > i:before {
        background-color: transparent !important;
        color: ${toneVars.text} !important;
      }
      
      /* Key numbers */
      .${className} .key-number > .number {
        color: ${toneVars.text} !important;
      }
      
      /* Module heading borders */
      .${className}.module.module-heading > .text > .heading,
      .${className}.module.module-heading > .introduction > .heading,
      .${className}.module.module-heading > .container > .heading,
      .${className} .module.module-heading > .text > .heading,
      .${className} .module.module-heading > .introduction > .heading,
      .${className} .module.module-heading > .container > .heading {
        border-color: ${toneVars.text} !important;
      }
      
      /* Dividers */
      .${className} .spacer.divider:before,
      .${className}.spacer.divider:before {
        background-color: color-mix(in srgb, ${toneVars.text} 25%, var(--surface)) !important;
      }
      
      /* Boxed and Highlighted modules - use white/light surface with contrasting tokens */
      .${className} .module.boxed,
      .${className} .module.highlighted {
        --surface: #ffffff !important;
        background-color: #ffffff !important;
        color: ${lightSurfaceTokens.text} !important;
        
        /* Light surface tokens */
        --text: ${lightSurfaceTokens.text} !important;
        --heading: ${lightSurfaceTokens.heading} !important;
        --pre-heading: ${lightSurfaceTokens.preHeading} !important;
        --lead: ${lightSurfaceTokens.lead} !important;
        --link: ${lightSurfaceTokens.link} !important;
        --accent: ${lightSurfaceTokens.accent} !important;
        --fg: var(--text) !important;
        
        /* Button tokens for light surface */
        --btn-bg: ${lightSurfaceTokens.btnBg} !important;
        --btn-fg: ${lightSurfaceTokens.btnFg} !important;
        --btn-outline-fg: ${lightSurfaceTokens.btnOutlineFg} !important;
        --btn-outline-border: ${lightSurfaceTokens.btnOutlineBorder} !important;
        
        /* Icon tokens */
        --icon-bg: ${lightSurfaceTokens.iconBg} !important;
        --icon-fg: ${lightSurfaceTokens.iconFg} !important;
        
        /* Derived tokens */
        --muted-bg: color-mix(in srgb, var(--fg) 5%, var(--surface)) !important;
        --border: color-mix(in srgb, var(--fg) 25%, var(--surface)) !important;
      }
      
      /* Boxed/Highlighted headings */
      .${className} .module.boxed h1, .${className} .module.boxed h2, .${className} .module.boxed h3,
      .${className} .module.boxed h4, .${className} .module.boxed h5, .${className} .module.boxed h6,
      .${className} .module.boxed .heading,
      .${className} .module.highlighted h1, .${className} .module.highlighted h2, .${className} .module.highlighted h3,
      .${className} .module.highlighted h4, .${className} .module.highlighted h5, .${className} .module.highlighted h6,
      .${className} .module.highlighted .heading {
        color: ${lightSurfaceTokens.heading} !important;
      }
      
      /* Boxed/Highlighted pre-headings */
      .${className} .module.boxed .pre-heading,
      .${className} .module.highlighted .pre-heading {
        color: ${lightSurfaceTokens.preHeading} !important;
      }
      
      /* Boxed/Highlighted text */
      .${className} .module.boxed p,
      .${className} .module.boxed .rich-text,
      .${className} .module.highlighted p,
      .${className} .module.highlighted .rich-text {
        color: ${lightSurfaceTokens.text} !important;
      }
      
      /* Boxed/Highlighted links */
      .${className} .module.boxed a,
      .${className} .module.boxed a.link-arrow,
      .${className} .module.highlighted a,
      .${className} .module.highlighted a.link-arrow {
        color: ${lightSurfaceTokens.link} !important;
      }
      
      /* Boxed/Highlighted buttons */
      .${className} .module.boxed .btn,
      .${className} .module.highlighted .btn {
        background-color: ${lightSurfaceTokens.btnBg} !important;
        color: ${lightSurfaceTokens.btnFg} !important;
      }
      
      /* Boxed/Highlighted alternate buttons */
      .${className} .module.boxed .btn-alternate,
      .${className} .module.highlighted .btn-alternate {
        background-color: ${lightSurfaceTokens.btnAltBg} !important;
        color: ${lightSurfaceTokens.btnAltFg} !important;
      }
      
      /* Boxed/Highlighted outline buttons */
      .${className} .module.boxed .btn-outline,
      .${className} .module.highlighted .btn-outline {
        color: ${lightSurfaceTokens.btnOutlineFg} !important;
        box-shadow: inset 0 0 0 var(--button-outline-border-size, 1px) ${lightSurfaceTokens.btnOutlineBorder} !important;
        background-color: transparent !important;
      }
      
      /* Boxed/Highlighted icons */
      .${className} .module.boxed .media i:before,
      .${className} .module.highlighted .media i:before {
        background-color: ${lightSurfaceTokens.iconBg} !important;
        color: ${lightSurfaceTokens.iconFg} !important;
      }
      
      /* Small-icon and flex-list icons in boxed/highlighted - transparent bg, text color */
      .${className} .module.boxed.small-icon > .media > a > i:before,
      .${className} .module.boxed.small-icon > .media > i:before,
      .${className} .module.boxed.flex-list > .media > a > i:before,
      .${className} .module.boxed.flex-list > .media > i:before,
      .${className} .module.highlighted.small-icon > .media > a > i:before,
      .${className} .module.highlighted.small-icon > .media > i:before,
      .${className} .module.highlighted.flex-list > .media > a > i:before,
      .${className} .module.highlighted.flex-list > .media > i:before,
      .${className} .module.boxed .module.small-icon > .media > a > i:before,
      .${className} .module.boxed .module.small-icon > .media > i:before,
      .${className} .module.boxed .module.flex-list > .media > a > i:before,
      .${className} .module.boxed .module.flex-list > .media > i:before,
      .${className} .module.highlighted .module.small-icon > .media > a > i:before,
      .${className} .module.highlighted .module.small-icon > .media > i:before,
      .${className} .module.highlighted .module.flex-list > .media > a > i:before,
      .${className} .module.highlighted .module.flex-list > .media > i:before {
        background-color: transparent !important;
        color: ${lightSurfaceTokens.text} !important;
      }
      
      /* Boxed/Highlighted list items */
      .${className} .module.boxed .items .item,
      .${className} .module.boxed .items .item:last-child,
      .${className} .module.highlighted .items .item,
      .${className} .module.highlighted .items .item:last-child {
        border-color: color-mix(in srgb, ${lightSurfaceTokens.text} 25%, #ffffff) !important;
      }
      
      /* Boxed/Highlighted list text */
      .${className} .module.boxed li,
      .${className} .module.boxed ul,
      .${className} .module.boxed ol,
      .${className} .module.highlighted li,
      .${className} .module.highlighted ul,
      .${className} .module.highlighted ol {
        color: ${lightSurfaceTokens.text} !important;
      }
      
      /* Boxed border color */
      .${className} .module.boxed {
        border-color: ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'} !important;
      }
    `;
    }).join('\n');
  }, [variableMap, isLightColor, resolveVarReferences]);

  // Combine all custom CSS file contents for injection
  const customCssFilesContent = useMemo(() => {
    if (!customCssFiles || customCssFiles.length === 0) return '';
    return customCssFiles.map(file => `/* ${file.name} */\n${file.content}`).join('\n\n');
  }, [customCssFiles]);

  const customCssContent = useMemo(() => {
    return `
      /* Font-face declarations */
      ${fontCss}
      
      /* Custom CSS files (fonts, etc.) */
      ${customCssFilesContent}
      
      :root, html, body {
        ${cssVariablesImportant}
      }
      
      /* Global pre-heading override - ensures template uses our variable */
      .pre-heading,
      span.pre-heading,
      p.pre-heading,
      div.pre-heading,
      .module .pre-heading,
      .text .pre-heading,
      .introduction .pre-heading,
      .module > .text > .pre-heading,
      [class*="pre-heading"] {
        color: var(--pre-heading-color) !important;
      }
      
      /* Navigation border overrides - exclude service navigation */
      .nav-main,
      nav.nav-main,
      .navigation-main,
      .header-navigation,
      .main-navigation,
      header nav:not(.service-navigation):not(.service-nav):not(.nav-service) {
        border-top: var(--nav-main-border-top) !important;
        border-bottom: var(--nav-main-border-bottom) !important;
      }
      
      /* Ensure service navigation doesn't inherit main nav borders */
      .service-navigation,
      .service-nav,
      .nav-service,
      .service-links {
        border-top: none !important;
        border-bottom: none !important;
      }
      
      /* Surface overrides for bg-color-* classes */
      ${surfaceOverrides}
    `;
  }, [cssVariablesImportant, surfaceOverrides, customCssFilesContent, fontCss]);

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
        { id: 'button-outline', name: 'Outline Button', selectors: ['.btn-outline', '.button-outline', '.btn-bordered'], variables: ['--button-universal-padding', '--button-universal-text-transform', '--button-universal-font-size', '--button-universal-font-weight', '--button-universal-font-family', '--button-universal-border-radius', '--button-outline-border-size', '--button-outline-color', '--button-outline-border-color'] },
        { id: 'button-primary', name: 'Primary Button', selectors: ['.btn-primary', '.button-primary'], variables: ['--button-universal-padding', '--button-universal-text-transform', '--button-universal-font-size', '--button-universal-font-weight', '--button-universal-font-family', '--button-universal-border-radius', '--button-background-color', '--button-color'] },
        { id: 'button-secondary', name: 'Secondary Button', selectors: ['.btn-secondary', '.button-secondary'], variables: ['--button-universal-padding', '--button-universal-text-transform', '--button-universal-font-size', '--button-universal-font-weight', '--button-universal-font-family', '--button-universal-border-radius', '--button-secondary-background-color', '--button-secondary-color'] },
        { id: 'button-alternate', name: 'Alternate Button', selectors: ['.btn-alternate', '.button-alternate', '.btn-alt'], variables: ['--button-universal-padding', '--button-universal-text-transform', '--button-universal-font-size', '--button-universal-font-weight', '--button-universal-font-family', '--button-universal-border-radius', '--button-alternate-background-color', '--button-alternate-color'] },
        { id: 'button-text', name: 'Text Button', selectors: ['.btn-text', '.button-text', '.btn-link'], variables: ['--button-universal-padding', '--button-universal-text-transform', '--button-universal-font-size', '--button-universal-font-weight', '--button-universal-font-family', '--button-text-color'] },
        { id: 'button', name: 'Button (Generic)', selectors: ['button', '.btn', '.button'], variables: ['--button-universal-padding', '--button-universal-text-transform', '--button-universal-font-size', '--button-universal-font-weight', '--button-universal-font-family', '--button-universal-border-radius', '--button-background-color', '--button-color'] },
        { id: 'link', name: 'Link', selectors: ['a'], variables: ['--link-style', '--link-color'] },
        { id: 'nav-main', name: 'Main Navigation', selectors: ['.nav-main', '.main-nav', '.navigation-main', '.main-navigation', '.header-navigation'], variables: ['--nav-main-align', '--nav-main-background-color', '--nav-main-container-background-color', '--nav-main-container-padding-inline', '--nav-main-border-top', '--nav-main-border-bottom', '--nav-main-active-state-height', '--nav-main-active-state-color', '--nav-main-font-family', '--nav-main-link-gap', '--nav-main-link-padding', '--nav-main-link-font-size', '--nav-main-link-font-weight', '--nav-main-link-text-transform', '--nav-main-link-color'] },
        { id: 'header', name: 'Header', selectors: ['header', '.header', '.site-header'], variables: ['--header-container-padding', '--header-background-color'] },
        { id: 'footer', name: 'Footer', selectors: ['footer', '.footer', '.site-footer'], variables: ['--footer-background-color', '--footer-heading-font-size', '--footer-heading-text-transform', '--footer-heading-font-family', '--footer-heading-font-weight'] },
        { id: 'label', name: 'Label / Badge', selectors: ['.label', '.badge', '.tag', '.chip'], variables: ['--label-border-radius', '--label-text-transform', '--label-font-family', '--label-font-weight', '--label-padding', '--label-background', '--label-color', '--label-border-color'] },
        { id: 'icon', name: 'Icon', selectors: ['.icon', 'i', 'svg'], variables: ['--icon-default-font-family', '--icon-default-font-size', '--icon-font-weight', '--icon-small-font-size', '--icon-background-size', '--icon-background-border-radius', '--icon-background-color', '--icon-color'] },
        { id: 'form', name: 'Form Field', selectors: ['input', 'textarea', 'select', '.form-control', '.input'], variables: ['--form-field-height', '--universal-border-radius'] },
        { id: 'hero', name: 'Hero Section', selectors: ['.hero', '.banner', '.jumbotron'], variables: ['--hero-ratio-full-width', '--hero-ratio-desktop', '--hero-ratio-mobile', '--hero-h1-font-size', '--hero-h1-line-height', '--hero-h2-font-size', '--hero-h2-line-height'] },
        { id: 'card', name: 'Card / Box', selectors: ['.card', '.box', '.module', '.boxed', '.highlighted'], variables: ['--universal-border-radius', '--boxed-border-width', '--boxed-border-color', '--highlighted-box-shadow', '--grid-box-padding', '--grid-box-padding-mobile'] },
        { id: 'nav-service', name: 'Service Navigation', selectors: ['.service-navigation', '.nav-service', '.service-nav', '.service-links'], variables: ['--service-color', '--service-font-weight', '--service-font-family', '--service-font-size', '--service-text-transform'] },
        { id: 'search', name: 'Search', selectors: ['.search-btn', '.search-button', '.search', '[type="search"]', '.search-form', '.site-search'], variables: ['--search-btn-border-radius', '--search-btn-background-color', '--search-btn-background-color-hover', '--search-text-color', '--search-text-color-hover', '--search-icon-color', '--search-icon-color-hover'] },
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
        'button': ['--button-background-color-bg-dark', '--button-font-color-bg-dark', '--button-outline-border-color-bg-dark', '--button-outline-font-color-bg-dark', '--button-alternate-background-color-bg-dark', '--button-alternate-font-color-bg-dark'],
        'button-primary': ['--button-background-color-bg-dark', '--button-font-color-bg-dark'],
        'button-outline': ['--button-outline-border-color-bg-dark', '--button-outline-font-color-bg-dark'],
        'button-alternate': ['--button-alternate-background-color-bg-dark', '--button-alternate-font-color-bg-dark'],
        'button-secondary': ['--button-background-color-bg-dark', '--button-font-color-bg-dark'],
        'button-text': ['--button-font-color-bg-dark'],
        'label': ['--label-background-bg-dark', '--label-color-bg-dark', '--label-border-bg-dark'],
        'icon': ['--icon-background-color-bg-dark', '--icon-color-bg-dark'],
        'card': ['--boxed-border-color-bg-dark', '--module-heading-border-color-bg-dark'],
      };
      const universalDarkBgVars = ['--universal-accent-color-on-bg-dark'];

      function isOnDarkSurface(el) {
        let current = el;
        while (current && current !== document.body && current !== document.documentElement) {
          const classList = Array.from(current.classList || []);
          const hasBgColorClass = classList.some(c => /^bg-color-[a-g]$/.test(c));
          if (hasBgColorClass) {
            const bg = getComputedStyle(current).backgroundColor;
            const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
              const r = parseInt(match[1]) / 255;
              const g = parseInt(match[2]) / 255;
              const b = parseInt(match[3]) / 255;
              const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
              return luminance < 0.5;
            }
            return true;
          }
          current = current.parentElement;
        }
        return false;
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
        const onDark = isOnDarkSurface(element);
        if (!onDark) return mapping;

        const extraVars = darkBgVarMap[mapping.id] || [];
        const allExtra = [...extraVars, ...universalDarkBgVars];
        if (allExtra.length === 0) return mapping;

        return {
          id: mapping.id,
          name: mapping.name + ' (Dark Surface)',
          selectors: mapping.selectors,
          variables: [...mapping.variables, ...allExtra],
        };
      }
      
      let hoveredElement = null;
      
      document.addEventListener('mouseover', function(e) {
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
        if (hoveredElement) {
          hoveredElement.style.outline = '';
          hoveredElement.style.outlineOffset = '';
          hoveredElement.style.cursor = '';
          hoveredElement = null;
        }
      }, true);
      
      document.addEventListener('click', function(e) {
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
    const styleTag = `<style id="custom-variables"></style>${inspectorScript}`;
    
    let cleanedHtml = baseHtml.replace(/<style id="custom-variables">[\s\S]*?<\/style>/g, '');
    cleanedHtml = cleanedHtml.replace(/<script id="inspector-script">[\s\S]*?<\/script>/g, '');
    cleanedHtml = cleanedHtml.replace(/<style id="inspector-styles">[\s\S]*?<\/style>/g, '');
    
    if (cleanedHtml.includes('</body>')) {
      return cleanedHtml.replace('</body>', `${styleTag}</body>`);
    }
    
    if (cleanedHtml.includes('</html>')) {
      return cleanedHtml.replace('</html>', `${styleTag}</html>`);
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
      
      if (inspectorMode) {
        // Inject inspector script
        const scriptEl = iframeDoc.createElement('script');
        scriptEl.id = 'inspector-script';
        scriptEl.textContent = inspectorScript.replace(/<script id="inspector-script">|<\/script>|<style id="inspector-styles">[\s\S]*?<\/style>/g, '');
        
        const styleEl = iframeDoc.createElement('style');
        styleEl.id = 'inspector-styles';
        styleEl.textContent = '* { cursor: default !important; }';
        
        if (iframeDoc.body) {
          iframeDoc.body.appendChild(scriptEl);
          iframeDoc.body.appendChild(styleEl);
        }
      }
    } catch (e) {
      console.warn('Could not update inspector script dynamically:', e);
    }
  }, [inspectorMode, iframeLoaded, inspectorScript]);

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
      </div>

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
