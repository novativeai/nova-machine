'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ImageIcon, Video, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTagColor } from '@/lib/fal';
import type { TagType } from '@/types';

export interface TagSuggestion {
  tag: string;           // Display tag: @Alice (for elements with names) or @Image1
  type: TagType;
  nodeId: string;
  thumbnail?: string;
  name?: string;
  elementTag?: string;   // Original element tag for API (@Element1) - only for elements
}

interface TagAutocompleteProps {
  suggestions: TagSuggestion[];
  isOpen: boolean;
  onSelect: (tag: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

export function TagAutocomplete({
  suggestions,
  isOpen,
  onSelect,
  onClose,
  position,
}: TagAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          if (suggestions[selectedIndex]) {
            onSelect(suggestions[selectedIndex].tag);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, suggestions, selectedIndex, onSelect, onClose]);

  if (!isOpen || suggestions.length === 0) return null;

  const getIcon = (type: TagType) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'element':
        return <User className="h-4 w-4" />;
    }
  };

  return (
    <div
      ref={listRef}
      className="absolute z-50 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-1">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          Reference a connected node
        </div>
        {suggestions.map((suggestion, index) => {
          const color = getTagColor(suggestion.type);
          return (
            <button
              key={suggestion.nodeId}
              onClick={() => onSelect(suggestion.tag)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              )}
            >
              <div
                className="flex h-6 w-6 items-center justify-center rounded"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {getIcon(suggestion.type)}
              </div>
              <div className="flex-1 text-left">
                <span style={{ color }}>{suggestion.tag}</span>
                {suggestion.name && (
                  <span className="ml-1 text-muted-foreground">
                    ({suggestion.name})
                  </span>
                )}
              </div>
              {suggestion.thumbnail && (
                <img
                  src={suggestion.thumbnail}
                  alt=""
                  className="h-6 w-6 rounded object-cover"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Hook to manage autocomplete state
export function useTagAutocomplete(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  connectedNodes: TagSuggestion[]
) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [query, setQuery] = useState('');

  const filteredSuggestions = connectedNodes.filter((node) =>
    node.tag.toLowerCase().includes(query.toLowerCase())
  );

  const checkForTrigger = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const text = textarea.value;

    // Find the last @ before cursor
    let atIndex = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
      if (text[i] === '@') {
        atIndex = i;
        break;
      }
      if (text[i] === ' ' || text[i] === '\n') {
        break;
      }
    }

    if (atIndex !== -1) {
      const queryText = text.slice(atIndex + 1, cursorPos);

      // Check if we're still typing the tag (no space after @)
      if (!queryText.includes(' ')) {
        setQuery(queryText);
        setIsOpen(true);

        // Simple positioning below the textarea line
        setPosition({
          top: 24, // Below current line
          left: 0,
        });
        return;
      }
    }

    setIsOpen(false);
    setQuery('');
  }, [textareaRef]);

  const insertTag = useCallback(
    (tag: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPos = textarea.selectionStart;
      const text = textarea.value;

      // Find where the @ starts
      let atIndex = cursorPos - 1;
      while (atIndex >= 0 && text[atIndex] !== '@') {
        atIndex--;
      }

      // Replace @query with the full tag
      const before = text.slice(0, atIndex);
      const after = text.slice(cursorPos);
      const newText = before + tag + ' ' + after;

      // Update the textarea value
      const event = new Event('input', { bubbles: true });
      textarea.value = newText;
      textarea.dispatchEvent(event);

      // Move cursor after the tag
      const newCursorPos = atIndex + tag.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();

      setIsOpen(false);
      setQuery('');

      return newText;
    },
    [textareaRef]
  );

  return {
    isOpen,
    position,
    suggestions: filteredSuggestions,
    checkForTrigger,
    insertTag,
    close: () => setIsOpen(false),
  };
}
