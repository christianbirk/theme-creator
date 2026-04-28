import type { Express } from "express";
import { type Server } from "http";
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

// Hostnames that must never be reached by server-side fetches. Used by both
// the main /api/fetch-preview proxy and the secondary CSS compatibility
// probe to prevent SSRF into private/internal networks.
const SSRF_BLOCKED_HOSTNAME_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,                 // 127.x.x.x
  /^10\.\d+\.\d+\.\d+$/,                  // 10.x.x.x
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,  // 172.16.x.x - 172.31.x.x
  /^192\.168\.\d+\.\d+$/,                 // 192.168.x.x
  /^0\.0\.0\.0$/,
  /^::1$/,                                 // IPv6 localhost
  /^\[::1\]$/,
  /^f[cd][0-9a-f]{2}:/i,                  // IPv6 ULA fc00::/7 (covers fc.. and fd..)
  /^fe[89ab][0-9a-f]:/i,                  // IPv6 link-local fe80::/10
  /^169\.254\.\d+\.\d+$/,                 // IPv4 link-local / cloud metadata
  /\.local$/i,
  /\.internal$/i,
];

// Canonical V6 template that ships a working theme.min.css (one that
// uses var(--color-brand-*)). Used to source a "blank theme" for swap.
const BLANK_THEME_SOURCE_URL = 'https://municipality-template.gopublic.dk/';

// In-memory cache for the swap-source CSS. Populated lazily on first use.
// `null` means "not loaded yet"; a string means a successful fetch.
let blankThemeCssCache: string | null = null;
let blankThemeCssInflight: Promise<string | null> | null = null;

// Helper used by the swap-source fetch path. Manually follows up to a
// small number of redirects, re-validating every hop's protocol and
// hostname against the SSRF blocklist. `redirect: 'follow'` is unsafe
// here because the initial URL came from third-party HTML (the canonical
// V6 template page) and a 30x could otherwise land us on an internal
// host. Reads the body in chunks so a CDN that closes the connection
// mid-stream still yields the bytes we already received.
async function fetchUrlText(url: string, timeoutMs: number): Promise<string | null> {
  try {
    let currentUrl = url;
    let resp: Response | null = null;
    const maxHops = 5;
    for (let hop = 0; hop <= maxHops; hop++) {
      let parsed: URL;
      try { parsed = new URL(currentUrl); } catch { return null; }
      if (!['http:', 'https:'].includes(parsed.protocol)) return null;
      if (isBlockedHostname(parsed.hostname)) return null;
      resp = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'manual',
      });
      if (resp.status >= 300 && resp.status < 400) {
        const loc = resp.headers.get('location');
        if (!loc || hop === maxHops) return null;
        try {
          currentUrl = new URL(loc, currentUrl).toString();
        } catch {
          return null;
        }
        continue;
      }
      break;
    }
    if (!resp || !resp.ok) return null;
    let received = '';
    if (resp.body) {
      const reader = resp.body.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const cap = 4 * 1024 * 1024;
      try {
        while (received.length < cap) {
          const { done, value } = await reader.read();
          if (done) break;
          received += decoder.decode(value, { stream: true });
        }
        received += decoder.decode();
      } catch {
        // Partial read — keep whatever we already have.
      }
    } else {
      received = await resp.text();
    }
    return received.length > 0 ? received : null;
  } catch {
    return null;
  }
}

// Neutralize sequences in untrusted CSS that would let it break out of
// a <style> element and execute as HTML/JS inside the iframe document.
// Used before inlining any externally-fetched CSS.
function escapeForStyleTag(css: string): string {
  return css
    .replace(/<\/style/gi, '<\\/style')
    .replace(/<!--/g, '<\\!--')
    .replace(/-->/g, '--\\>');
}

