'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const textureButtonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_1px_2px_0_rgba(0,0,0,0.1)] hover:from-primary/90 hover:to-primary/80 active:shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.2)]',
        accent:
          'bg-gradient-to-b from-cyan-500 to-cyan-600 text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_1px_2px_0_rgba(0,0,0,0.1)] hover:from-cyan-400 hover:to-cyan-500 active:shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.2)]',
        secondary:
          'bg-gradient-to-b from-secondary to-secondary/90 text-secondary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_1px_2px_0_rgba(0,0,0,0.1)] hover:from-secondary/90 hover:to-secondary/80 active:shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.2)]',
        destructive:
          'bg-gradient-to-b from-destructive to-destructive/90 text-destructive-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_1px_2px_0_rgba(0,0,0,0.1)] hover:from-destructive/90 hover:to-destructive/80 active:shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.2)]',
        minimal:
          'bg-transparent text-foreground hover:bg-secondary/50 active:bg-secondary/70',
        ghost:
          'hover:bg-accent hover:text-accent-foreground',
        icon:
          'bg-gradient-to-b from-secondary to-secondary/90 text-secondary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:from-secondary/90 hover:to-secondary/80',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-10 px-4 py-2',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface TextureButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof textureButtonVariants> {
  loading?: boolean;
}

const TextureButton = React.forwardRef<HTMLButtonElement, TextureButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(textureButtonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
TextureButton.displayName = 'TextureButton';

export { TextureButton, textureButtonVariants };
