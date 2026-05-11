import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Upload, Trash2, Image as ImageIcon, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface GraphicFile {
  id: string;
  name: string; // relative path inside gfx/, e.g. "logo.svg" or "icons/star.svg"
  data: Uint8Array;
  type: string;
  size: number;
  blobUrl?: string;
}

interface CustomGraphicsManagerProps {
  graphics: GraphicFile[];
  onGraphicsChange: (graphics: GraphicFile[]) => void;
}

const IMAGE_EXTENSIONS = new Set([
  'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'bmp', 'tiff',
]);

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

function isImage(filename: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(filename));
}

function getMimeType(filename: string): string {
  const ext = getFileExtension(filename);
  const map: Record<string, string> = {
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
  };
  return map[ext] || 'application/octet-stream';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CustomGraphicsManager({ graphics, onGraphicsChange }: CustomGraphicsManagerProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [graphicToDelete, setGraphicToDelete] = useState<string | null>(null);

  // Create blob URLs on demand so we can render previews. Mirrors the
  // approach in CustomFontsManager.
  useEffect(() => {
    let hasChanges = false;
    const updated = graphics.map((g) => {
      if (!g.blobUrl) {
        const blob = new Blob([g.data], { type: g.type });
        hasChanges = true;
        return { ...g, blobUrl: URL.createObjectURL(blob) };
      }
      return g;
    });
    if (hasChanges) onGraphicsChange(updated);
  }, [graphics, onGraphicsChange]);

  // Revoke blob URLs for graphics that were removed.
  const previousRef = useRef<GraphicFile[]>([]);
  useEffect(() => {
    const currentIds = new Set(graphics.map((g) => g.id));
    previousRef.current.forEach((prev) => {
      if (!currentIds.has(prev.id) && prev.blobUrl) {
        URL.revokeObjectURL(prev.blobUrl);
      }
    });
    previousRef.current = graphics;
  }, [graphics]);

  const handleUploadClick = useCallback(() => fileInputRef.current?.click(), []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const newGraphics: GraphicFile[] = [];
      const duplicates: string[] = [];

      for (const file of Array.from(files)) {
        if (graphics.some((g) => g.name.toLowerCase() === file.name.toLowerCase())) {
          duplicates.push(file.name);
          continue;
        }
        try {
          const buf = await file.arrayBuffer();
          newGraphics.push({
            id: `gfx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name: file.name,
            data: new Uint8Array(buf),
            type: file.type || getMimeType(file.name),
            size: file.size,
          });
        } catch (err) {
          console.error(`Failed to read ${file.name}:`, err);
        }
      }

      if (newGraphics.length > 0) {
        onGraphicsChange([...graphics, ...newGraphics]);
        toast({
          title: 'Graphics added',
          description: `Added ${newGraphics.length} file${newGraphics.length === 1 ? '' : 's'} to gfx/.`,
        });
      }
      if (duplicates.length > 0) {
        toast({
          title: 'Duplicates skipped',
          description: duplicates.join(', '),
        });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [graphics, onGraphicsChange, toast],
  );

  const requestDelete = useCallback((id: string) => {
    setGraphicToDelete(id);
    setDeleteConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!graphicToDelete) return;
    onGraphicsChange(graphics.filter((g) => g.id !== graphicToDelete));
    setDeleteConfirmOpen(false);
    setGraphicToDelete(null);
  }, [graphicToDelete, graphics, onGraphicsChange]);

  const totalSize = useMemo(
    () => graphics.reduce((sum, g) => sum + g.size, 0),
    [graphics],
  );

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Custom Graphics</h3>
          <p className="text-xs text-muted-foreground">
            Files exported into <code className="text-xs">gfx/</code>. Logos, illustrations,
            decorative SVGs — anything the theme references.
          </p>
        </div>
        <Button onClick={handleUploadClick} size="sm" data-testid="button-upload-graphics">
          <Upload className="h-4 w-4 mr-2" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          data-testid="input-graphics"
        />
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full pr-2">
          {graphics.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
              <ImageIcon className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">No graphics yet.</p>
              <p className="text-xs">
                Upload images, or import a legacy theme that has a <code>gfx/</code> folder.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {graphics.map((g) => (
                <div
                  key={g.id}
                  className="border rounded-md p-2 flex flex-col gap-2 group"
                  data-testid={`graphic-${g.id}`}
                >
                  <div className="aspect-square flex items-center justify-center bg-muted/40 rounded">
                    {isImage(g.name) && g.blobUrl ? (
                      <img
                        src={g.blobUrl}
                        alt={g.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs truncate font-mono" title={g.name}>{g.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatFileSize(g.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => requestDelete(g.id)}
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    data-testid={`button-delete-graphic-${g.id}`}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {graphics.length > 0 && (
        <p className="text-xs text-muted-foreground border-t pt-2">
          {graphics.length} file{graphics.length === 1 ? '' : 's'} · {formatFileSize(totalSize)} total
        </p>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete graphic?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes <code>{graphics.find((g) => g.id === graphicToDelete)?.name}</code> from the
              theme. This won't delete the file from your computer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="button-confirm-delete-graphic"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default CustomGraphicsManager;
