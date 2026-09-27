import { cn } from '@/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'loading-pulse animate-pulse rounded-sm border border-border/40 bg-muted/70',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
