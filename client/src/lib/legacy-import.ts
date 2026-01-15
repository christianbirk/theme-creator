import mappingCsvContent from '@assets/mapping-file_1768311744358.csv?raw';

export interface ScssVariableMapping {
  cssVariable: string;
  scssVariable: string;
  note: string;
}

export interface ParsedScssVariables {
  [variableName: string]: string;
}

export interface LegacyImportResult {
  mappedVariables: { name: string; value: string }[];
  unmappedCount: number;
  stylesXml: string | null;
  preservedFolders: {
    charts: Map<string, Uint8Array>;
    fonts: Map<string, Uint8Array>;
    release: Map<string, Uint8Array>;
  };
}

export function parseMappingCsv(): ScssVariableMapping[] {
  const lines = mappingCsvContent.split('\n');
  const mappings: ScssVariableMapping[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.match(/^([^,]*),([^,]*),(.*)$/);
    if (!parts) continue;
    
    let [, cssVar, scssVar, note] = parts;
    
    cssVar = cssVar.trim();
    scssVar = scssVar.trim();
    note = note.trim().replace(/^"|"$/g, '');
    
    if (cssVar && cssVar.startsWith('--') && scssVar && scssVar.startsWith('$')) {
      mappings.push({
        cssVariable: cssVar,
        scssVariable: scssVar,
        note
      });
    }
  }
  
  return mappings;
}

export function parseScssFile(content: string): ParsedScssVariables {
  const variables: ParsedScssVariables = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || !trimmed.includes(':')) continue;
    
    const match = trimmed.match(/^\$([a-zA-Z0-9_-]+)\s*:\s*(.+?);?\s*(?:\/\/.*)?$/);
    if (match) {
      const [, name, value] = match;
      const cleanValue = value.replace(/!default\s*$/, '').replace(/;$/, '').trim();
      variables[`$${name}`] = cleanValue;
    }
  }
  
  return variables;
}

