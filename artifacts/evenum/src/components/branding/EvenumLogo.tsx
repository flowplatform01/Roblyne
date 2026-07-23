import React from 'react';
import { cn } from '@/lib/utils';

/**
 * EvenumMark — The "Ascent" brand mark (three ascending bars).
 * Renders as an inline SVG so it inherits currentColor.
 * Wrap in a coloured container or set text-* to control colour.
 */
export function EvenumMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 150 150"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {/* Concept 2 — 3D hexagonal diamond mark */}
      <polygon points="44.7 99.1 8.9 133.2 54.8 116.6 44.7 110.8" />
      <polygon points="75.2 16.8 65.4 63.9 75.1 57.9 84.9 64" />
      <polygon points="105.3 99.1 105.3 110.8 95.5 116.6 141.1 133.2" />
      <polygon points="47.9 77.4 47.9 108.9 75.2 124.5 102.2 109 102.3 77.4 75.2 61.7" />
    </svg>
  );
}

interface EvenumLogoProps {
  /** Visual size preset */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to show the wordmark next to the icon */
  showWordmark?: boolean;
  /** className forwarded to the outermost element */
  className?: string;
  /** Icon colour variant */
  variant?: 'solid' | 'mark';
}

const sizeMap = {
  xs: { icon: 'h-6 w-6',   text: 'text-base',  gap: 'gap-1.5' },
  sm: { icon: 'h-7 w-7',   text: 'text-lg',    gap: 'gap-2'   },
  md: { icon: 'h-8 w-8',   text: 'text-xl',    gap: 'gap-2.5' },
  lg: { icon: 'h-11 w-11', text: 'text-2xl',   gap: 'gap-3'   },
  xl: { icon: 'h-14 w-14', text: 'text-3xl',   gap: 'gap-4'   },
};

/**
 * EvenumLogo — Full logo: coloured icon tile + optional "Evenum" wordmark.
 *
 * @example
 * // Navbar usage
 * <EvenumLogo size="md" showWordmark />
 *
 * @example
 * // Auth-page hero usage (large icon, no wordmark)
 * <EvenumLogo size="xl" showWordmark={false} />
 */
export function EvenumLogo({
  size = 'md',
  showWordmark = true,
  className,
  variant = 'solid',
}: EvenumLogoProps) {
  const { icon, text, gap } = sizeMap[size];

  return (
    <span className={cn('inline-flex items-center', gap, className)}>
      {variant === 'solid' ? (
        <span
          className={cn(
            icon,
            'flex items-center justify-center rounded-sm bg-primary text-primary-foreground shrink-0 p-1.5',
          )}
        >
          <EvenumMark className="w-full h-full" />
        </span>
      ) : (
        <span className={cn(icon, 'flex items-center justify-center text-primary shrink-0')}>
          <EvenumMark className="w-full h-full" />
        </span>
      )}

      {showWordmark && (
        <span className={cn('font-serif font-bold tracking-tight text-foreground leading-none select-none', text)}>
          Evenum
        </span>
      )}
    </span>
  );
}

/**
 * EvenumAuthMark — Large standalone icon tile used on auth / splash screens.
 * Renders the Ascent mark on a primary-coloured background.
 */
export function EvenumAuthMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-16 w-16 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-lg p-3',
        className,
      )}
    >
      <EvenumMark className="w-full h-full" />
    </span>
  );
}
