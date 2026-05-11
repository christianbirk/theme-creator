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

/**
 * Compile a full theme.css for export by stitching the user's variables
 * and theme.scss content on top of the bundled baseStylesV6 framework.
 * Returns the same CSS the framework would emit in a real project build.
 */
export async function compileFullTheme(
  variables: { name: string; value: string }[],
  variablesScss?: string,
  customScss?: string,
): Promise<string> {
  const response = await fetch('/api/compile-full-theme', {
    method: 'POST',
    body: JSON.stringify({ variables, variablesScss, customScss }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'Failed to compile full theme');
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
