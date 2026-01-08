export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }
  const shortResult = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
  if (shortResult) {
    return {
      r: parseInt(shortResult[1] + shortResult[1], 16),
      g: parseInt(shortResult[2] + shortResult[2], 16),
      b: parseInt(shortResult[3] + shortResult[3], 16),
    };
  }
  return null;
}

export function rgbStringToRgb(rgbStr: string): { r: number; g: number; b: number } | null {
  const rgbMatch = rgbStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
  return null;
}

export function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (!color) return null;
  
  const trimmed = color.trim();
  
  if (trimmed.startsWith('#')) {
    return hexToRgb(trimmed);
  }
  
  if (trimmed.startsWith('rgb')) {
    return rgbStringToRgb(trimmed);
  }
  
  return null;
}

export function getLuminanceFromRgb(rgb: { r: number; g: number; b: number }): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const val = v / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getLuminance(color: string): number {
  const rgb = parseColor(color);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const val = v / 255;
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastLevel = 'fail' | 'aa-large' | 'aa' | 'aaa';

export function getContrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 7) return 'aaa';
  if (ratio >= 4.5) return 'aa';
  if (ratio >= 3) return 'aa-large';
  return 'fail';
}

export function getContrastInfo(foreground: string, background: string): {
  ratio: number;
  level: ContrastLevel;
  passes: boolean;
} {
  const ratio = getContrastRatio(foreground, background);
  const level = getContrastLevel(ratio);
  return {
    ratio,
    level,
    passes: level !== 'fail',
  };
}

export function findBackgroundForVariable(
  variableName: string,
  allVariables: { name: string; value: string }[]
): string | null {
  const name = variableName.toLowerCase();
  
  if (name.includes('-bg-dark')) {
    const bgVar = allVariables.find(v => 
      v.name.toLowerCase().includes('bg-dark') && 
      v.name.toLowerCase().includes('background')
    );
    if (bgVar) return bgVar.value;
    return '#1a1a1a';
  }
  
  if (name.includes('color') || name.includes('text') || name.includes('heading') || name.includes('link')) {
    const bgVar = allVariables.find(v => 
      v.name.toLowerCase().includes('background') && 
      !v.name.toLowerCase().includes('-bg-dark')
    );
    if (bgVar) return bgVar.value;
    return '#ffffff';
  }
  
  return null;
}
