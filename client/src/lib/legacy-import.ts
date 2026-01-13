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

function resolveVariableReference(value: string, allVariables: ParsedScssVariables): string {
  if (value.startsWith('$')) {
    const refValue = allVariables[value];
    if (refValue) {
      return resolveVariableReference(refValue, allVariables);
    }
  }
  return value;
}

export function applyMapping(
  scssVariables: ParsedScssVariables,
  mappings: ScssVariableMapping[]
): { name: string; value: string }[] {
  const result: { name: string; value: string }[] = [];
  
  for (const mapping of mappings) {
    let rawValue = scssVariables[mapping.scssVariable];
    
    if (!rawValue) continue;
    
    rawValue = resolveVariableReference(rawValue, scssVariables);
    
    let finalValue = rawValue;
    
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
 * Convert SCSS variable references ($var-name) to CSS variable references (var(--var-name))
 * Uses the mapping CSV to find the correct CSS variable name
 */
export function convertScssVariablesToCss(content: string, mappings?: ScssVariableMapping[]): string {
  const variableMappings = mappings || parseMappingCsv();
  
  // Create a map from SCSS variable name to CSS variable name
  const scssToCs: Map<string, string> = new Map();
  for (const mapping of variableMappings) {
    // $scss-var -> --css-var
    scssToCs.set(mapping.scssVariable, mapping.cssVariable);
  }
  
  // Replace all SCSS variable references with CSS variable references
  // Match $variable-name patterns but not inside variable definitions ($var: value)
  let result = content;
  
  // First handle interpolation syntax: #{$variable}
  result = result.replace(/#{(\$[a-zA-Z0-9_-]+)}/g, (match, scssVar) => {
    const cssVar = scssToCs.get(scssVar);
    if (cssVar) {
      return `var(${cssVar})`;
    }
    // If no mapping found, convert directly: $var-name -> var(--var-name)
    const directCssVar = '--' + scssVar.slice(1);
    return `var(${directCssVar})`;
  });
  
  // Then handle regular variable references: $variable (not at start of line with colon after)
  // This regex avoids matching variable definitions like "$var: value"
  result = result.replace(/(?<!^\s*)(\$[a-zA-Z0-9_-]+)(?!\s*:)/gm, (match, scssVar) => {
    const cssVar = scssToCs.get(scssVar);
    if (cssVar) {
      return `var(${cssVar})`;
    }
    // If no mapping found, convert directly: $var-name -> var(--var-name)
    const directCssVar = '--' + scssVar.slice(1);
    return `var(${directCssVar})`;
  });
  
  return result;
}
