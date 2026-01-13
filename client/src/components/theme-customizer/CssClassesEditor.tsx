import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Trash2, Edit2, Download, ChevronRight, GripVertical, FolderPlus } from 'lucide-react';
import type { CssClass, CssClassGroup, CssClassesData } from '@shared/schema';

interface StylesXmlResponse {
  success: boolean;
  data: CssClassesData;
  groupCount: number;
  classCount: number;
}

interface ExportXmlResponse {
  success: boolean;
  xml: string;
  lineCount: number;
}

interface CssClassesEditorProps {
  onExportXml?: (xml: string) => void;
  onDataChange?: (data: CssClassesData) => void;
  importedData?: CssClassesData | null;
}

export function CssClassesEditor({ onExportXml, onDataChange, importedData }: CssClassesEditorProps) {
  const { toast } = useToast();
  const [data, setData] = useState<CssClassesData>({ groups: [] });
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<{ groupIndex: number; classIndex: number; cls: CssClass } | null>(null);
  
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<{ index: number; group: CssClassGroup } | null>(null);

  const { isLoading, error } = useQuery<StylesXmlResponse>({
    queryKey: ['/api/styles-xml'],
    staleTime: Infinity,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/styles-xml');
        const result: StylesXmlResponse = await response.json();
        if (result.success) {
          setData(result.data);
          setExpandedGroups([]);
        }
      } catch (err) {
        console.error('Load styles error:', err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (importedData && importedData.groups.length > 0) {
      setData(importedData);
      setExpandedGroups([]);
    }
  }, [importedData]);

  // Notify parent of data changes
  useEffect(() => {
    if (onDataChange && data.groups.length > 0) {
      onDataChange(data);
    }
  }, [data, onDataChange]);

  const exportMutation = useMutation({
    mutationFn: async (exportData: CssClassesData): Promise<ExportXmlResponse> => {
      const response = await apiRequest('POST', '/api/export-styles-xml', { data: exportData });
      return response.json();
    },
    onSuccess: (result) => {
      const blob = new Blob([result.xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'styles.xml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Export successful',
        description: 'styles.xml has been downloaded.',
      });
      
      if (onExportXml) {
        onExportXml(result.xml);
      }
    },
    onError: (err) => {
      console.error('Export error:', err);
      toast({
        title: 'Export failed',
        description: 'Could not generate the XML file.',
        variant: 'destructive',
      });
    }
  });

  const handleExport = useCallback(() => {
    exportMutation.mutate(data);
  }, [data, exportMutation]);

  const handleAddClass = (groupIndex: number) => {
    setEditingClass({
      groupIndex,
      classIndex: -1,
      cls: { name: '', className: '', allow: '', deny: '' }
    });
    setEditDialogOpen(true);
  };

  const handleEditClass = (groupIndex: number, classIndex: number) => {
    const cls = data.groups[groupIndex].classes[classIndex];
    setEditingClass({ groupIndex, classIndex, cls: { ...cls } });
    setEditDialogOpen(true);
  };

  const handleDeleteClass = (groupIndex: number, classIndex: number) => {
    setData(prev => ({
      groups: prev.groups.map((g, gi) => 
        gi === groupIndex 
          ? { ...g, classes: g.classes.filter((_, ci) => ci !== classIndex) }
          : g
      )
    }));
    toast({
      title: 'Class deleted',
      description: 'The CSS class has been removed.',
    });
  };

  const handleSaveClass = () => {
    if (!editingClass) return;
    
    const { groupIndex, classIndex, cls } = editingClass;
    
    if (!cls.name.trim() || !cls.className.trim()) {
      toast({
        title: 'Invalid input',
        description: 'Name and Class name are required.',
        variant: 'destructive',
      });
      return;
    }
    
    setData(prev => ({
      groups: prev.groups.map((g, gi) => {
        if (gi !== groupIndex) return g;
        
        if (classIndex === -1) {
          return { ...g, classes: [...g.classes, cls] };
        } else {
          return {
            ...g,
            classes: g.classes.map((c, ci) => ci === classIndex ? cls : c)
          };
        }
      })
    }));
    
    setEditDialogOpen(false);
    setEditingClass(null);
    
    toast({
      title: classIndex === -1 ? 'Class added' : 'Class updated',
      description: `"${cls.name}" has been ${classIndex === -1 ? 'added' : 'updated'}.`,
    });
  };

  const handleAddGroup = () => {
    setEditingGroup({
      index: -1,
      group: { name: '', classes: [], mode: '', allowLinks: '' }
    });
    setGroupDialogOpen(true);
  };

  const handleEditGroup = (index: number) => {
    const group = data.groups[index];
    setEditingGroup({ index, group: { ...group } });
    setGroupDialogOpen(true);
  };

  const handleDeleteGroup = (index: number) => {
    const groupName = data.groups[index].name;
    setData(prev => ({
      groups: prev.groups.filter((_, i) => i !== index)
    }));
    toast({
      title: 'Group deleted',
      description: `"${groupName}" and all its classes have been removed.`,
    });
  };

  const handleSaveGroup = () => {
    if (!editingGroup) return;
    
    const { index, group } = editingGroup;
    
    if (!group.name.trim()) {
      toast({
        title: 'Invalid input',
        description: 'Group name is required.',
        variant: 'destructive',
      });
      return;
    }
    
    setData(prev => {
      if (index === -1) {
        return { groups: [...prev.groups, group] };
      } else {
        return {
          groups: prev.groups.map((g, i) => 
            i === index ? { ...g, name: group.name, mode: group.mode, allowLinks: group.allowLinks } : g
          )
        };
      }
    });
    
    if (index === -1) {
      setExpandedGroups(prev => [...prev, `group-${data.groups.length}`]);
    }
    
    setGroupDialogOpen(false);
    setEditingGroup(null);
    
    toast({
      title: index === -1 ? 'Group added' : 'Group updated',
      description: `"${group.name}" has been ${index === -1 ? 'added' : 'updated'}.`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading styles...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">CSS Classes</h2>
          <p className="text-sm text-muted-foreground">
            {data.groups.length} groups, {data.groups.reduce((acc, g) => acc + g.classes.length, 0)} classes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleAddGroup}
            data-testid="button-add-group"
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Add Group
          </Button>
          <Button 
            size="sm" 
            onClick={handleExport}
            data-testid="button-export-xml"
          >
            <Download className="h-4 w-4 mr-2" />
            Export XML
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <Accordion 
          type="multiple" 
          value={expandedGroups}
          onValueChange={setExpandedGroups}
          className="w-full"
        >
          {data.groups.map((group, groupIndex) => (
            <AccordionItem 
              key={`group-${groupIndex}`} 
              value={`group-${groupIndex}`}
              className="border-b"
            >
              <AccordionTrigger 
                className="group px-4 py-3 hover:no-underline"
                data-testid={`accordion-group-${groupIndex}`}
              >
                <div className="flex items-center gap-2 flex-1">
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                  <span className="font-medium">{group.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({group.classes.length} classes)
                  </span>
                  {group.mode && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">mode: {group.mode}</span>
                  )}
                  {group.allowLinks && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">links: {group.allowLinks}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mr-2" onClick={e => e.stopPropagation()}>
                  <div
                    role="button"
                    className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); handleEditGroup(groupIndex); }}
                    data-testid={`button-edit-group-${groupIndex}`}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </div>
                  <div
                    role="button"
                    className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent text-destructive cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(groupIndex); }}
                    data-testid={`button-delete-group-${groupIndex}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-1">
                  {group.classes.map((cls, classIndex) => (
                    <div 
                      key={classIndex}
                      className="flex items-center gap-2 p-2 rounded-md hover-elevate bg-muted/30"
                      data-testid={`class-item-${groupIndex}-${classIndex}`}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{cls.name}</span>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">.{cls.className}</code>
                        </div>
                        {(cls.allow || cls.deny) && (
                          <div className="flex items-center gap-2 mt-0.5">
                            {cls.allow && (
                              <span className="text-xs text-muted-foreground truncate">
                                allow: {cls.allow}
                              </span>
                            )}
                            {cls.deny && (
                              <span className="text-xs text-destructive/80 truncate">
                                deny: {cls.deny}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleEditClass(groupIndex, classIndex)}
                        data-testid={`button-edit-class-${groupIndex}-${classIndex}`}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClass(groupIndex, classIndex)}
                        data-testid={`button-delete-class-${groupIndex}-${classIndex}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => handleAddClass(groupIndex)}
                  data-testid={`button-add-class-${groupIndex}`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Class
                </Button>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        
        {data.groups.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm mb-4">No groups found. Create one to get started.</p>
            <Button variant="outline" onClick={handleAddGroup}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Add Group
            </Button>
          </div>
        )}
      </ScrollArea>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingClass?.classIndex === -1 ? 'Add Class' : 'Edit Class'}
            </DialogTitle>
            <DialogDescription>
              Configure the CSS class properties.
            </DialogDescription>
          </DialogHeader>
          {editingClass && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class-name">Display Name</Label>
                <Input
                  id="class-name"
                  value={editingClass.cls.name}
                  onChange={e => setEditingClass(prev => prev ? {
                    ...prev,
                    cls: { ...prev.cls, name: e.target.value }
                  } : null)}
                  placeholder="e.g., Hero with overlay"
                  data-testid="input-class-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-classname">CSS Class Name</Label>
                <Input
                  id="class-classname"
                  value={editingClass.cls.className}
                  onChange={e => setEditingClass(prev => prev ? {
                    ...prev,
                    cls: { ...prev.cls, className: e.target.value }
                  } : null)}
                  placeholder="e.g., overlay"
                  data-testid="input-class-classname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-allow">Allow (modules)</Label>
                <Input
                  id="class-allow"
                  value={editingClass.cls.allow || ''}
                  onChange={e => setEditingClass(prev => prev ? {
                    ...prev,
                    cls: { ...prev.cls, allow: e.target.value }
                  } : null)}
                  placeholder="e.g., HeroModule,MultiBoxModule"
                  data-testid="input-class-allow"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-deny">Deny (modules)</Label>
                <Input
                  id="class-deny"
                  value={editingClass.cls.deny || ''}
                  onChange={e => setEditingClass(prev => prev ? {
                    ...prev,
                    cls: { ...prev.cls, deny: e.target.value }
                  } : null)}
                  placeholder="e.g., TextModule"
                  data-testid="input-class-deny"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveClass} data-testid="button-save-class">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGroup?.index === -1 ? 'Add Group' : 'Edit Group'}
            </DialogTitle>
            <DialogDescription>
              Configure the group properties.
            </DialogDescription>
          </DialogHeader>
          {editingGroup && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="group-name">Group Name</Label>
                <Input
                  id="group-name"
                  value={editingGroup.group.name}
                  onChange={e => setEditingGroup(prev => prev ? {
                    ...prev,
                    group: { ...prev.group, name: e.target.value }
                  } : null)}
                  placeholder="e.g., Design options"
                  data-testid="input-group-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-mode">Mode (optional)</Label>
                <Input
                  id="group-mode"
                  value={editingGroup.group.mode || ''}
                  onChange={e => setEditingGroup(prev => prev ? {
                    ...prev,
                    group: { ...prev.group, mode: e.target.value }
                  } : null)}
                  placeholder="e.g., none"
                  data-testid="input-group-mode"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="group-allowlinks">Allow Links (optional)</Label>
                <Input
                  id="group-allowlinks"
                  value={editingGroup.group.allowLinks || ''}
                  onChange={e => setEditingGroup(prev => prev ? {
                    ...prev,
                    group: { ...prev.group, allowLinks: e.target.value }
                  } : null)}
                  placeholder="e.g., true"
                  data-testid="input-group-allowlinks"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroup} data-testid="button-save-group">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CssClassesEditor;
