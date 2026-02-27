import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as sass from 'sass';
import * as fs from 'fs';
import * as path from 'path';
import type { CssClass, CssClassGroup, CssClassesData } from "@shared/schema";

interface CSSVariable {
  name: string;
  value: string;
  defaultValue: string;
  type: 'color' | 'font' | 'size' | 'number' | 'string';
  category: string;
  mainSection: string;
  subSection: string;
  description?: string;
}

function detectVariableType(name: string, value: string): CSSVariable['type'] {
  const lowerName = name.toLowerCase();
  const lowerValue = value.toLowerCase();

  // Check for font-family first (before other checks)
  // Match both '--font-family' patterns AND '--font-*-family' patterns (like --font-base-family, --font-heading-family)
  if (lowerName.includes('font-family') || lowerName.includes('font-sans') || 
      lowerName.includes('font-serif') || lowerName.includes('font-mono') ||
      (lowerName.includes('-family') && lowerName.includes('font'))) {
    return 'font';
  }

  // Check for line-height BEFORE size (since 'height' is a substring)
  if (lowerValue.match(/^[\d.]+$/) || 
      lowerName.includes('weight') || lowerName.includes('line-height') ||
      lowerName.includes('opacity') || lowerName.includes('z-index')) {
    return 'number';
  }

  // Check for size BEFORE color (so --icon-background-size is 'size' not 'color')
  // Also handles: --icon-background-border-radius, --button-outline-border-size
  if (lowerValue.match(/^[\d.]+\s*(px|rem|em|%|vh|vw|pt|cm|mm|in)$/i) ||
      lowerName.includes('size') || lowerName.includes('spacing') ||
      lowerName.includes('radius') || lowerName.includes('width') ||
      (lowerName.includes('height') && !lowerName.includes('line-height')) || 
      lowerName.includes('padding') ||
      lowerName.includes('margin') || lowerName.includes('gap')) {
    return 'size';
  }

  // Check for color types - now AFTER size check
  if (lowerValue.match(/^#[0-9a-f]{3,8}$/i) || 
      lowerValue.match(/^rgba?\s*\(/) || 
      lowerValue.match(/^hsla?\s*\(/) ||
      lowerName.includes('color') ||
      lowerName.includes('background') ||
      lowerName.includes('foreground') ||
      (lowerName.includes('border') && !lowerName.includes('radius') && !lowerName.includes('width') && !lowerName.includes('size'))) {
    return 'color';
  }

  return 'string';
}

function categorizeVariable(name: string): string {
  const lowerName = name.toLowerCase();

  // Identity/Brand Colors
  if (lowerName.includes('color-brand') || lowerName.includes('primary') ||
      lowerName.includes('accent') || lowerName.includes('universal-accent')) {
    return 'brand-colors';
  }

  // Neutral Colors
  if (lowerName.includes('color-neutral') || lowerName.includes('main-bg') ||
      lowerName.includes('body-bg')) {
    return 'neutral-colors';
  }

  // Dark Background Tones
  if (lowerName.includes('-bg-dark') || lowerName.includes('on-bg-dark')) {
    return 'dark-bg-tones';
  }

  // Light Background Tones (color combinations for light backgrounds)
  if ((lowerName.includes('button') && (lowerName.includes('background') || lowerName.includes('color'))) ||
      lowerName.includes('icon-background') || lowerName.includes('icon-color') ||
      lowerName.includes('label-background') || lowerName.includes('label-color') ||
      lowerName.includes('link-color') || lowerName.includes('font-base-color') ||
      lowerName.includes('font-heading-color') || lowerName.includes('lead-color') ||
      lowerName.includes('pre-heading-color') || lowerName.includes('boxed-border') ||
      lowerName.includes('module-heading-border') || lowerName.includes('universal-accent-color')) {
    return 'light-bg-tones';
  }

  // Typography
  if (lowerName.includes('font') || lowerName.includes('text-transform') ||
      lowerName.includes('line-height') || lowerName.includes('hyphens') ||
      lowerName.includes('lead-') || lowerName.includes('pre-heading')) {
    return 'typography';
  }

  // Layout & Spacing
  if (lowerName.includes('grid') || lowerName.includes('spacing') ||
      lowerName.includes('gutter') || lowerName.includes('padding') ||
      lowerName.includes('margin') || lowerName.includes('gap') ||
      lowerName.includes('container')) {
    return 'layout';
  }

  // Borders & Radius
  if (lowerName.includes('radius') || lowerName.includes('border-width') ||
      lowerName.includes('boxed-border')) {
    return 'borders';
  }

  // Shadows
  if (lowerName.includes('shadow')) {
    return 'shadows';
  }

  // Header, Footer, Body
  if (lowerName.includes('header') || lowerName.includes('footer')) {
    return 'header-footer';
  }

  // Navigation
  if (lowerName.includes('nav') || lowerName.includes('breadcrumb') ||
      lowerName.includes('menu') || lowerName.includes('service-') ||
      lowerName.includes('burger')) {
    return 'navigation';
  }

  // Search
  if (lowerName.includes('search')) {
    return 'search';
  }

  // Buttons
  if (lowerName.includes('button') || lowerName.includes('btn') ||
      lowerName.includes('link-arrow')) {
    return 'buttons';
  }

  // Icons
  if (lowerName.includes('icon')) {
    return 'icons';
  }

  // Labels
  if (lowerName.includes('label')) {
    return 'labels';
  }

  // Forms
  if (lowerName.includes('form') || lowerName.includes('input')) {
    return 'forms';
  }

  // Aspect Ratios (hero typography moved to typography section)
  if (lowerName.includes('aspect-ratio') || lowerName.includes('ratio')) {
    return 'aspect-ratios';
  }

  // Transitions
  if (lowerName.includes('transition') || lowerName.includes('duration') ||
      lowerName.includes('easing') || lowerName.includes('animation')) {
    return 'transitions';
  }

  return 'other';
}

function parseScssVariables(content: string): CSSVariable[] {
  const variables: CSSVariable[] = [];
  const lines = content.split('\n');
  
  // First pass: Build a map of SCSS variables for interpolation resolution
  const scssVarMap = new Map<string, string>();
  const scssVarRegexForMap = /^\s*\$([a-zA-Z0-9_-]+)\s*:\s*([^;!]+)/;
  for (const line of lines) {
    const match = line.match(scssVarRegexForMap);
    if (match) {
      scssVarMap.set(match[1], match[2].trim());
    }
  }
  
  // Helper function to resolve SCSS interpolation like #{$variable-name}
  function resolveScssInterpolation(value: string): string {
    return value.replace(/#\{\$([a-zA-Z0-9_-]+)\}/g, (_, varName) => {
      return scssVarMap.get(varName) || `#{$${varName}}`;
    });
  }
  
  let currentMainSection = 'other';
  let currentSubSection = 'general';
  
  // Regex patterns for section detection
  const mainSectionRegex = /\/\*\s*---\s*(.+?)\s*---\s*\*\//;
  const subSectionRegex = /\/\*\s*([^-][^*]+[^-])\s*\*\//;
  const slashSubSectionRegex = /\/\/+\s*$/; // Lines with just slashes like ////////////////////////////
  const cssVarRegex = /^\s*--([a-zA-Z0-9_-]+)\s*:\s*(.*?)\s*;/;
  const scssVarRegex = /^\s*\$([a-zA-Z0-9_-]+)\s*:\s*([^;!]+)/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for main section comment like /* --- Typography --- */
    const mainMatch = line.match(mainSectionRegex);
    if (mainMatch) {
      currentMainSection = mainMatch[1].trim().toLowerCase().replace(/\s+/g, '-');
      currentSubSection = 'general'; // Reset subsection when entering new main section
      continue;
    }
    
    // Skip slash-only lines
    if (slashSubSectionRegex.test(line.trim())) {
      continue;
    }
    
    // Check for subsection comment like /* Light Background Tones */
    const subMatch = line.match(subSectionRegex);
    if (subMatch && !line.includes('---')) {
      const subText = subMatch[1].trim();
      if (subText && !subText.startsWith('set to') && subText.length > 2) {
        currentSubSection = subText.toLowerCase().replace(/\s+/g, '-');
      }
      continue;
    }
    
    // Parse CSS variable
    const cssMatch = line.match(cssVarRegex);
    if (cssMatch) {
      const name = `--${cssMatch[1]}`;
      let value = cssMatch[2].trim();
      
      // Resolve SCSS interpolation like #{$color-brand-a} to actual value
      value = resolveScssInterpolation(value);
      
      const type = detectVariableType(name, value);
      
      variables.push({
        name,
        value,
        defaultValue: value,
        type,
        category: currentSubSection,
        mainSection: currentMainSection,
        subSection: currentSubSection,
      });
      continue;
    }
    
    // Parse SCSS variable
    const scssMatch = line.match(scssVarRegex);
    if (scssMatch) {
      const name = `--${scssMatch[1]}`;
      const value = scssMatch[2].trim();
      const type = detectVariableType(name, value);
      
      if (!variables.find(v => v.name === name)) {
        variables.push({
          name,
          value,
          defaultValue: value,
          type,
          category: currentSubSection,
          mainSection: currentMainSection,
          subSection: currentSubSection,
        });
      }
    }
  }

  // Post-process: Move hero typography variables (font-size, line-height) to typography section under "Hero Module" subsection
  for (const variable of variables) {
    const lowerName = variable.name.toLowerCase();
    if (lowerName.includes('hero') && 
        (lowerName.includes('font') || lowerName.includes('line-height'))) {
      variable.mainSection = 'typography';
      variable.subSection = 'hero-module';
    }
  }

  // Post-process: Rename "hero-and-ratios" or similar mainSection to "aspect-ratios"
  for (const variable of variables) {
    if (variable.mainSection === 'hero-and-ratios' || 
        variable.mainSection === 'hero-ratios' ||
        variable.mainSection === 'hero-&-ratios') {
      variable.mainSection = 'aspect-ratios';
    }
  }

  // Post-process: Rename "layout-and-spacing" to "layout"
  for (const variable of variables) {
    if (variable.mainSection === 'layout-and-spacing') {
      variable.mainSection = 'layout';
    }
  }

  // Post-process: Move "alternate-module-heading" subsection to "typography" mainSection
  for (const variable of variables) {
    if (variable.subSection === 'alternate-module-heading') {
      variable.mainSection = 'typography';
    }
  }

  // Post-process: Make "grid" subsection a parent section
  for (const variable of variables) {
    if (variable.subSection === 'grid') {
      variable.mainSection = 'grid';
    }
  }

  // Post-process: Flatten single-child sections by matching subsection ID to mainSection ID
  // This allows the UI to render without redundant nested accordions
  for (const variable of variables) {
    if (variable.subSection === 'icon-settings' && variable.mainSection === 'icons') {
      variable.subSection = 'icons';
    }
    if (variable.subSection === 'label-settings' && variable.mainSection === 'labels') {
      variable.subSection = 'labels';
    }
    if (variable.subSection === 'form-settings' && variable.mainSection === 'forms') {
      variable.subSection = 'forms';
    }
  }

  return variables;
}

// Parse styles.xml content into CssClassesData
function parseStylesXml(content: string): CssClassesData {
  const groups: CssClassGroup[] = [];
  
  // Match all group elements
  const groupRegex = /<group\s+([^>]*)>([\s\S]*?)<\/group>/g;
  let groupMatch;
  
  while ((groupMatch = groupRegex.exec(content)) !== null) {
    const attrsStr = groupMatch[1];
    const groupContent = groupMatch[2];
    
    // Parse group attributes
    const nameMatch = attrsStr.match(/name="([^"]*)"/);
    const modeMatch = attrsStr.match(/mode="([^"]*)"/);
    const allowLinksMatch = attrsStr.match(/allowLinks="([^"]*)"/);
    
    const group: CssClassGroup = {
      name: nameMatch ? nameMatch[1] : '',
      classes: []
    };
    
    if (modeMatch) group.mode = modeMatch[1];
    if (allowLinksMatch) group.allowLinks = allowLinksMatch[1];
    
    // Parse class elements within this group
    const classRegex = /<class\s+([^>]*)>([^<]*)<\/class>/g;
    let classMatch;
    
    while ((classMatch = classRegex.exec(groupContent)) !== null) {
      const classAttrsStr = classMatch[1];
      const className = classMatch[2].trim();
      
      const classNameMatch = classAttrsStr.match(/name="([^"]*)"/);
      const allowMatch = classAttrsStr.match(/allow="([^"]*)"/);
      const denyMatch = classAttrsStr.match(/deny="([^"]*)"/);
      
      const cssClass: CssClass = {
        name: classNameMatch ? classNameMatch[1] : '',
        className: className
      };
      
      if (allowMatch) cssClass.allow = allowMatch[1];
      if (denyMatch) cssClass.deny = denyMatch[1];
      
      group.classes.push(cssClass);
    }
    
    groups.push(group);
  }
  
  return { groups };
}

