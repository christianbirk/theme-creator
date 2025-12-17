import { useState, useMemo, useCallback } from 'react';
import { Accordion } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Upload, RotateCcw } from 'lucide-react';
import { VariableGroup } from './VariableGroup';
import { CSSVariable, VariableCategory } from './types';

interface ControlPanelProps {
  categories: VariableCategory[];
  variables: CSSVariable[];
  onVariableChange: (name: string, value: string) => void;
  onResetAll: () => void;
  onResetCategory: (categoryId: string) => void;
  onImportSCSS: (file: File) => void;
}

export function ControlPanel({ 
  categories, 
  variables, 
  onVariableChange, 
  onResetAll, 
  onResetCategory,
  onImportSCSS 
}: ControlPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['brand-colors']);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) {
      return categories.map(cat => ({
        ...cat,
        variables: variables.filter(v => v.category === cat.id)
      }));
    }

    const query = searchQuery.toLowerCase();
    return categories
      .map(cat => ({
        ...cat,
        variables: variables.filter(v => 
          v.category === cat.id && 
          (v.name.toLowerCase().includes(query) || 
           v.description?.toLowerCase().includes(query))
        )
      }))
      .filter(cat => cat.variables.length > 0);
  }, [categories, variables, searchQuery]);

  const modifiedCount = useMemo(() => 
    variables.filter(v => v.value !== v.defaultValue).length
  , [variables]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportSCSS(file);
      e.target.value = '';
    }
  }, [onImportSCSS]);

  return (
    <div className="flex flex-col h-full border-r">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold">Theme Variables</h2>
          <label>
            <input
              type="file"
              accept=".scss,.css"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-import-scss"
            />
            <Button variant="outline" size="sm" asChild>
              <span className="cursor-pointer">
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                Import
              </span>
            </Button>
          </label>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-variables"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Accordion 
          type="multiple" 
          value={expandedCategories}
          onValueChange={setExpandedCategories}
          className="w-full"
        >
          {filteredCategories.map(category => (
            <VariableGroup
              key={category.id}
              category={category}
              variables={category.variables}
              onVariableChange={onVariableChange}
              onResetCategory={onResetCategory}
            />
          ))}
        </Accordion>

        {filteredCategories.length === 0 && searchQuery && (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">No variables found matching "{searchQuery}"</p>
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t bg-muted/30">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            {modifiedCount > 0 ? (
              <span className="font-medium text-foreground">{modifiedCount}</span>
            ) : '0'} of {variables.length} modified
          </span>
          
          {modifiedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetAll}
              className="text-xs h-7"
              data-testid="button-reset-all"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset all
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ControlPanel;
