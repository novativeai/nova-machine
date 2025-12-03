'use client';

import { useState, useCallback } from 'react';
import { User, X, Box } from 'lucide-react';
import { useModalStore, useCanvasStore, createNode } from '@/stores';
import { cn } from '@/lib/utils';
import type { ElementType } from '@/types';

export function ElementConfigModal() {
  const { elementConfigModal, closeElementConfigModal } = useModalStore();
  const { addNode } = useCanvasStore();

  const [elementType, setElementType] = useState<ElementType | null>(null);
  const [elementName, setElementName] = useState('');

  const handleCreate = useCallback(() => {
    if (!elementType || !elementName.trim()) return;

    const node = createNode('element', elementConfigModal.position, {
      name: elementName.trim(),
      elementType: elementType,
      frontalImageUrl: '',
      frontalThumbnail: '',
      isHighlighted: false,
    });
    addNode(node);

    // Reset and close
    setElementType(null);
    setElementName('');
    closeElementConfigModal();
  }, [elementType, elementName, elementConfigModal.position, addNode, closeElementConfigModal]);

  const handleClose = () => {
    setElementType(null);
    setElementName('');
    closeElementConfigModal();
  };

  if (!elementConfigModal.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Element</h2>
          <button
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Element Configuration */}
        <div className="mb-6 space-y-4">
          {/* Element Type Selection */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              What type of element is this?
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setElementType('character')}
                className={cn(
                  'flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all',
                  elementType === 'character'
                    ? 'border-[#EF4444] bg-[#EF4444]/10'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-secondary/50'
                )}
              >
                <User
                  className="h-5 w-5"
                  style={{ color: elementType === 'character' ? '#EF4444' : undefined }}
                />
                <span
                  className="font-medium"
                  style={{ color: elementType === 'character' ? '#EF4444' : undefined }}
                >
                  Character
                </span>
              </button>
              <button
                onClick={() => setElementType('object')}
                className={cn(
                  'flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all',
                  elementType === 'object'
                    ? 'border-[#EF4444] bg-[#EF4444]/10'
                    : 'border-border hover:border-muted-foreground/30 hover:bg-secondary/50'
                )}
              >
                <Box
                  className="h-5 w-5"
                  style={{ color: elementType === 'object' ? '#EF4444' : undefined }}
                />
                <span
                  className="font-medium"
                  style={{ color: elementType === 'object' ? '#EF4444' : undefined }}
                >
                  Object
                </span>
              </button>
            </div>
          </div>

          {/* Element Name Input */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              {elementType === 'character' ? 'Character Name' : elementType === 'object' ? 'Object Name' : 'Name'}
            </div>
            <input
              type="text"
              value={elementName}
              onChange={(e) => setElementName(e.target.value)}
              placeholder={elementType === 'character' ? 'e.g., Luna, Hero, Villain' : 'e.g., Magic Sword, Crystal'}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && elementType && elementName.trim()) {
                  handleCreate();
                }
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary/80"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!elementType || !elementName.trim()}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              elementType && elementName.trim()
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'cursor-not-allowed bg-secondary text-muted-foreground'
            )}
          >
            Create Element
          </button>
        </div>
      </div>
    </div>
  );
}