// Discover and cache a complete V6 theme CSS that DOES use
// var(--color-brand-*). Used to substitute the stylesheet of any
// previewed site whose own theme.min.css was Sass-compiled with the
// variables baked in. The CSS is inlined into the iframe HTML, so we
// only need its text — no <link>/CORS path needed.
async function getBlankThemeCss(): Promise<string | null> {
  if (blankThemeCssCache) return blankThemeCssCache;
  if (blankThemeCssInflight) return blankThemeCssInflight;
  blankThemeCssInflight = (async () => {
    try {
      const html = await fetchUrlText(BLANK_THEME_SOURCE_URL, 8000);
      if (!html) return null;
      // Find the first stylesheet whose URL points at a baseStyles theme
      // bundle (same predicate as the compatibility probe).
      const linkTagRegex = /<link\b[^>]*>/gi;
      let tag: RegExpExecArray | null;
      let themeHref: string | null = null;
      while ((tag = linkTagRegex.exec(html)) !== null) {
        const t = tag[0];
        const rel = /\srel\s*=\s*["']([^"']+)["']/i.exec(t);
        if (!rel || !rel[1].toLowerCase().split(/\s+/).includes('stylesheet')) continue;
        const href = /\shref\s*=\s*["']([^"']+)["']/i.exec(t);
        if (!href) continue;
        const lower = href[1].toLowerCase();
        if (lower.includes('font-awesome') || lower.includes('fontawesome')) continue;
        if (!/\/theme(?:\.min)?\.css(?:\?|$)/.test(lower)) continue;
        themeHref = href[1];
        break;
      }
      if (!themeHref) return null;
      let absUrl: URL;
      try {
        absUrl = new URL(themeHref, BLANK_THEME_SOURCE_URL);
      } catch {
        return null;
      }
      if (!['http:', 'https:'].includes(absUrl.protocol)) return null;
      if (isBlockedHostname(absUrl.hostname)) return null;
      const css = await fetchUrlText(absUrl.toString(), 8000);
      if (!css) return null;
      // Sanity check: the CSS must actually use var(--color-brand-*),
      // otherwise it's the wrong file and swapping it would still leave
      // the customizer's variables disconnected.
      if (!/var\(\s*--color-brand-[a-g]/i.test(css)) return null;
      blankThemeCssCache = css;
      return css;
    } finally {
      blankThemeCssInflight = null;
    }
  })();
  return blankThemeCssInflight;
}

function isBlockedHostname(hostname: string): boolean {
  let h = hostname.toLowerCase();
  // Node's URL keeps IPv6 literals wrapped in brackets ("[::1]"). Strip
  // them so the patterns below — which are anchored to the address text
  // itself — match either form consistently.
  if (h.startsWith('[') && h.endsWith(']')) {
    h = h.slice(1, -1);
  }
  if (SSRF_BLOCKED_HOSTNAME_PATTERNS.some(p => p.test(h))) {
    return true;
  }
  // IPv4-mapped IPv6 ("::ffff:127.0.0.1" or its compressed hex form
  // "::ffff:7f00:1") — extract the embedded IPv4 and re-check against
  // the IPv4 patterns so loopback/private targets cannot be reached
  // through the v6 family.
  const mappedDotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(h);
  if (mappedDotted) {
    return SSRF_BLOCKED_HOSTNAME_PATTERNS.some(p => p.test(mappedDotted[1]));
  }
  const mappedHex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(h);
  if (mappedHex) {
    const high = parseInt(mappedHex[1], 16);
    const low = parseInt(mappedHex[2], 16);
    if (Number.isFinite(high) && Number.isFinite(low) && high <= 0xffff && low <= 0xffff) {
      const dotted = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
      return SSRF_BLOCKED_HOSTNAME_PATTERNS.some(p => p.test(dotted));
    }
  }
  return false;
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
      if (isBlockedHostname(hostname)) {
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

        // Theme-customizer compatibility check.
        //
        // The customizer themes a page by injecting CSS variables
        // (`:root { --color-brand-a: …; }`) into the iframe. That only
        // affects the visible page if the page's stylesheets actually
        // reference `var(--color-brand-*)`. Some live sites ship a
        // theme.min.css where Sass already resolved those variables to
        // literal hex at build time — in that case the customizer can't
        // change anything, and the user just sees "nothing happens."
        //
        // We pick the first stylesheet whose URL looks like a baseStyles
        // theme bundle (filename contains "theme", excluding obvious
        // utility libs like Font Awesome) and probe it for both a `:root`
        // declaration of `--color-brand-*` and a `var(--color-brand-*)`
        // reference. Result is sent back as `themeCompatibility`:
        //   - `compatible`        — both definitions and references found
        //   - `compiled-no-vars`  — neither found (the vesthimmerland case)
        //   - `unknown`           — no theme stylesheet detected, or fetch
        //                           failed; client should not warn
        let themeCompatibility: 'compatible' | 'compiled-no-vars' | 'unknown' = 'unknown';
        let themeStylesheetUrl: string | null = null;
        try {
          // Two-pass <link> parsing: first grab every <link …> tag, then
          // extract `rel` and `href` independently so attribute order does
          // not matter ("href before rel" is valid HTML and common).
          const linkTagRegex = /<link\b[^>]*>/gi;
          const stylesheetMatches: string[] = [];
          let tagMatch: RegExpExecArray | null;
          while ((tagMatch = linkTagRegex.exec(html)) !== null) {
            const tag = tagMatch[0];
            const relMatch = /\srel\s*=\s*["']([^"']+)["']/i.exec(tag);
            if (!relMatch) continue;
            const rels = relMatch[1].toLowerCase().split(/\s+/);
            if (!rels.includes('stylesheet')) continue;
            const hrefMatch = /\shref\s*=\s*["']([^"']+)["']/i.exec(tag);
            if (!hrefMatch) continue;
            stylesheetMatches.push(hrefMatch[1]);
          }
          const themeUrl = stylesheetMatches.find(href => {
            const lower = href.toLowerCase();
            if (lower.includes('font-awesome') || lower.includes('fontawesome')) return false;
            // Match the conventional baseStyles output filename.
            return /\/theme(?:\.min)?\.css(?:\?|$)/.test(lower);
          });
          // SSRF guard: only fetch the probe URL if it is absolute http/https
          // and points to a publicly routable hostname. This URL came from
          // arbitrary third-party HTML, so it must be re-validated even
          // though the original preview URL was already checked.
          let probeUrl: URL | null = null;
          if (themeUrl) {
            try {
              probeUrl = new URL(themeUrl, baseUrl);
            } catch {
              probeUrl = null;
            }
            if (probeUrl) {
              if (!['http:', 'https:'].includes(probeUrl.protocol)) {
                probeUrl = null;
              } else if (isBlockedHostname(probeUrl.hostname)) {
                probeUrl = null;
              }
            }
          }
          if (probeUrl) {
            themeStylesheetUrl = probeUrl.toString();
            // Use a real browser UA — some CDNs (notably the gopublic
            // poc.media.gopublic.eu host) close the connection mid-stream
            // for "Theme-Customizer/1.0". A Chrome UA is accepted reliably.
            // `redirect: 'manual'` prevents a 30x to an internal address
            // from bypassing the SSRF guard above.
            const cssResp = await fetch(probeUrl.toString(), {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/css,*/*;q=0.1',
              },
              signal: AbortSignal.timeout(6000),
              redirect: 'manual',
            });
            if (cssResp.ok) {
              const len = Number(cssResp.headers.get('content-length') || '0');
              if (!len || len <= 4 * 1024 * 1024) {
                // Read the body in chunks. Some CDNs terminate the
                // connection partway through; whatever bytes we managed
                // to receive are usually enough for the two boolean
                // checks below.
                let received = '';
                try {
                  if (cssResp.body) {
                    const reader = cssResp.body.getReader();
                    const decoder = new TextDecoder('utf-8', { fatal: false });
                    const cap = 4 * 1024 * 1024;
                    while (received.length < cap) {
                      const { done, value } = await reader.read();
                      if (done) break;
                      received += decoder.decode(value, { stream: true });
                    }
                    received += decoder.decode();
                  } else {
                    received = await cssResp.text();
                  }
                } catch {
                  // Partial read — keep whatever we already have.
                }
                if (received.length > 0) {
                  const definesBrandVar = /--color-brand-[a-g]\s*:/i.test(received);
                  const usesBrandVar = /var\(\s*--color-brand-[a-g]/i.test(received);
                  if (definesBrandVar && usesBrandVar) {
                    themeCompatibility = 'compatible';
                  } else if (!definesBrandVar && !usesBrandVar) {
                    themeCompatibility = 'compiled-no-vars';
                  }
                  // Mixed (defines but doesn't use, or vice versa) stays
                  // 'unknown' — too ambiguous to warn confidently.
                }
              }
            }
          }
        } catch (compatErr) {
          // Probe failed — leave compatibility as 'unknown' and continue.
          console.warn('Theme compatibility probe failed:', compatErr);
        }

        // If the previewed site's theme.min.css has the brand colors
        // baked in (no var(--color-brand-*) references), the customizer's
        // injected variables can't change anything visible. To make the
        // customizer "just work" on those sites, swap their theme
        // stylesheet for a known-good blank V6 theme that DOES use
        // variables. We do this by removing every <link> tag whose href
        // matches the offending stylesheet (or another /theme(.min).css
        // bundle, in case there are several) and inlining the blank
        // theme CSS as a <style> in <head>.
        let themeSwapped = false;
        if (themeCompatibility === 'compiled-no-vars') {
          const blankCss = await getBlankThemeCss();
          if (blankCss) {
            const before = html;
            // Strip every <link rel="stylesheet"> whose absolute href
            // looks like a baseStyles theme bundle. Same predicate as
            // the probe so the heuristic matches what we already trust.
            html = html.replace(/<link\b[^>]*>/gi, (tag) => {
              const rel = /\srel\s*=\s*["']([^"']+)["']/i.exec(tag);
              if (!rel || !rel[1].toLowerCase().split(/\s+/).includes('stylesheet')) return tag;
              const href = /\shref\s*=\s*["']([^"']+)["']/i.exec(tag);
              if (!href) return tag;
              const lower = href[1].toLowerCase();
              if (lower.includes('font-awesome') || lower.includes('fontawesome')) return tag;
              if (!/\/theme(?:\.min)?\.css(?:\?|$)/.test(lower)) return tag;
              return ''; // drop this <link>
            });
            if (html !== before) {
              // Escape any "</style", "<!--", "-->" sequences inside the
              // upstream CSS so they cannot break out of the <style> tag
              // and execute as HTML/JS inside the iframe document.
              const safeBlankCss = escapeForStyleTag(blankCss);
              const styleTag = `\n<style id="theme-customizer-blank-theme">${safeBlankCss}</style>\n`;
              if (/<\/head>/i.test(html)) {
                html = html.replace(/<\/head>/i, styleTag + '</head>');
              } else if (/<head[^>]*>/i.test(html)) {
                html = html.replace(/(<head[^>]*>)/i, '$1' + styleTag);
              } else {
                html = styleTag + html;
              }
              themeSwapped = true;
            }
          }
        }

        res.json({
          success: true,
          html,
          url: parsedUrl.origin + parsedUrl.pathname,
          baseUrl,
          themeCompatibility,
          themeStylesheetUrl,
          themeSwapped,
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
