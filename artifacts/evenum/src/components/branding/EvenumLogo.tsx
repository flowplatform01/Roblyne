import React from 'react';
import { cn } from '@/lib/utils';

/**
 * ROBYNE mark: two incoming paths meet in a custom open R form.
 * Renders as an inline SVG so it inherits currentColor.
 * Wrap in a coloured container or set text-* to control colour.
 */
export function EvenumMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M19 50V14h15a11 11 0 0 1 0 22H19"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m33 36 17 15"
        stroke="#62D9B8"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 19h7M8 45h7"
        stroke="#62D9B8"
        strokeWidth="4"
        strokeLinecap="round"
      />
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
 * EvenumLogo — Shared brand component for the ROBYNE mark and wordmark.
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
            'flex items-center justify-center rounded-sm bg-[#09263E] text-white shrink-0 p-1.5',
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
          ROBYNE
        </span>
      )}
    </span>
  );
}

/**
 * EvenumAuthMark — Large standalone ROBYNE icon tile used on auth / splash screens.
 */
export function EvenumAuthMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-16 w-16 items-center justify-center rounded-sm bg-[#09263E] text-white shadow-lg p-3',
        className,
      )}
    >
      <EvenumMark className="w-full h-full" />
    </span>
  );
}
