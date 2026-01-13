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
  DialogFooter 
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
import { FilePlus, Trash2, Edit2, FileCode } from 'lucide-react';

export interface ScssFile {
  id: string;
  name: string;
  content: string;
}

interface CustomCssManagerProps {
  files: ScssFile[];
  onFilesChange: (files: ScssFile[]) => void;
}

const DEFAULT_FILE: ScssFile = {
  id: 'default',
  name: 'custom.scss',
  content: '/* Add your custom SCSS here */\n',
};

export function CustomCssManager({ files, onFilesChange }: CustomCssManagerProps) {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    files.length > 0 ? files[0].id : null
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'rename'>('add');
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const selectedFile = files.find(f => f.id === selectedFileId);

  const handleAddFile = useCallback(() => {
    setDialogMode('add');
    setFileName('');
    setDialogOpen(true);
  }, []);

  const handleRenameFile = useCallback((fileId: string, currentName: string) => {
    setDialogMode('rename');
    setEditingFileId(fileId);
    setFileName(currentName.replace('.scss', ''));
    setDialogOpen(true);
  }, []);

  const handleConfirmDialog = useCallback(() => {
    const sanitizedName = fileName.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
    if (!sanitizedName) return;

    const fullName = sanitizedName.endsWith('.scss') ? sanitizedName : `${sanitizedName}.scss`;

    if (dialogMode === 'add') {
      const newFile: ScssFile = {
        id: `file-${Date.now()}`,
        name: fullName,
        content: `/* ${fullName} */\n`,
      };
      onFilesChange([...files, newFile]);
      setSelectedFileId(newFile.id);
    } else if (dialogMode === 'rename' && editingFileId) {
      onFilesChange(
        files.map(f => f.id === editingFileId ? { ...f, name: fullName } : f)
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
    
    const newFiles = files.filter(f => f.id !== fileToDelete);
    onFilesChange(newFiles);
    
    if (selectedFileId === fileToDelete) {
      setSelectedFileId(newFiles.length > 0 ? newFiles[0].id : null);
    }
    
    setDeleteConfirmOpen(false);
    setFileToDelete(null);
  }, [fileToDelete, files, onFilesChange, selectedFileId]);

  const handleContentChange = useCallback((content: string) => {
    if (!selectedFileId) return;
    onFilesChange(
      files.map(f => f.id === selectedFileId ? { ...f, content } : f)
    );
  }, [selectedFileId, files, onFilesChange]);

  return (
    <div className="flex h-full">
      <div className="w-64 border-r flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">SCSS Files</h3>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={handleAddFile}
            data-testid="button-add-scss-file"
          >
            <FilePlus className="h-4 w-4" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {files.map((file) => (
              <div
                key={file.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer group ${
                  selectedFileId === file.id 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover-elevate'
                }`}
                onClick={() => setSelectedFileId(file.id)}
                data-testid={`file-item-${file.id}`}
              >
                <FileCode className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-sm truncate">{file.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div
                    role="button"
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-background/50 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); handleRenameFile(file.id, file.name); }}
                    data-testid={`button-rename-${file.id}`}
                  >
                    <Edit2 className="h-3 w-3" />
                  </div>
                  <div
                    role="button"
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-background/50 text-destructive cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                    data-testid={`button-delete-${file.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </div>
                </div>
              </div>
            ))}
            
            {files.length === 0 && (
              <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                No SCSS files yet.
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
            <div className="p-3 border-b">
              <h3 className="font-medium text-sm">{selectedFile.name}</h3>
            </div>
            <div className="flex-1 min-h-0 p-3">
              <SimpleCodeEditor
                value={selectedFile.content}
                onChange={handleContentChange}
                placeholder="/* Write your SCSS here */"
                className="h-full"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
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
              {dialogMode === 'add' ? 'Add SCSS File' : 'Rename File'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="filename"
              className="w-full"
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmDialog()}
              data-testid="input-file-name"
            />
            <p className="text-xs text-muted-foreground mt-1">.scss extension will be added automatically</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDialog} data-testid="button-confirm-file">
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
              This will permanently delete this SCSS file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} data-testid="button-confirm-delete">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { DEFAULT_FILE };
