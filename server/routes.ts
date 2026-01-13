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
      const value = cssMatch[2].trim();
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

      // Fetch the HTML
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Theme-Customizer-Preview/1.0',
            'Accept': 'text/html,application/xhtml+xml,*/*',
          },
          signal: controller.signal,
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

        const html = await response.text();

        // Limit response size (5MB)
        if (html.length > 5 * 1024 * 1024) {
          return res.status(400).json({ error: 'Response too large (max 5MB)' });
        }

        res.json({
          success: true,
          html,
          url: parsedUrl.origin + parsedUrl.pathname,
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

  return httpServer;
}