function extractHexValue(value: string): string {
  const hexMatch = value.match(/#[a-fA-F0-9]{3,8}/);
  return hexMatch ? hexMatch[0] : value;
}

// Predefined SCSS variables with fixed values
const PREDEFINED_SCSS_VALUES: Record<string, string> = {
  '$space-4': '4px',
  '$space-8': '8px',
  '$space-12': '12px',
  '$space-16': '16px',
  '$space-24': '24px',
  '$space-32': '32px',
};

/**
 * Replace all predefined SCSS variables in a value with their fixed values
 * Handles compound values like "$space-12 0" -> "12px 0"
 */
function replacePredefinedVariables(value: string): string {
  return value.replace(/\$[a-zA-Z0-9_-]+/g, (scssVar) => {
    const predefined = PREDEFINED_SCSS_VALUES[scssVar];
    return predefined || scssVar;
  });
}

function resolveVariableReference(value: string, allVariables: ParsedScssVariables): string {
  // First, replace any predefined variables in the value
  value = replacePredefinedVariables(value);
  
  // If the value is a single SCSS variable reference, try to resolve it
  if (value.startsWith('$') && !value.includes(' ')) {
    const refValue = allVariables[value];
    if (refValue) {
      return resolveVariableReference(refValue, allVariables);
    }
  }
  return value;
}

/**
 * Convert SCSS variable references in a value to CSS variable references
 * Used for values that couldn't be resolved to literals
 */
function convertValueScssVarsToCss(value: string, scssToCssMap: Map<string, string>): string {
  // Match all SCSS variable references in the value
  return value.replace(/\$[a-zA-Z0-9_-]+/g, (scssVar) => {
    const cssVar = scssToCssMap.get(scssVar);
    if (cssVar) {
      return `var(${cssVar})`;
    }
    // No mapping found, leave as-is
    return scssVar;
  });
}

export function applyMapping(
  scssVariables: ParsedScssVariables,
  mappings: ScssVariableMapping[]
): { name: string; value: string }[] {
  const result: { name: string; value: string }[] = [];
  
  // Build a map from SCSS variable names to CSS variable names for reference conversion
  // Use the FIRST match found (most direct/generic mapping) rather than the last
  // e.g., $color-a should map to --color-brand-a, not --label-color-bg-dark
  const scssToCssMap: Map<string, string> = new Map();
  for (const mapping of mappings) {
    if (!scssToCssMap.has(mapping.scssVariable)) {
      scssToCssMap.set(mapping.scssVariable, mapping.cssVariable);
    }
  }
  
  for (const mapping of mappings) {
    let rawValue = scssVariables[mapping.scssVariable];
    
    if (!rawValue) continue;
    
    // Try to resolve to a literal value first
    rawValue = resolveVariableReference(rawValue, scssVariables);
    
    let finalValue = rawValue;
    
    // If the value still contains SCSS variable references, convert them to CSS variables
    if (finalValue.includes('$')) {
      finalValue = convertValueScssVarsToCss(finalValue, scssToCssMap);
    }
    
    if (mapping.note.toLowerCase().includes('take only hex value')) {
      finalValue = extractHexValue(rawValue);
    }
    
    if (mapping.note.toLowerCase().includes('arrow appearance') && 
        mapping.note.toLowerCase().includes('right') && 
        mapping.note.toLowerCase().includes('left')) {
      if (rawValue.toLowerCase() === 'right') {
        finalValue = 'left';
      }
    }
    
    if (mapping.note.toLowerCase().includes("if 'true' use") || 
        mapping.note.toLowerCase().includes('if true use')) {
      if (rawValue.toLowerCase() === 'true') {
        const useMatch = mapping.note.match(/use\s+(--[a-zA-Z0-9-]+)/i);
        if (useMatch) {
          finalValue = `var(${useMatch[1]})`;
        }
      } else if (rawValue.toLowerCase() === 'false') {
        // If false, leave empty (inherit from default)
        finalValue = 'inherit';
      }
    }
    
    result.push({
      name: mapping.cssVariable,
      value: finalValue
    });
  }
  
  return result;
}

export function mergeMappedVariables(
  existingVariables: { name: string; value: string; defaultValue: string }[],
  mappedVariables: { name: string; value: string }[]
): { name: string; value: string; defaultValue: string }[] {
  const mappedMap = new Map(mappedVariables.map(v => [v.name, v.value]));
  
  return existingVariables.map(variable => {
    const mappedValue = mappedMap.get(variable.name);
    if (mappedValue !== undefined) {
      return { ...variable, value: mappedValue };
    }
    return variable;
  });
}

/**
 * Resolve an SCSS variable to its final literal value by following reference chains
 * Uses memoization and cycle detection to avoid infinite loops
 */
function resolveToLiteral(
  varName: string,
  scssVariables: ParsedScssVariables,
  visited: Set<string> = new Set(),
  cache: Map<string, string | null> = new Map()
): string | null {
  // Check cache first
  if (cache.has(varName)) {
    return cache.get(varName)!;
  }
  
  // Cycle detection
  if (visited.has(varName)) {
    return null;
  }
  
  const value = scssVariables[varName];
  if (!value) {
    cache.set(varName, null);
    return null;
  }
  
  visited.add(varName);
  
  // If value is a simple literal (no $ references), return it
  if (!value.includes('$')) {
    cache.set(varName, value);
    return value;
  }
  
  // If value is just another variable reference, resolve it recursively
  if (value.match(/^\$[a-zA-Z0-9_-]+$/)) {
    const resolved = resolveToLiteral(value, scssVariables, visited, cache);
    cache.set(varName, resolved);
    return resolved;
  }
  
  // If value contains function calls like map-get(), darken(), etc., we can't resolve it
  if (value.includes('(') && !value.match(/^#[a-fA-F0-9]+$/) && !value.match(/^rgba?\(/i) && !value.match(/^hsla?\(/i)) {
    // Check if it's a simple color function we can keep
    if (!value.match(/^(rgb|rgba|hsl|hsla)\s*\(/i)) {
      cache.set(varName, null);
      return null;
    }
  }
  
  // Try to resolve embedded variable references in the value
  let resolvedValue = value;
  const varRefs = value.match(/\$[a-zA-Z0-9_-]+/g) || [];
  
  for (const ref of varRefs) {
    const refValue = resolveToLiteral(ref, scssVariables, new Set(visited), cache);
    if (refValue === null) {
      // Can't resolve this reference, return null for the whole value
      cache.set(varName, null);
      return null;
    }
    resolvedValue = resolvedValue.replace(ref, refValue);
  }
  
  cache.set(varName, resolvedValue);
  return resolvedValue;
}

/**
 * Convert SCSS variable references ($var-name) to CSS variable references or literal values
 * 
 * Three-tier resolution:
 * 1. If SCSS variable has a mapping in CSV → use var(--css-var-name)
 * 2. If no mapping but value exists in scssVariables → use resolved literal value
 * 3. If neither → leave SCSS variable as-is
 */
export function convertScssVariablesToCss(
  content: string, 
  mappings?: ScssVariableMapping[],
  scssVariables?: ParsedScssVariables
): string {
  const variableMappings = mappings || parseMappingCsv();
  const allScssVars = scssVariables || {};
  
  // Create a map from SCSS variable name to CSS variable name
  // Use the FIRST match found (most direct/generic mapping) rather than the last
  const scssToCs: Map<string, string> = new Map();
  for (const mapping of variableMappings) {
    if (!scssToCs.has(mapping.scssVariable)) {
      scssToCs.set(mapping.scssVariable, mapping.cssVariable);
    }
  }
  
  // Pre-resolve all SCSS variables to literals for tier 2 fallback
  const resolvedLiterals: Map<string, string> = new Map();
  const cache = new Map<string, string | null>();
  
  for (const varName of Object.keys(allScssVars)) {
    const literal = resolveToLiteral(varName, allScssVars, new Set(), cache);
    if (literal !== null) {
      resolvedLiterals.set(varName, literal);
    }
  }
  
  // Replace function for both interpolation and regular variable references
  const replaceVar = (scssVar: string): string => {
    // Tier 1: Check if there's a CSS variable mapping
    const cssVar = scssToCs.get(scssVar);
    if (cssVar) {
      return `var(${cssVar})`;
    }
    
    // Tier 2: Check if we have a resolved literal value
    const literal = resolvedLiterals.get(scssVar);
    if (literal !== undefined) {
      return literal;
    }
    
    // Tier 3: Leave as-is
    return scssVar;
  };
  
  let result = content;
  
  // First handle interpolation syntax: #{$variable}
  result = result.replace(/#{(\$[a-zA-Z0-9_-]+)}/g, (match, scssVar) => {
    const replacement = replaceVar(scssVar);
    // If it's a CSS var(), keep the var() syntax
    // If it's a literal or unchanged, just return the value (no #{})
    return replacement;
  });
  
  // Then handle regular variable references: $variable (not at start of line with colon after)
  // This regex avoids matching variable definitions like "$var: value"
  result = result.replace(/(?<!^\s*)(\$[a-zA-Z0-9_-]+)(?!\s*:)/gm, (match, scssVar) => {
    return replaceVar(scssVar);
  });
  
  return result;
}
