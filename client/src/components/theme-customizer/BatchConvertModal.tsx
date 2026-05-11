import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FolderOpen,
  Loader2,
  XCircle,
  FileText,
} from 'lucide-react';
import JSZip from 'jszip';
import { useToast } from '@/hooks/use-toast';
import { parseMappingCsv } from '@/lib/legacy-import';
import {
  computeTargetName,
  convertV5ZipToV6,
  dirHandleToZip,
  scanForThemes,
  writeZipToDirectoryHandle,
  type BatchConvertResult,
  type DiscoveredTheme,
} from '@/lib/v5-batch-converter';

interface BatchConvertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'pick' | 'scan' | 'convert' | 'done';

interface DirectoryPickerWindow {
  showDirectoryPicker?: (opts?: {
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
}

const supportsDirectoryPicker = () => {
  return typeof (window as unknown as DirectoryPickerWindow)
    .showDirectoryPicker === 'function';
};

export function BatchConvertModal({ open, onOpenChange }: BatchConvertModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('pick');
  const [rootDir, setRootDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [scanning, setScanning] = useState(false);
  const [themes, setThemes] = useState<DiscoveredTheme[]>([]);
  const [results, setResults] = useState<BatchConvertResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Browsers without showDirectoryPicker (Safari/Firefox) get the
  // uber-zip fallback: every converted theme lands in one downloadable
  // archive. The modal uses this flag to toggle write-in-place vs zip.
  const [fallbackZipMode, setFallbackZipMode] = useState(false);
  const [fallbackBlob, setFallbackBlob] = useState<Blob | null>(null);

  const totalCount = themes.length;
  const completedCount = results.length;
  const successCount = useMemo(
    () => results.filter((r) => r.success).length,
    [results],
  );
  const failureCount = useMemo(
    () => results.filter((r) => !r.success).length,
    [results],
  );

  const resetState = useCallback(() => {
    setStep('pick');
    setRootDir(null);
    setScanning(false);
    setThemes([]);
    setResults([]);
    setCurrentIndex(0);
    setFallbackZipMode(false);
    setFallbackBlob(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [onOpenChange, resetState]);

  // Reset on close so reopening starts fresh.
  useEffect(() => {
    if (!open) {
      // small delay to let the close animation finish before clearing
      const t = setTimeout(resetState, 200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, resetState]);

  const handlePickFolder = useCallback(async () => {
    try {
      if (!supportsDirectoryPicker()) {
        toast({
          title: 'Browser not supported for in-place writes',
          description:
            'Use Chrome / Edge / Brave to write back into the source tree, or proceed for a zip-of-zips download.',
        });
        // Fall through anyway — but we'll have to use fileinput-based
        // selection. Since the user didn't have access, we can't actually
        // pick a folder here. Show a fallback message.
        return;
      }
      const win = window as unknown as DirectoryPickerWindow;
      const handle = await win.showDirectoryPicker!({ mode: 'readwrite' });
      setRootDir(handle);
      setStep('scan');
      setScanning(true);
      const found = await scanForThemes(handle);
      setThemes(found);
      setScanning(false);
    } catch (err) {
      // AbortError = user cancelled the picker; quietly stay on pick step
      const name = (err as DOMException)?.name;
      if (name === 'AbortError') return;
      toast({
        title: 'Could not read folder',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
        duration: 6000,
      });
      setScanning(false);
    }
  }, [toast]);

  const runBatch = useCallback(async () => {
    if (themes.length === 0) return;
    setStep('convert');
    setResults([]);
    setCurrentIndex(0);

    const mappings = parseMappingCsv();
    const accumulator: BatchConvertResult[] = [];
    // When in fallback zip mode, collect every output into one big zip
    // for download at the end. Otherwise we write each theme's output
    // directly into its parent `Themes/` folder via the directory handle.
    const uberZip = fallbackZipMode ? new JSZip() : null;

    for (let i = 0; i < themes.length; i++) {
      const theme = themes[i];
      setCurrentIndex(i);
      const targetName = computeTargetName(theme.name);
      // Skip sources that already carry the `--v6` postfix. These are
      // outputs from a previous batch run; converting them would yield
      // `solroed--v6--v6` which is almost never what the user wants and
      // pollutes the source tree on repeated runs. Surface them in the
      // result list so the operator sees what was deliberately ignored.
      if (/--v6$/i.test(theme.name)) {
        accumulator.push({
          success: false,
          sourceName: theme.name,
          targetName,
          error: 'Skipped — source already has the --v6 postfix',
        });
        setResults([...accumulator]);
        continue;
      }
      try {
        const v5Zip = await dirHandleToZip(theme.handle);
        const result = await convertV5ZipToV6(v5Zip, {
          sourceName: theme.name,
          targetName,
          mappings,
        });
        if (result.success && result.outputZip) {
          if (uberZip) {
            // Merge each theme's contents into the uber-zip under a
            // path that mirrors the source tree so the user can find
            // their themes after extraction.
            const prefix = theme.relativePath
              .split('/')
              .slice(0, -1)
              .join('/');
            const sourceFiles = Object.entries(result.outputZip.files);
            for (const [path, entry] of sourceFiles) {
              if (entry.dir) continue;
              const data = await entry.async('uint8array');
              uberZip.file(`${prefix ? prefix + '/' : ''}${path}`, data);
            }
          } else {
            // Write directly into the source `Themes/` folder as a
            // sibling of the original theme folder.
            await writeZipToDirectoryHandle(
              result.outputZip,
              theme.parentHandle,
            );
          }
        }
        accumulator.push(result);
      } catch (err) {
        accumulator.push({
          success: false,
          sourceName: theme.name,
          targetName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      // Snapshot accumulator after each theme so the UI reflects
      // progress; a single setResults at the end would mean no live
      // updates during the loop.
      setResults([...accumulator]);
    }

    setCurrentIndex(themes.length);

    if (uberZip) {
      const reportContent = renderReport(accumulator);
      uberZip.file('batch-report.md', reportContent);
      const blob = await uberZip.generateAsync({ type: 'blob' });
      setFallbackBlob(blob);
    } else if (rootDir) {
      // Drop a batch-report.md at the picked root for after-the-fact
      // auditing.
      try {
        const handle = await rootDir.getFileHandle('batch-report.md', {
          create: true,
        });
        const writable = await (
          handle as unknown as {
            createWritable: () => Promise<FileSystemWritableFileStream>;
          }
        ).createWritable();
        await writable.write(renderReport(accumulator));
        await writable.close();
      } catch (err) {
        console.warn('Could not write batch-report.md:', err);
      }
    }

    setStep('done');
  }, [themes, fallbackZipMode, rootDir]);

  const handleDownloadFallbackZip = useCallback(() => {
    if (!fallbackBlob) return;
    const url = URL.createObjectURL(fallbackBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch-conversion.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [fallbackBlob]);

  const handleDownloadReport = useCallback(() => {
    const content = renderReport(results);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch-report.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [results]);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Batch convert V5 themes</DialogTitle>
          <DialogDescription>
            Pick a folder and the converter will scan it for{' '}
            <code className="px-1 py-0.5 rounded bg-muted text-xs">Themes/</code>{' '}
            subfolders, convert every theme inside, and write the V6 output as a
            sibling folder with the <code className="px-1 py-0.5 rounded bg-muted text-xs">--v6</code>{' '}
            suffix.
          </DialogDescription>
        </DialogHeader>

        {step === 'pick' && (
          <div className="py-6 space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
              <div className="font-medium">How it works</div>
              <ul className="text-muted-foreground space-y-1 list-disc pl-5">
                <li>
                  Pick a single client folder (with a <code>Themes/</code> child) or
                  a parent folder containing many client folders — both work.
                </li>
                <li>
                  Each <code>solroed</code> theme becomes a sibling{' '}
                  <code>solroed--v6</code> folder inside the same{' '}
                  <code>Themes/</code> directory.
                </li>
                <li>
                  Folders that already end with <code>--v6</code> are skipped
                  (they're outputs of a previous run, not conversion targets).
                </li>
                <li>
                  Folders that aren't V5 themes (no{' '}
                  <code>css/variables/</code>) are skipped and listed in the
                  report.
                </li>
                <li>
                  One theme erroring out doesn't stop the batch — every result
                  goes into the final summary.
                </li>
              </ul>
            </div>
            {!supportsDirectoryPicker() && (
              <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 p-3 text-sm flex gap-2 items-start">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">Limited browser</div>
                  Your browser doesn't support directory write access. Convert in
                  Chrome / Edge / Brave to have outputs written back next to the
                  sources, or continue here and the converter will bundle every
                  output into a single downloadable zip.
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'scan' && (
          <div className="py-6 space-y-4">
            {scanning ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning for <code className="px-1 py-0.5 rounded bg-muted text-xs">Themes/</code>{' '}
                folders…
              </div>
            ) : (
              <>
                <div className="text-sm">
                  Found <span className="font-medium">{themes.length}</span> theme
                  {themes.length === 1 ? '' : 's'} inside the picked folder.
                  {themes.length > 0 &&
                    ' Each will be converted into a sibling folder named with the '}
                  {themes.length > 0 && (
                    <code className="px-1 py-0.5 rounded bg-muted text-xs">
                      --v6
                    </code>
                  )}
                  {themes.length > 0 && ' suffix.'}
                </div>
                {themes.length === 0 && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    No themes detected. Make sure the folder you picked contains
                    a <code>Themes/</code> subdirectory (or has client subfolders
                    that each contain one).
                  </div>
                )}
                {themes.length > 0 && (
                  <ScrollArea className="h-[240px] rounded-md border">
                    <ul className="divide-y">
                      {themes.map((t) => (
                        <li
                          key={t.relativePath}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                          data-testid={`batch-theme-${t.name}`}
                        >
                          <span className="font-medium truncate">{t.name}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {t.relativePath}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </>
            )}
          </div>
        )}

        {step === 'convert' && (
          <div className="py-6 space-y-4">
            <div className="space-y-1">
              <div className="text-sm">
                Converting{' '}
                <span className="font-medium">
                  {Math.min(currentIndex + 1, totalCount)}
                </span>{' '}
                of <span className="font-medium">{totalCount}</span>:{' '}
                <code className="text-xs">
                  {themes[currentIndex]?.name ?? '…'}
                </code>
              </div>
              <Progress
                value={
                  totalCount === 0 ? 0 : (completedCount / totalCount) * 100
                }
              />
            </div>
            <ScrollArea className="h-[240px] rounded-md border">
              <ul className="divide-y">
                {results.map((r) => (
                  <li
                    key={r.sourceName + r.targetName}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {r.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      <span className="truncate font-medium">
                        {r.sourceName}
                      </span>
                      <span className="text-muted-foreground truncate">
                        → {r.targetName}
                      </span>
                    </div>
                    {!r.success && (
                      <span
                        className="text-xs text-destructive truncate max-w-[40%]"
                        title={r.error}
                      >
                        {r.error}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        {step === 'done' && (
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-green-50 dark:bg-green-950/40 p-3">
                <div className="text-xs uppercase tracking-wide text-green-700 dark:text-green-300">
                  Converted
                </div>
                <div className="text-2xl font-semibold text-green-700 dark:text-green-300">
                  {successCount}
                </div>
              </div>
              <div className="rounded-lg border bg-destructive/10 p-3">
                <div className="text-xs uppercase tracking-wide text-destructive">
                  Skipped / failed
                </div>
                <div className="text-2xl font-semibold text-destructive">
                  {failureCount}
                </div>
              </div>
            </div>
            <ScrollArea className="h-[260px] rounded-md border">
              <ul className="divide-y">
                {results.map((r) => (
                  <li
                    key={r.sourceName + r.targetName}
                    className="flex items-start justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      {r.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {r.sourceName}
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            → {r.targetName}
                          </span>
                        </div>
                        {r.success && (
                          <div className="text-xs text-muted-foreground">
                            {r.mappedVariableCount ?? 0} variables ·{' '}
                            {r.customCssCount ?? 0} CSS ·{' '}
                            {r.customJsCount ?? 0} JS ·{' '}
                            {r.fontFileCount ?? 0} fonts ·{' '}
                            {r.graphicFileCount ?? 0} graphics
                            {r.hadStylesXml ? ' · styles.xml' : ''}
                          </div>
                        )}
                        {!r.success && r.error && (
                          <div className="text-xs text-destructive break-words">
                            {r.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            {fallbackZipMode && fallbackBlob && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                Your browser doesn't support direct folder writes — every
                converted theme is bundled into a single zip you can download
                below.
              </div>
            )}
            {!fallbackZipMode && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                Outputs were written directly into the source tree (sibling
                folders inside each <code>Themes/</code> directory). A{' '}
                <code>batch-report.md</code> was saved to the picked root.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'pick' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {!supportsDirectoryPicker() ? (
                <Button
                  onClick={() => {
                    setFallbackZipMode(true);
                    // For non-Chromium we need an alternative way to
                    // pick a folder. The simplest: a regular <input
                    // type="file" webkitdirectory> upload — but that's
                    // a separate UI. For now, surface the limitation
                    // and let the user know to use Chrome.
                    toast({
                      title: 'Use Chrome / Edge / Brave',
                      description:
                        'Folder selection requires the File System Access API. Open this app in a Chromium browser to use batch conversion.',
                      variant: 'destructive',
                      duration: 8000,
                    });
                  }}
                  disabled
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Pick folder
                </Button>
              ) : (
                <Button onClick={handlePickFolder}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Pick folder
                </Button>
              )}
            </>
          )}
          {step === 'scan' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={runBatch}
                disabled={themes.length === 0 || scanning}
              >
                Convert {themes.length} theme{themes.length === 1 ? '' : 's'}
              </Button>
            </>
          )}
          {step === 'convert' && (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Converting…
            </Button>
          )}
          {step === 'done' && (
            <>
              <Button variant="outline" onClick={handleDownloadReport}>
                <FileText className="h-4 w-4 mr-2" />
                Download report
              </Button>
              {fallbackZipMode && fallbackBlob && (
                <Button onClick={handleDownloadFallbackZip}>
                  <Download className="h-4 w-4 mr-2" />
                  Download zip
                </Button>
              )}
              <Button onClick={handleClose}>Close</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Render the batch summary as a single Markdown document. Used both as
 * the in-place `batch-report.md` (Chromium write-back path) and the
 * downloadable report from the summary screen.
 */
function renderReport(results: BatchConvertResult[]): string {
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);
  const lines: string[] = [];
  lines.push('# Batch conversion report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`- Successful: ${successes.length}`);
  lines.push(`- Failed / skipped: ${failures.length}`);
  lines.push(`- Total: ${results.length}`);
  lines.push('');
  lines.push('## Successful conversions');
  lines.push('');
  if (successes.length === 0) lines.push('_None_');
  for (const r of successes) {
    const stats = [
      `${r.mappedVariableCount ?? 0} variables`,
      `${r.customCssCount ?? 0} CSS`,
      `${r.customJsCount ?? 0} JS`,
      `${r.fontFileCount ?? 0} fonts`,
      `${r.graphicFileCount ?? 0} graphics`,
      r.hadStylesXml ? 'styles.xml' : null,
    ]
      .filter(Boolean)
      .join(' · ');
    lines.push(`- **${r.sourceName}** → \`${r.targetName}\` — ${stats}`);
  }
  lines.push('');
  lines.push('## Failed / skipped conversions');
  lines.push('');
  if (failures.length === 0) lines.push('_None_');
  for (const r of failures) {
    lines.push(
      `- **${r.sourceName}** → \`${r.targetName}\` — ${r.error ?? 'unknown error'}`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

export default BatchConvertModal;
