import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { SimpleCodeEditor } from './SimpleCodeEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { FilePlus, Trash2, Edit2, FileCode2, Power, PowerOff } from 'lucide-react';

export interface JsFile {
  id: string;
  name: string;
  content: string;
  /**
   * When `false`, the file is preserved in the exported zip's `js/` folder
   * but is treated as inactive: a future runtime loader (or a generated
   * index.js) is expected to skip it. New files and legacy-imported files
   * default to `false` so themes don't accidentally execute custom scripts
   * until the user opts back in.
   */
  enabled?: boolean;
}

interface CustomJsManagerProps {
  files: JsFile[];
  onFilesChange: (files: JsFile[]) => void;
}

export function CustomJsManager({ files, onFilesChange }: CustomJsManagerProps) {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    files.length > 0 ? files[0].id : null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'rename'>('add');
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const selectedFile = files.find((f) => f.id === selectedFileId);

  const handleAddFile = useCallback(() => {
    setDialogMode('add');
    setFileName('');
    setDialogOpen(true);
  }, []);

  const handleRenameFile = useCallback((fileId: string, currentName: string) => {
    setDialogMode('rename');
    setEditingFileId(fileId);
    setFileName(currentName.replace(/\.js$/i, ''));
    setDialogOpen(true);
  }, []);

  const handleConfirmDialog = useCallback(() => {
    const sanitizedName = fileName.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
    if (!sanitizedName) return;

    const fullName = sanitizedName.toLowerCase().endsWith('.js')
      ? sanitizedName
      : `${sanitizedName}.js`;

    if (dialogMode === 'add') {
      const newFile: JsFile = {
        id: `js-file-${Date.now()}`,
        name: fullName,
        content: `/* ${fullName} */\n`,
        // New JS files start disabled — user must opt in before the
        // export marks them as active. Matches the legacy-import default.
        enabled: false,
      };
      onFilesChange([...files, newFile]);
      setSelectedFileId(newFile.id);
    } else if (dialogMode === 'rename' && editingFileId) {
      onFilesChange(
        files.map((f) => (f.id === editingFileId ? { ...f, name: fullName } : f)),
      );
    }

    setDialogOpen(false);
    setFileName('');
    setEditingFileId(null);
  }, [fileName, dialogMode, editingFileId, files, onFilesChange]);

  const handleDeleteFile = useCallback((fileId: string) => {
    setFileToDelete(fileId);
    setDeleteConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!fileToDelete) return;

    const newFiles = files.filter((f) => f.id !== fileToDelete);
    onFilesChange(newFiles);

    if (selectedFileId === fileToDelete) {
      setSelectedFileId(newFiles.length > 0 ? newFiles[0].id : null);
    }

    setDeleteConfirmOpen(false);
    setFileToDelete(null);
  }, [fileToDelete, files, onFilesChange, selectedFileId]);

  const handleContentChange = useCallback(
    (content: string) => {
      if (!selectedFileId) return;
      onFilesChange(
        files.map((f) => (f.id === selectedFileId ? { ...f, content } : f)),
      );
    },
    [selectedFileId, files, onFilesChange],
  );

  const handleToggleEnabled = useCallback(
    (fileId: string) => {
      onFilesChange(
        files.map((f) =>
          f.id === fileId ? { ...f, enabled: f.enabled === false } : f,
        ),
      );
    },
    [files, onFilesChange],
  );

  return (
    <div className="flex h-full">
      <div className="w-64 border-r flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">JS Files</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleAddFile}
            data-testid="button-add-js-file"
          >
            <FilePlus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {files.map((file) => {
              const isDisabled = file.enabled === false;
              return (
                <div
                  key={file.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer group ${
                    selectedFileId === file.id
                      ? 'bg-accent text-accent-foreground'
                      : 'hover-elevate'
                  }`}
                  onClick={() => setSelectedFileId(file.id)}
                  data-testid={`js-file-item-${file.id}`}
                >
                  <FileCode2
                    className={`h-4 w-4 shrink-0 ${
                      isDisabled
                        ? 'text-muted-foreground/50'
                        : 'text-muted-foreground'
                    }`}
                  />
                  <span
                    className={`flex-1 text-sm truncate ${
                      isDisabled ? 'text-muted-foreground/70 line-through' : ''
                    }`}
                    title={isDisabled ? `${file.name} (disabled)` : file.name}
                  >
                    {file.name}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <div
                      role="button"
                      aria-pressed={!isDisabled}
                      className={`h-6 w-6 flex items-center justify-center rounded hover:bg-background/50 cursor-pointer transition-opacity ${
                        isDisabled
                          ? 'opacity-100 text-muted-foreground'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleEnabled(file.id);
                      }}
                      title={
                        isDisabled
                          ? 'Enable this file'
                          : 'Disable this file'
                      }
                      data-testid={`js-button-toggle-enabled-${file.id}`}
                    >
                      {isDisabled ? (
                        <PowerOff className="h-3 w-3" />
                      ) : (
                        <Power className="h-3 w-3" />
                      )}
                    </div>
                    <div
                      role="button"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-background/50 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameFile(file.id, file.name);
                      }}
                      data-testid={`js-button-rename-${file.id}`}
                    >
                      <Edit2 className="h-3 w-3" />
                    </div>
                    <div
                      role="button"
                      className="h-6 w-6 flex items-center justify-center rounded hover:bg-background/50 text-destructive cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.id);
                      }}
                      data-testid={`js-button-delete-${file.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              );
            })}

            {files.length === 0 && (
              <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                No JS files yet.
                <br />
                Click + to add one.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedFile ? (
          <>
            <div className="p-3 border-b flex items-center justify-between gap-3">
              <h3 className="font-medium text-sm truncate">{selectedFile.name}</h3>
              <Button
                variant={selectedFile.enabled === false ? 'outline' : 'ghost'}
                size="sm"
                onClick={() => handleToggleEnabled(selectedFile.id)}
                data-testid={`js-button-toggle-enabled-header-${selectedFile.id}`}
                className="shrink-0 h-7"
              >
                {selectedFile.enabled === false ? (
                  <>
                    <PowerOff className="h-3.5 w-3.5 mr-1.5" />
                    Disabled
                  </>
                ) : (
                  <>
                    <Power className="h-3.5 w-3.5 mr-1.5" />
                    Enabled
                  </>
                )}
              </Button>
            </div>
            {selectedFile.enabled === false && (
              <div
                className="px-3 py-2 text-xs bg-muted/50 border-b text-muted-foreground"
                data-testid={`js-notice-disabled-${selectedFile.id}`}
              >
                This file is disabled. The exported theme will include the file
                in <code className="mx-1 text-foreground">js/</code> but mark it
                as inactive — your runtime loader (or a generated index file)
                should skip disabled scripts.
              </div>
            )}
            <div className="flex-1 min-h-0 p-3">
              <SimpleCodeEditor
                value={selectedFile.content}
                onChange={handleContentChange}
                placeholder="// Write your JavaScript here"
                className="h-full"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileCode2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Select a file to edit</p>
              <p className="text-sm">or create a new one</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'add' ? 'Add JS File' : 'Rename File'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="filename"
              className="w-full"
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmDialog()}
              data-testid="js-input-file-name"
            />
            <p className="text-xs text-muted-foreground mt-1">
              .js extension will be added automatically
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDialog} data-testid="js-button-confirm-file">
              {dialogMode === 'add' ? 'Add File' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this JS file. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              data-testid="js-button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
