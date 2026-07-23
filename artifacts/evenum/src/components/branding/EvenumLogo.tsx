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
      {/* Concept 3 — faceted geometric lattice mark */}
      <polygon points="69.4 35.9 67.5 37.1 75.1 44.3 81.4 38.1 111.3 38.1 123.8 50.5 123.9 26.5 77.8 26.5" />
      <polygon points="42.1 40.2 42.1 57 75.4 23.7 91.1 23.6 75.1 7.7" />
      <polygon points="38.1 38.7 51.1 26.3 26.2 26.3 26.2 72.1 37.2 82.6 44.8 75.2 38.1 68.5" />
      <polygon points="64.8 39.7 42.1 62.8 42.1 66.9 47.6 72.5 72.3 46.9" />
      <polygon points="23.3 74.6 23.3 59 7.2 75.2 40.3 107.9 56.9 107.9 23.3 74.7" />
      <polygon points="39.8 85.3 62.6 107.9 67 107.9 72.3 102.3 47.6 77.8" />
      <polygon points="68.7 112.2 38.9 112.2 26.2 98.7 26.2 123.5 72.1 123.5 82.4 113.3 75.1 105.1" />
      <path d="m75.1 50-24.6 25.2 24.7 24.1 24.7-24.5-24.8-24.8z" />
      <polygon points="83.1 41.9 77.7 46.9 102.5 72.5 110.3 64.8 87.7 41.9" />
      <polygon points="93.4 41.9 126.7 75.6 126.7 91 143 75.2 109.6 41.9" />
      <polygon points="105.2 75.1 112.1 81.6 112 111.5 99.2 123.6 123.7 123.6 123.7 78.1 113.3 67.5" />
      <polygon points="77.7 102.2 85.4 110.3 107.9 87.4 107.9 83.3 102.5 77.8" />
      <polygon points="74.9 126.4 58.9 126.4 75.1 142.3 107.9 109.9 107.9 92.8" />
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
