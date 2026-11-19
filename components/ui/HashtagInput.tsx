'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Hash, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HashtagInputProps {
  /** Currently applied tags */
  tags: string[];
  /** All available tags for autocomplete */
  suggestions: string[];
  /** Callback when a tag is added */
  onAddTag: (tag: string) => void;
  /** Callback when a tag is removed */
  onRemoveTag: (tag: string) => void;
  /** Optional class name */
  className?: string;
  /** Compact mode for use inside nodes */
  compact?: boolean;
}

// Tag color palette (deterministic based on tag string)
const TAG_COLORS = [
  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'bg-green-500/20 text-green-400 border-green-500/30',
  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'bg-red-500/20 text-red-400 border-red-500/30',
  'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function HashtagInput({
  tags,
  suggestions,
  onAddTag,
  onRemoveTag,
  className,
  compact = false,
}: HashtagInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input
  useEffect(() => {
    if (!inputValue.trim()) {
      setFilteredSuggestions([]);
      return;
    }
    const query = inputValue.toLowerCase().replace(/^#/, '');
    const filtered = suggestions
      .filter((s) => s.toLowerCase().includes(query) && !tags.includes(s))
      .slice(0, 5);
    setFilteredSuggestions(filtered);
    setSelectedSuggestionIndex(0);
  }, [inputValue, suggestions, tags]);

  const handleAddTag = useCallback(
    (tag: string) => {
      const normalized = tag.toLowerCase().replace(/^#/, '').trim().replace(/\s+/g, '-');
      if (normalized && !tags.includes(normalized)) {
        onAddTag(normalized);
      }
      setInputValue('');
      setIsEditing(false);
    },
    [tags, onAddTag]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredSuggestions.length > 0) {
          handleAddTag(filteredSuggestions[selectedSuggestionIndex]);
        } else if (inputValue.trim()) {
          handleAddTag(inputValue);
        }
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setInputValue('');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex((i) =>
          Math.min(i + 1, filteredSuggestions.length - 1)
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex((i) => Math.max(i - 1, 0));
      }
    },
    [filteredSuggestions, selectedSuggestionIndex, inputValue, handleAddTag]
  );

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className={cn(
        'flex flex-wrap items-center gap-1',
        compact ? 'gap-0.5' : 'gap-1'
      )}>
        {tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full border',
              getTagColor(tag),
              compact ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs'
            )}
          >
            <Hash className={compact ? 'h-2 w-2' : 'h-3 w-3'} />
            {tag}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTag(tag);
              }}
              className="ml-0.5 rounded-full hover:bg-white/10"
            >
              <X className={compact ? 'h-2 w-2' : 'h-3 w-3'} />
            </button>
          </span>
        ))}

        {isEditing ? (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // Delay to allow click on suggestion
                setTimeout(() => {
                  setIsEditing(false);
                  setInputValue('');
                }, 200);
              }}
              placeholder="#tag"
              autoFocus
              className={cn(
                'bg-transparent outline-none placeholder:text-muted-foreground/50',
                compact ? 'w-16 text-[10px]' : 'w-20 text-xs'
              )}
            />
            {filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 z-50 mt-1 w-32 rounded-md border border-border bg-card p-1 shadow-lg">
                {filteredSuggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    className={cn(
                      'flex w-full items-center gap-1 rounded px-2 py-1 text-xs',
                      index === selectedSuggestionIndex
                        ? 'bg-primary/20 text-primary'
                        : 'text-muted-foreground hover:bg-muted/50'
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAddTag(suggestion);
                    }}
                  >
                    <Hash className="h-3 w-3" />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:border-muted-foreground/50 hover:text-muted-foreground/70 transition-colors',
              compact ? 'px-1 py-0 text-[10px]' : 'px-1.5 py-0.5 text-xs'
            )}
          >
            <Plus className={compact ? 'h-2 w-2' : 'h-3 w-3'} />
          </button>
        )}
      </div>
    </div>
  );
}
