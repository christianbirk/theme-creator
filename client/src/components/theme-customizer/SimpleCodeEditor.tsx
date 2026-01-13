import { useRef, useEffect, useState, useCallback } from 'react';

interface SimpleCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  language?: string;
  className?: string;
}

export function SimpleCodeEditor({ 
  value, 
  onChange, 
  placeholder = '',
  className = ''
}: SimpleCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  const updateLineNumbers = useCallback(() => {
    const lines = value.split('\n').length;
    setLineCount(Math.max(lines, 1));
  }, [value]);

  useEffect(() => {
    updateLineNumbers();
  }, [value, updateLineNumbers]);

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }
  };

  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className={`flex h-full border rounded-md overflow-hidden bg-muted/30 ${className}`}>
      <div 
        ref={lineNumbersRef}
        className="flex-shrink-0 bg-muted/50 text-muted-foreground text-right select-none overflow-hidden border-r"
        style={{ width: '3rem' }}
      >
        <div className="py-2 px-2 font-mono text-sm leading-6">
          {lineNumbers.map(num => (
            <div key={num} className="h-6">{num}</div>
          ))}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 p-2 font-mono text-sm leading-6 bg-transparent border-0 resize-none focus:outline-none focus:ring-0"
        style={{ tabSize: 2 }}
        spellCheck={false}
        data-testid="code-editor-textarea"
      />
    </div>
  );
}