// Generate styles.xml content from CssClassesData
function generateStylesXml(data: CssClassesData): string {
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n<style>\n  <classes>\n';
  
  for (const group of data.groups) {
    let groupAttrs = `name="${escapeXml(group.name)}"`;
    if (group.mode) groupAttrs += ` mode="${escapeXml(group.mode)}"`;
    if (group.allowLinks) groupAttrs += ` allowLinks="${escapeXml(group.allowLinks)}"`;
    
    xml += `    <group ${groupAttrs}>\n`;
    
    for (const cls of group.classes) {
      let classAttrs = `name="${escapeXml(cls.name)}"`;
      if (cls.allow) classAttrs += ` allow="${escapeXml(cls.allow)}"`;
      if (cls.deny) classAttrs += ` deny="${escapeXml(cls.deny)}"`;
      
      xml += `      <class ${classAttrs}>${escapeXml(cls.className)}</class>\n`;
    }
    
    xml += `    </group>\n`;
  }
  
  xml += '  </classes>\n</style>\n';
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateCss(variables: CSSVariable[], baseScss?: string): string {
  const cssVarsBlock = variables
    .map(v => `  ${v.name}: ${v.value};`)
    .join('\n');

  const modifiedCount = variables.filter(v => v.value !== v.defaultValue).length;

  let css = `/* Theme CSS
 * Generated by Theme Customizer
 * Modified variables: ${modifiedCount}/${variables.length}
 * Generated at: ${new Date().toISOString()}
 */

:root {
${cssVarsBlock}
}
`;

  if (baseScss) {
    try {
      const variableDeclarations = variables
        .map(v => `$${v.name.replace('--', '')}: ${v.value};`)
        .join('\n');

      const scssWithOverrides = variableDeclarations + '\n\n' + baseScss;

      const result = sass.compileString(scssWithOverrides, {
        style: 'expanded',
      });

      css += '\n/* Compiled from base SCSS */\n' + result.css;
    } catch (err) {
      console.error('SCSS compilation error:', err);
    }
  }

  return css;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post('/api/parse-scss', async (req, res) => {
    try {
      const { content } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Content is required' });
      }

      const variables = parseScssVariables(content);
      
      res.json({ 
        success: true, 
        variables,
        count: variables.length 
      });
    } catch (err) {
      console.error('Parse SCSS error:', err);
      res.status(500).json({ error: 'Failed to parse SCSS content' });
    }
  });

  app.post('/api/compile-theme', async (req, res) => {
    try {
      const { variables, baseScss } = req.body;
      
      if (!variables || !Array.isArray(variables)) {
        return res.status(400).json({ error: 'Variables array is required' });
      }

      const css = generateCss(variables, baseScss);
      
      res.json({ 
        success: true, 
        css,
        lineCount: css.split('\n').length
      });
    } catch (err) {
      console.error('Compile theme error:', err);
      res.status(500).json({ error: 'Failed to compile theme' });
    }
  });

  app.post('/api/fetch-preview', async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      // Only allow http/https
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are allowed' });
      }

      // SSRF Protection: Block private/internal IP ranges and localhost
      const hostname = parsedUrl.hostname.toLowerCase();
      const blockedPatterns = [
        /^localhost$/i,
        /^127\.\d+\.\d+\.\d+$/,          // 127.x.x.x
        /^10\.\d+\.\d+\.\d+$/,           // 10.x.x.x
        /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // 172.16.x.x - 172.31.x.x
        /^192\.168\.\d+\.\d+$/,          // 192.168.x.x
        /^0\.0\.0\.0$/,
        /^::1$/,                          // IPv6 localhost
        /^\[::1\]$/,
        /^fc00:/i,                        // IPv6 private
        /^fe80:/i,                        // IPv6 link-local
        /^169\.254\.\d+\.\d+$/,          // Link-local
        /\.local$/i,                      // .local domains
        /\.internal$/i,
      ];
      
      if (blockedPatterns.some(pattern => pattern.test(hostname))) {
        return res.status(403).json({ error: 'Access to internal/private addresses is not allowed' });
      }

      // Fetch the HTML
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Theme-Customizer-Preview/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          signal: controller.signal,
          redirect: 'follow',
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return res.status(response.status).json({ 
            error: `Failed to fetch: ${response.statusText}` 
          });
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
          return res.status(400).json({ error: 'URL does not return HTML content' });
        }

        let html = await response.text();

        // Limit response size (5MB)
        if (html.length > 5 * 1024 * 1024) {
          return res.status(400).json({ error: 'Response too large (max 5MB)' });
        }

        // Get the base URL for rewriting relative URLs
        const baseUrl = parsedUrl.origin;
        const basePath = parsedUrl.pathname.replace(/\/[^\/]*$/, '/') || '/';

        // HTML Sanitization: Remove potentially dangerous elements
        // Extract GoBasic script URLs before removing scripts (trusted domain)
        const goBasicScriptUrls: string[] = [];
        const scriptSrcRegex = /<script\b[^>]*src=["']([^"']*poc\.media\.gopublic\.eu[^"']*)["'][^>]*>\s*<\/script>/gi;
        let scriptMatch;
        while ((scriptMatch = scriptSrcRegex.exec(html)) !== null) {
          goBasicScriptUrls.push(scriptMatch[1]);
        }
        
        // Remove <script> tags and their content
        html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // Remove inline event handlers (onclick, onload, onerror, etc.)
        html = html.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
        html = html.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');
        
        // Remove javascript: URLs in href/src attributes
        html = html.replace(/(href|src)\s*=\s*["']javascript:[^"']*["']/gi, '$1=""');
        
        // Remove <iframe> tags (could load external content)
        html = html.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
        html = html.replace(/<iframe\b[^>]*\/>/gi, '');
        
        // Remove <object>, <embed>, <applet> tags
        html = html.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
        html = html.replace(/<embed\b[^>]*\/?>/gi, '');
        html = html.replace(/<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi, '');
        
        // Remove <form> action attributes to prevent form submission
        html = html.replace(/<form\b([^>]*)>/gi, (match, attrs) => {
          attrs = attrs.replace(/action\s*=\s*["'][^"']*["']/gi, 'action="#"');
          attrs = attrs.replace(/action\s*=\s*[^\s>]*/gi, 'action="#"');
          return `<form${attrs}>`;
        });
        
        // Remove meta refresh/redirect
        html = html.replace(/<meta\s+[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, '');

        // URL Rewriting: Convert relative URLs to absolute
        const rewriteUrl = (originalUrl: string): string => {
          if (!originalUrl || originalUrl.startsWith('data:') || originalUrl.startsWith('#')) {
            return originalUrl;
          }
          if (originalUrl.startsWith('//')) {
            return `https:${originalUrl}`;
          }
          if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
            return originalUrl;
          }
          if (originalUrl.startsWith('/')) {
            return `${baseUrl}${originalUrl}`;
          }
          return `${baseUrl}${basePath}${originalUrl}`;
        };

        // Rewrite src attributes (images, scripts are removed but stylesheets, etc.)
        html = html.replace(/(src\s*=\s*["'])([^"']+)(["'])/gi, (match, prefix, url, suffix) => {
          return `${prefix}${rewriteUrl(url)}${suffix}`;
        });

        // Rewrite href attributes (links, stylesheets)
        html = html.replace(/(href\s*=\s*["'])([^"']+)(["'])/gi, (match, prefix, url, suffix) => {
          return `${prefix}${rewriteUrl(url)}${suffix}`;
        });

        // Rewrite srcset attributes (responsive images)
        html = html.replace(/(srcset\s*=\s*["'])([^"']+)(["'])/gi, (match, prefix, srcset, suffix) => {
          const rewritten = srcset.split(',').map((entry: string) => {
            const parts = entry.trim().split(/\s+/);
            if (parts[0]) {
              parts[0] = rewriteUrl(parts[0]);
            }
            return parts.join(' ');
          }).join(', ');
          return `${prefix}${rewritten}${suffix}`;
        });

        // Rewrite url() in style attributes (handles multiple url() calls and HTML-encoded quotes)
        html = html.replace(/(style\s*=\s*["'])([^"']*)(["'])/gi, (match, prefix, styleContent, suffix) => {
          // Handle both regular quotes and HTML-encoded quotes (&#x27; &#39; &apos; for single, &#x22; &quot; for double)
          const rewrittenStyle = styleContent.replace(/url\s*\(\s*(?:["']|&#x27;|&#39;|&apos;|&#x22;|&quot;)?([^"')&#]+)(?:["']|&#x27;|&#39;|&apos;|&#x22;|&quot;)?\s*\)/gi, 
            (urlMatch: string, url: string) => {
              return `url('${rewriteUrl(url)}')`;
            }
          );
          return `${prefix}${rewrittenStyle}${suffix}`;
        });
        
        // Rewrite url() in inline <style> blocks
        html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (match, openTag, cssContent, closeTag) => {
          const rewrittenCss = cssContent.replace(/url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi,
            (urlMatch: string, url: string) => {
              return `url('${rewriteUrl(url)}')`;
            }
          );
          return `${openTag}${rewrittenCss}${closeTag}`;
        });

        // Add <base> tag to handle any remaining relative URLs
        if (!html.includes('<base')) {
          html = html.replace(/(<head[^>]*>)/i, `$1\n<base href="${baseUrl}${basePath}" target="_self">`);
        }

        // Fetch and inline GoBasic scripts (trusted domain only)
        if (goBasicScriptUrls.length > 0) {
          const inlinedScripts = await Promise.all(
            goBasicScriptUrls.map(async (scriptUrl) => {
              try {
                let fullUrl = scriptUrl;
                if (fullUrl.startsWith('//')) fullUrl = 'https:' + fullUrl;
                else if (!fullUrl.startsWith('http')) fullUrl = baseUrl + scriptUrl;
                
                const jsResp = await fetch(fullUrl, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Theme-Customizer/1.0)' },
                  signal: AbortSignal.timeout(8000),
                });
                if (jsResp.ok) {
                  let code = await jsResp.text();
                  code = code.replace(/<\/(script|body|html|style)/gi, '<\\/$1');
                  return `<script>try{${code}}catch(e){console.warn('GoBasic script error:',e)}<\/script>`;
                }
              } catch (e) {
                console.warn(`Failed to fetch GoBasic script: ${scriptUrl}`, e);
              }
              return '';
            })
          );
          const scriptBlock = inlinedScripts.filter(Boolean).join('\n');
          // Re-initialize hero sections after all images load (offsetHeight needs rendered elements)
          const heroReinit = `<script>
window.addEventListener('load', function() {
  document.querySelectorAll('.hero.text-in-box-overlapping').forEach(function(e) {
    var t = e.querySelector('.text > .wrap');
    if (!t) return;
    var n = t.offsetHeight;
    if (window.innerWidth >= 1024) {
      t.style.top = n / 2 + 'px';
      e.style.marginBottom = n / 2 + 32 + 'px';
    } else if (window.innerWidth >= 767) {
      t.style.top = n / 1.5 + 'px';
      e.style.marginBottom = n / 1.5 + 32 + 'px';
    }
  });
  document.querySelectorAll('.hero.split-box').forEach(function(e) {
    var v = e.querySelector('video');
    var txt = e.querySelector('.text');
    if (v && txt) v.style.height = txt.offsetHeight + 'px';
  });
});
<\/script>`;
          if (scriptBlock) {
            const allScripts = scriptBlock + '\n' + heroReinit;
            const lastBodyIdx = html.lastIndexOf('</body>');
            if (lastBodyIdx !== -1) {
              html = html.slice(0, lastBodyIdx) + `${allScripts}\n` + html.slice(lastBodyIdx);
            } else {
              html += allScripts;
            }
          }
        }

        res.json({
          success: true,
          html,
          url: parsedUrl.origin + parsedUrl.pathname,
          baseUrl,
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          return res.status(408).json({ error: 'Request timeout' });
        }
        throw fetchErr;
      }
    } catch (err) {
      console.error('Fetch preview error:', err);
      res.status(500).json({ error: 'Failed to fetch URL' });
    }
  });

  app.get('/api/proxy-js', async (req, res) => {
    try {
      const { file } = req.query;
      if (!file || typeof file !== 'string') {
        return res.status(400).json({ error: 'File parameter is required' });
      }

      const allowedFiles = [
        'accordionAndTabs.min.js',
        'application.min.js',
        'cookies.min.js',
        'focusVisible.min.js',
        'heroSection.min.js',
        'itemList.min.js',
        'navigation.min.js',
        'popUpFrame.min.js',
      ];

      if (!allowedFiles.includes(file)) {
        return res.status(403).json({ error: 'File not allowed' });
      }

      const url = `https://poc.media.gopublic.eu/GoBasic/Applications/Release/${file}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Theme-Customizer/1.0)',
          'Accept': 'application/javascript,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(response.status).json({ error: `Failed to fetch ${file}` });
      }

      const content = await response.text();
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(content);
    } catch (err) {
      console.error('Proxy JS error:', err);
      res.status(500).json({ error: 'Failed to proxy JS file' });
    }
  });

  app.get('/api/sample-scss', async (req, res) => {
    try {
      const samplePath = path.join(process.cwd(), 'server/sample-scss/variables.scss');
      
      if (fs.existsSync(samplePath)) {
        const content = fs.readFileSync(samplePath, 'utf-8');
        res.json({
          success: true,
          content,
          filename: '_variables.scss'
        });
      } else {
        res.status(404).json({ 
          error: 'Sample SCSS file not found',
          path: samplePath 
        });
      }
    } catch (err) {
      console.error('Read sample SCSS error:', err);
      res.status(500).json({ error: 'Failed to read sample SCSS file' });
    }
  });

  // Load default styles.xml from attached_assets
  app.get('/api/styles-xml', async (req, res) => {
    try {
      const stylesPath = path.join(process.cwd(), 'attached_assets/styles_1768303724198.xml');
      
      if (fs.existsSync(stylesPath)) {
        const content = fs.readFileSync(stylesPath, 'utf-8');
        const data = parseStylesXml(content);
        res.json({
          success: true,
          data,
          groupCount: data.groups.length,
          classCount: data.groups.reduce((acc, g) => acc + g.classes.length, 0)
        });
      } else {
        res.status(404).json({ 
          error: 'Styles XML file not found'
        });
      }
    } catch (err) {
      console.error('Read styles XML error:', err);
      res.status(500).json({ error: 'Failed to read styles XML file' });
    }
  });

  // Parse uploaded styles.xml content
  app.post('/api/parse-styles-xml', async (req, res) => {
    try {
      const { content } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Content is required' });
      }

      const data = parseStylesXml(content);
      res.json({ 
        success: true, 
        data,
        groupCount: data.groups.length,
        classCount: data.groups.reduce((acc, g) => acc + g.classes.length, 0)
      });
    } catch (err) {
      console.error('Parse styles XML error:', err);
      res.status(500).json({ error: 'Failed to parse styles XML content' });
    }
  });

  // Export styles.xml from data
  app.post('/api/export-styles-xml', async (req, res) => {
    try {
      const { data } = req.body;
      
      if (!data || !data.groups || !Array.isArray(data.groups)) {
        return res.status(400).json({ error: 'Valid data with groups array is required' });
      }

      const xml = generateStylesXml(data);
      res.json({ 
        success: true, 
        xml,
        lineCount: xml.split('\n').length
      });
    } catch (err) {
      console.error('Export styles XML error:', err);
      res.status(500).json({ error: 'Failed to export styles XML' });
    }
  });

  // Google Fonts API - fetch complete font list and cache it
  let cachedGoogleFonts: { fonts: string[]; fontsWithMeta: { family: string; category: string }[]; timestamp: number } | null = null;
  const FONT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  async function fetchAndCacheGoogleFonts() {
    if (cachedGoogleFonts && Date.now() - cachedGoogleFonts.timestamp < FONT_CACHE_TTL) {
      return cachedGoogleFonts;
    }

    const response = await fetch('https://fonts.google.com/metadata/fonts');
    if (!response.ok) {
      throw new Error(`Google Fonts API returned ${response.status}`);
    }

    const data = await response.json();
    const fonts: string[] = [];
    const fontsWithMeta: { family: string; category: string }[] = [];

    if (data.familyMetadataList && Array.isArray(data.familyMetadataList)) {
      for (const entry of data.familyMetadataList) {
        if (entry.family) {
          fonts.push(entry.family);
          fontsWithMeta.push({ family: entry.family, category: entry.category || 'sans-serif' });
        }
      }
    }

    fonts.sort((a: string, b: string) => a.localeCompare(b));
    fontsWithMeta.sort((a, b) => a.family.localeCompare(b.family));

    cachedGoogleFonts = { fonts, fontsWithMeta, timestamp: Date.now() };
    return cachedGoogleFonts;
  }

  app.get('/api/google-fonts', async (_req, res) => {
    try {
      const cached = await fetchAndCacheGoogleFonts();
      res.json({ fonts: cached.fonts });
    } catch (err) {
      console.error('Failed to fetch Google Fonts:', err);
      res.status(500).json({ error: 'Failed to fetch Google Fonts list' });
    }
  });

  app.get('/api/google-fonts-metadata', async (_req, res) => {
    try {
      const cached = await fetchAndCacheGoogleFonts();
      res.json({ fonts: cached.fontsWithMeta });
    } catch (err) {
      console.error('Failed to fetch Google Fonts metadata:', err);
      res.status(500).json({ error: 'Failed to fetch Google Fonts list' });
    }
  });

  return httpServer;
}
