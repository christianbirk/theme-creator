import { CSSVariable } from '@/components/theme-customizer/types';

interface ParseScssResponse {
  success: boolean;
  variables: CSSVariable[];
  count: number;
}

interface CompileThemeResponse {
  success: boolean;
  css: string;
  lineCount: number;
}

interface SampleScssResponse {
  success: boolean;
  content: string;
  filename: string;
}

export async function parseScssContent(content: string): Promise<CSSVariable[]> {
  const response = await fetch('/api/parse-scss', {
    method: 'POST',
    body: JSON.stringify({ content }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to parse SCSS');
  }
  
  const data: ParseScssResponse = await response.json();
  return data.variables;
}

export async function compileTheme(variables: CSSVariable[], baseScss?: string): Promise<string> {
  const response = await fetch('/api/compile-theme', {
    method: 'POST',
    body: JSON.stringify({ variables, baseScss }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to compile theme');
  }
  
  const data: CompileThemeResponse = await response.json();
  return data.css;
}

export async function fetchSampleScss(): Promise<{ content: string; filename: string }> {
  const response = await fetch('/api/sample-scss');
  
  if (!response.ok) {
    throw new Error('Failed to fetch sample SCSS');
  }
  
  const data: SampleScssResponse = await response.json();
  return { content: data.content, filename: data.filename };
}
