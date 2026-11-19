'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Loader2, X, ChevronRight, CheckCircle2, AlertCircle, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIStore } from '@/stores';
import { useAICommand } from '@/hooks';

/**
 * Floating AI command bar triggered by Cmd+K.
 *
 * Data flow:
 * 1. User types command → local state
 * 2. Submit → useAICommand.executeCommand()
 * 3. AI store updates: isProcessing → plan → progress → done/error
 * 4. UI reflects each state transition
 *
 * Keyboard:
 * - Cmd+K: Toggle open/close
 * - Enter: Submit command
 * - Escape: Close (if not processing)
 * - Up/Down: Navigate history
 */
export function CommandBar() {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    isCommandBarOpen,
    isProcessing,
    currentPlan,
    executionProgress,
    commandHistory,
    lastError,
    closeCommandBar,
  } = useAIStore();

  const { executeCommand } = useAICommand();

  // Auto-focus input when opened
  useEffect(() => {
    if (isCommandBarOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCommandBarOpen]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isProcessing) return;
      const command = input.trim();
      setInput('');
      setHistoryIndex(-1);
      await executeCommand(command);
    },
    [input, isProcessing, executeCommand]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isProcessing) {
          closeCommandBar();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length > 0) {
          const nextIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
          setHistoryIndex(nextIndex);
          setInput(commandHistory[nextIndex]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
          const nextIndex = historyIndex - 1;
          setHistoryIndex(nextIndex);
          setInput(commandHistory[nextIndex]);
        } else {
          setHistoryIndex(-1);
          setInput('');
        }
      }
    },
    [isProcessing, closeCommandBar, commandHistory, historyIndex]
  );

  if (!isCommandBarOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.97 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="fixed left-1/2 top-20 z-[100] w-full max-w-xl -translate-x-1/2"
      >
        <div className="rounded-xl border border-border/60 bg-card/95 shadow-2xl backdrop-blur-md">
          {/* Input area */}
          <form onSubmit={handleSubmit} className="flex items-center gap-3 px-4 py-3">
            {isProcessing ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            ) : (
              <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setHistoryIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI to do something on the canvas..."
              disabled={isProcessing}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
            />
            {input && !isProcessing && (
              <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Enter
              </kbd>
            )}
            <button
              type="button"
              onClick={closeCommandBar}
              disabled={isProcessing}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </form>

          {/* Plan display */}
          {currentPlan && (
            <div className="border-t border-border/30 px-4 py-3">
              <div className="flex items-start gap-2">
                <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {currentPlan}
                </p>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {isProcessing && executionProgress.total > 0 && (
            <div className="border-t border-border/30 px-4 py-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {executionProgress.currentTool === 'done'
                    ? 'Complete'
                    : `Running: ${executionProgress.currentTool}`}
                </span>
                <span>
                  {executionProgress.completed}/{executionProgress.total}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/30">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{
                    width: `${(executionProgress.completed / executionProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Success state */}
          {!isProcessing && currentPlan && !lastError && executionProgress.total > 0 && (
            <div className="border-t border-border/30 px-4 py-2">
              <div className="flex items-center gap-1.5 text-xs text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  Executed {executionProgress.completed} operation{executionProgress.completed !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}

          {/* Error display */}
          {lastError && (
            <div className="border-t border-border/30 px-4 py-2">
              <div className="flex items-start gap-1.5 text-xs text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{lastError}</span>
              </div>
            </div>
          )}

          {/* History hint */}
          {!isProcessing && !currentPlan && commandHistory.length > 0 && (
            <div className="border-t border-border/30 px-4 py-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                <History className="h-3 w-3" />
                <span>Press ↑ for recent commands</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Backdrop */}
      {isCommandBarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99] bg-black/20"
          onClick={() => {
            if (!isProcessing) closeCommandBar();
          }}
        />
      )}
    </AnimatePresence>
  );
}
