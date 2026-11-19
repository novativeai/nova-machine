'use client';

import { useState, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Sparkles, Loader2, X, CheckCircle2, AlertCircle, Users, Layout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMoodboard } from '@/hooks';

interface MoodboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for the Moodboard tool.
 * User enters a story, Claude decomposes it into a visual moodboard.
 *
 * Data flow:
 * 1. User writes story in textarea
 * 2. Optional style guidance input
 * 3. Submit → useMoodboard.generateMoodboard()
 * 4. Shows plan preview with characters and scenes
 * 5. Tool calls execute to build canvas nodes
 * 6. Dialog shows completion summary
 */
export function MoodboardDialog({ open, onOpenChange }: MoodboardDialogProps) {
  const [story, setStory] = useState('');
  const [style, setStyle] = useState('');
  const {
    generateMoodboard,
    isGenerating,
    storyPlan,
    error,
    executionResults,
    reset,
  } = useMoodboard();

  const handleSubmit = useCallback(async () => {
    if (!story.trim() || isGenerating) return;
    await generateMoodboard(story, style || undefined);
  }, [story, style, isGenerating, generateMoodboard]);

  const handleClose = useCallback(() => {
    if (isGenerating) return;
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      reset();
      setStory('');
      setStyle('');
    }, 200);
  }, [isGenerating, onOpenChange, reset]);

  const successCount = executionResults.filter((r) => r.success).length;
  const failCount = executionResults.filter((r) => !r.success).length;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border/60 bg-card shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/30 px-5 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <Dialog.Title className="text-sm font-medium text-foreground">
                Moodboard Generator
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                disabled={isGenerating}
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="p-5">
            {!storyPlan ? (
              // Input phase
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs text-muted-foreground">
                    Your Story
                  </label>
                  <textarea
                    value={story}
                    onChange={(e) => setStory(e.target.value)}
                    placeholder="Describe the story you want to visualize. Include characters, settings, and key moments. The AI will decompose it into scenes and generation chains..."
                    rows={6}
                    disabled={isGenerating}
                    className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-muted-foreground">
                    Visual Style (optional)
                  </label>
                  <input
                    type="text"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    placeholder="e.g., Cinematic, anime, watercolor, noir, cyberpunk..."
                    disabled={isGenerating}
                    className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={!story.trim() || isGenerating}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                    story.trim() && !isGenerating
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  )}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Moodboard...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Moodboard
                    </>
                  )}
                </button>
              </div>
            ) : (
              // Results phase
              <div className="space-y-4">
                {/* Plan */}
                <div className="rounded-lg bg-muted/20 p-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {storyPlan.plan.slice(0, 300)}
                    {storyPlan.plan.length > 300 ? '...' : ''}
                  </p>
                </div>

                {/* Characters */}
                {storyPlan.characters.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <Users className="h-3.5 w-3.5 text-red-400" />
                      Characters ({storyPlan.characters.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {storyPlan.characters.map((char) => (
                        <span
                          key={char.name}
                          className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs text-red-400"
                        >
                          {char.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scenes */}
                {storyPlan.scenes.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <Layout className="h-3.5 w-3.5 text-blue-400" />
                      Scenes ({storyPlan.scenes.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {storyPlan.scenes.map((scene) => (
                        <span
                          key={scene.title}
                          className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs text-blue-400"
                        >
                          {scene.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Execution results */}
                <div className="flex items-center gap-3 rounded-lg bg-muted/20 p-3">
                  {successCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {successCount} nodes created
                    </div>
                  )}
                  {failCount > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {failCount} failed
                    </div>
                  )}
                </div>

                <button
                  onClick={handleClose}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Done
                </button>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
