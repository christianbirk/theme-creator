import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import * as sass from 'sass';
import * as fs from 'fs';
import * as path from 'path';

interface CSSVariable {
  name: string;
  value: string;
  defaultValue: string;
  type: 'color' | 'font' | 'size' | 'number' | 'string';
  category: string;
  description?: string;
}

function detectVariableType(name: string, value: string): CSSVariable['type'] {
  const lowerName = name.toLowerCase();
  const lowerValue = value.toLowerCase();

  if (lowerValue.match(/^#[0-9a-f]{3,8}$/i) || 
      lowerValue.match(/^rgba?\s*\(/) || 
      lowerValue.match(/^hsla?\s*\(/) ||
      lowerName.includes('color') ||
      lowerName.includes('background') ||
      lowerName.includes('foreground') ||
      lowerName.includes('border') && !lowerName.includes('radius') && !lowerName.includes('width')) {
    return 'color';
  }

  if (lowerName.includes('font-family') || lowerName.includes('font-sans') || 
      lowerName.includes('font-serif') || lowerName.includes('font-mono')) {
    return 'font';
  }

  if (lowerValue.match(/^[\d.]+\s*(px|rem|em|%|vh|vw|pt|cm|mm|in)$/i) ||
      lowerName.includes('size') || lowerName.includes('spacing') ||
      lowerName.includes('radius') || lowerName.includes('width') ||
      lowerName.includes('height') || lowerName.includes('padding') ||
      lowerName.includes('margin') || lowerName.includes('gap')) {
    return 'size';
  }

  if (lowerValue.match(/^[\d.]+$/) || 
      lowerName.includes('weight') || lowerName.includes('line-height') ||
      lowerName.includes('opacity') || lowerName.includes('z-index')) {
    return 'number';
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

  // Status Colors (Light/Dark Background variants)
  if (lowerName.includes('-bg-dark') || 
      (lowerName.includes('button') && (lowerName.includes('background') || lowerName.includes('color'))) ||
      lowerName.includes('icon-background') || lowerName.includes('icon-color') ||
      lowerName.includes('label-background') || lowerName.includes('label-color') ||
      lowerName.includes('link-color') || lowerName.includes('font-base-color') ||
      lowerName.includes('font-heading-color') || lowerName.includes('lead-color') ||
      lowerName.includes('pre-heading-color')) {
    return 'color-combinations';
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

  // Hero & Aspect Ratios
  if (lowerName.includes('hero') || lowerName.includes('aspect-ratio') ||
      lowerName.includes('ratio')) {
    return 'hero-ratios';
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
  
  const cssVarRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match;
  
  while ((match = cssVarRegex.exec(content)) !== null) {
    const name = `--${match[1]}`;
    const value = match[2].trim();
    const type = detectVariableType(name, value);
    const category = categorizeVariable(name);
    
    variables.push({
      name,
      value,
      defaultValue: value,
      type,
      category,
    });
  }

  const scssVarRegex = /\$([a-zA-Z0-9_-]+)\s*:\s*([^;!]+)(?:\s*!default)?;/g;
  
  while ((match = scssVarRegex.exec(content)) !== null) {
    const name = `--${match[1]}`;
    const value = match[2].trim();
    const type = detectVariableType(name, value);
    const category = categorizeVariable(name);
    
    if (!variables.find(v => v.name === name)) {
      variables.push({
        name,
        value,
        defaultValue: value,
        type,
        category,
      });
    }
  }

  return variables;
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

  return httpServer;
}
