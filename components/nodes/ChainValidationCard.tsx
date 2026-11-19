'use client';

import { memo, useCallback, useState } from 'react';
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useChainStore } from '@/stores';
import { useChainGeneration } from '@/hooks';

interface ChainValidationCardProps {
  outputNodeId: string;
  className?: string;
}

/**
 * Validation card that appears below output nodes in a chain
 * when the step is awaiting_validation.
 *
 * Three actions:
 * - Approve (green check): Continue chain to next step
 * - Redo (amber refresh): Re-generate this step
 * - Cancel (red X): Stop the entire chain
 *
 * Data flow:
 * - Reads: chain store getStepForOutput() to find chain/step info
 * - Writes: useChainGeneration hooks (approveAndContinue, redoStep, cancelChain)
 * - Triggers: next step generation on approve, re-generation on redo
 */
export const ChainValidationCard = memo(function ChainValidationCard({
  outputNodeId,
  className,
}: ChainValidationCardProps) {
  const isAwaiting = useChainStore((s) => s.isOutputAwaitingValidation(outputNodeId));
  const getStepForOutput = useChainStore((s) => s.getStepForOutput);
  const { approveAndContinue, redoStep, cancelChain } = useChainGeneration();

  const stepInfo = getStepForOutput(outputNodeId);
  const [isActing, setIsActing] = useState(false);

  const handleApprove = useCallback(async () => {
    if (!stepInfo || isActing) return;
    setIsActing(true);
    await approveAndContinue(stepInfo.chain.id, stepInfo.stepIndex);
    // Card will unmount as step status changes, so no need to reset
  }, [stepInfo, approveAndContinue, isActing]);

  const handleRedo = useCallback(async () => {
    if (!stepInfo || isActing) return;
    setIsActing(true);
    await redoStep(stepInfo.chain.id, stepInfo.stepIndex);
  }, [stepInfo, redoStep, isActing]);

  const handleCancel = useCallback(() => {
    if (!stepInfo || isActing) return;
    setIsActing(true);
    cancelChain(stepInfo.chain.id);
  }, [stepInfo, cancelChain, isActing]);

  if (!isAwaiting || !stepInfo) return null;

  const isLastStep = stepInfo.stepIndex >= stepInfo.chain.steps.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur-sm',
          className
        )}
      >
        {/* Step indicator */}
        <span className="mr-1 text-[10px] text-muted-foreground">
          {stepInfo.stepIndex + 1}/{stepInfo.chain.steps.length}
        </span>

        {/* Approve button */}
        <button
          onClick={handleApprove}
          className="group flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:bg-green-500/10"
          title={isLastStep ? 'Approve & Complete Chain' : 'Approve & Continue'}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 group-hover:text-green-400" />
          <span className="text-green-500 group-hover:text-green-400">
            {isLastStep ? 'Done' : 'Next'}
          </span>
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-border/50" />

        {/* Redo button */}
        <button
          onClick={handleRedo}
          className="group flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:bg-amber-500/10"
          title="Redo Generation"
        >
          <RefreshCw className="h-3.5 w-3.5 text-amber-500 group-hover:text-amber-400" />
          <span className="text-amber-500 group-hover:text-amber-400">Redo</span>
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-border/50" />

        {/* Cancel button */}
        <button
          onClick={handleCancel}
          className="group flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors hover:bg-red-500/10"
          title="Cancel Chain"
        >
          <XCircle className="h-3.5 w-3.5 text-red-500 group-hover:text-red-400" />
          <span className="text-red-500 group-hover:text-red-400">Cancel</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
});
