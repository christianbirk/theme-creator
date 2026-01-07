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
        const text = getUserValueOrDefault('--font-base-color-bg-light', neutralDark);
        const heading = getUserValueOrDefault('--font-heading-color-bg-light', neutralDark);
        const preHeading = getUserValueOrDefault('--pre-heading-color-bg-light', neutralDark);
        const lead = getUserValueOrDefault('--lead-color-bg-light', neutralDark);
        const link = getUserValueOrDefault('--link-color-bg-light', brandPrimary);
        const accent = getUserValueOrDefault('--universal-accent-color-on-bg-light', brandPrimary);
        // Buttons on light bg
        const btnBg = getUserValueOrDefault('--button-background-color-bg-light', isBrandDark ? brandPrimary : neutralDark);
        const btnFg = getUserValueOrDefault('--button-font-color-bg-light', isLightColor(btnBg) ? neutralDark : neutralLight);
        const btnOutlineFg = getUserValueOrDefault('--button-outline-font-color-bg-light', neutralDark);
        const btnOutlineBorder = getUserValueOrDefault('--button-outline-border-color-bg-light', neutralDark);
        // Alternate buttons
        const btnAltBg = getUserValueOrDefault('--button-alternate-background-color-bg-light', btnBg);
        const btnAltFg = getUserValueOrDefault('--button-alternate-font-color-bg-light', btnFg);
        // Icons
        const iconBg = getUserValueOrDefault('--icon-background-color-bg-light', btnBg);
        const iconFg = getUserValueOrDefault('--icon-color-bg-light', btnFg);
        // Labels
        const labelBg = getUserValueOrDefault('--label-background-bg-light', neutralDark);
        const labelFg = getUserValueOrDefault('--label-color-bg-light', neutralLight);
        const labelBorder = getUserValueOrDefault('--label-border-bg-light', neutralDark);
        // Borders
        const boxedBorder = getUserValueOrDefault('--boxed-border-color-bg-light', 'transparent');
        const moduleHeadingBorder = getUserValueOrDefault('--module-heading-border-color-bg-light', neutralDark);
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
      
      /* Pre-headings */
      .${className} .pre-heading,
      .${className} .module .pre-heading,
      .${className} [class*="pre-heading"] {
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
        background-color: ${toneVars.btnBg} !important;
        color: ${toneVars.btnFg} !important;
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
        background-color: ${lightSurfaceTokens.btnBg} !important;
        color: ${lightSurfaceTokens.btnFg} !important;
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
            sandbox="allow-same-origin allow-scripts"
            data-testid="preview-iframe"
          />
        </div>
      </div>
    </div>
  );
}

export default PreviewPane;
