import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EvenumLogo } from '@/components/branding/EvenumLogo';
import { cn } from '@/lib/utils';

interface LoadingRegionProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function LoadingRegion({ label, children, className }: LoadingRegionProps) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      aria-live="polite"
      className={cn(className)}
      role="status"
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function OrganizationCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-sm border-border/60 bg-card">
      <Skeleton className="h-2 w-full rounded-none border-x-0 border-t-0" />
      <CardHeader className="p-8 pb-4">
        <div className="flex items-start gap-6">
          <Skeleton className="h-16 w-16 shrink-0 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-3 pt-1">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-8 pb-8">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="mt-8 flex gap-6 border-t border-border/50 pt-6">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      </CardContent>
      <div className="border-t border-border/50 bg-muted/10 px-8 py-4">
        <Skeleton className="h-12 w-full" />
      </div>
    </Card>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <LoadingRegion label="Loading organizations" className="w-full">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <OrganizationCardSkeleton key={item} />
        ))}
      </div>
    </LoadingRegion>
  );
}

function DiscoveryCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-sm border-border/60 bg-card">
      <Skeleton className={cn('w-full rounded-none border-x-0 border-t-0', featured ? 'h-80' : 'h-52')} />
      <CardHeader className={cn(featured ? 'px-8 pb-6 pt-8' : 'px-6 pb-4 pt-6')}>
        <Skeleton className="mb-3 h-3 w-28" />
        <Skeleton className={cn('h-7', featured ? 'w-4/5' : 'w-full')} />
        <Skeleton className={cn('mt-2 h-7', featured ? 'w-3/5' : 'w-4/5')} />
      </CardHeader>
      <CardContent className={cn('flex-1', featured ? 'px-8' : 'px-6')}>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="mt-6 flex gap-6 border-t border-border/50 pt-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

function DiscoverySectionSkeleton({
  columns = 'lg:grid-cols-4',
  featured = false,
}: {
  columns?: string;
  featured?: boolean;
}) {
  return (
    <section>
      <div className="mb-10 flex items-center gap-4">
        <Skeleton className="h-[2px] w-12" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className={cn('grid grid-cols-1 gap-8 md:grid-cols-2', columns)}>
        {[0, 1, 2, 3].map((item) => (
          <DiscoveryCardSkeleton key={item} featured={featured && item === 0} />
        ))}
      </div>
    </section>
  );
}

export function DiscoveryLoadingSkeleton({ search = false }: { search?: boolean }) {
  return (
    <LoadingRegion label={search ? 'Loading search results' : 'Loading discovery'} className="w-full">
      {search ? (
        <div className="animate-in fade-in duration-500">
          <Skeleton className="mb-8 h-8 w-72" />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <DiscoveryCardSkeleton key={item} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-32">
          <DiscoverySectionSkeleton columns="lg:grid-cols-3" featured />
          <DiscoverySectionSkeleton />
          <DiscoverySectionSkeleton />
        </div>
      )}
    </LoadingRegion>
  );
}

export function AuthLoadingShell() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="flex h-16 items-center border-b border-border/60 px-4 sm:px-6">
        <EvenumLogo size="md" showWordmark />
      </div>
      <main
        aria-busy="true"
        aria-label="Preparing ROBLYNE"
        aria-live="polite"
        className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-16"
        role="status"
      >
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-sm" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
          <div className="rounded-sm border border-border/60 bg-card p-6 shadow-sm sm:p-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-12 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-12 w-full" />
              </div>
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
          <span className="sr-only">Preparing ROBLYNE</span>
        </div>
      </main>
    </div>
  );
}

export function WorkspaceLoadingSkeleton() {
  return (
    <LoadingRegion label="Loading workspace" className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-border/50 pb-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-sm" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-56 max-w-[60vw]" />
            <Skeleton className="h-4 w-72 max-w-[72vw]" />
          </div>
        </div>
        <Skeleton className="h-11 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item} className="rounded-sm border-border/60 p-5">
            <Skeleton className="mb-4 h-3 w-20" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden border-b border-border/50 pb-3">
        {[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-9 w-24 shrink-0" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item} className="rounded-sm border-border/60 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="mt-8 h-10 w-full" />
          </Card>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function ManagementDetailLoadingSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label} className="space-y-8">
      <div className="flex flex-col gap-6 border-b border-border/50 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <Skeleton className="h-14 w-14 shrink-0 rounded-sm" />
          <div className="space-y-3">
            <Skeleton className="h-9 w-72 max-w-[70vw]" />
            <Skeleton className="h-4 w-96 max-w-[80vw]" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden border-b border-border/50 pb-3">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-10 w-32 shrink-0" />)}
      </div>
      <div className="space-y-5">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item} className="rounded-sm border-border/60 p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
              <Skeleton className="mt-7 h-10 w-full" />
            </Card>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

export function InlineListLoadingSkeleton({ rows = 4, label = "Loading list" }: { rows?: number; label?: string }) {
  return (
    <LoadingRegion label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-sm border border-border/50 bg-card px-4 py-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export function PublicPageLoadingSkeleton({ label = "Loading page" }: { label?: string }) {
  return (
    <LoadingRegion label={label} className="space-y-10">
      <div className="relative overflow-hidden rounded-sm bg-[#0A1628] p-8 sm:p-12">
        <div className="mx-auto max-w-3xl space-y-5 text-center">
          <Skeleton className="mx-auto h-5 w-28 bg-white/10" />
          <Skeleton className="mx-auto h-12 w-4/5 bg-white/10 sm:h-16" />
          <Skeleton className="mx-auto h-5 w-2/3 bg-white/10" />
          <Skeleton className="mx-auto h-11 w-36 bg-white/10" />
        </div>
      </div>
      <div className="container mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Card key={item} className="rounded-sm border-border/60 p-6">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="mt-5 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-4/5" />
            <Skeleton className="mt-7 h-10 w-full" />
          </Card>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function BallotLoadingSkeleton() {
  return (
    <LoadingRegion label="Loading ballot" className="space-y-8">
      <div className="rounded-sm bg-[#0A1628] p-8 sm:p-12">
        <div className="mx-auto max-w-3xl space-y-5 text-center">
          <Skeleton className="mx-auto h-5 w-28 bg-white/10" />
          <Skeleton className="mx-auto h-12 w-4/5 bg-white/10" />
          <Skeleton className="mx-auto h-4 w-2/3 bg-white/10" />
        </div>
      </div>
      <div className="mx-auto max-w-4xl space-y-5 px-4">
        {[0, 1, 2].map((item) => (
          <Card key={item} className="rounded-sm border-border/60 p-5 sm:p-7">
            <Skeleton className="h-6 w-2/5" />
            <Skeleton className="mt-2 h-4 w-3/5" />
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((candidate) => (
                <div key={candidate} className="flex items-center gap-3 rounded-sm border border-border/50 p-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function ParticipationLoadingSkeleton({ label }: { label: string }) {
  return (
    <LoadingRegion label={label} className="space-y-8">
      <div className="rounded-sm bg-[#0A1628] p-8 sm:p-14">
        <div className="mx-auto max-w-3xl space-y-5 text-center">
          <Skeleton className="mx-auto h-5 w-28 bg-white/10" />
          <Skeleton className="mx-auto h-12 w-4/5 bg-white/10" />
          <Skeleton className="mx-auto h-4 w-2/3 bg-white/10" />
        </div>
      </div>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-sm border-border/60 p-6 sm:p-8">
          <Skeleton className="h-7 w-2/5" />
          <div className="mt-7 space-y-5">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="rounded-sm border-border/60 p-6">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="mt-5 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <Skeleton className="mt-8 h-12 w-full" />
        </Card>
      </div>
    </LoadingRegion>
  );
}

export function ResultsLoadingSkeleton() {
  return (
    <LoadingRegion label="Loading results" className="space-y-8">
      <div className="rounded-sm bg-[#0A1628] p-8 sm:p-14">
        <div className="mx-auto max-w-3xl space-y-5 text-center">
          <Skeleton className="mx-auto h-5 w-32 bg-white/10" />
          <Skeleton className="mx-auto h-12 w-4/5 bg-white/10" />
          <Skeleton className="mx-auto h-4 w-2/3 bg-white/10" />
        </div>
      </div>
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item} className="rounded-sm border-border/60 p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-8 w-16" />
          </Card>
        ))}
      </div>
      <div className="mx-auto max-w-5xl space-y-3 px-4">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="flex items-center gap-4 rounded-sm border border-border/50 bg-card p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function RouteLoadingShell() {
  return (
    <div className="min-h-[100dvh] bg-background px-4 py-8 sm:px-8">
      <LoadingRegion label="Opening page" className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between border-b border-border/50 pb-5">
          <Skeleton className="h-8 w-36" />
          <div className="flex gap-3">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/5 max-w-sm" />
          <Skeleton className="h-5 w-3/5 max-w-xl" />
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Card key={item} className="rounded-sm border-border/60 p-6">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="mt-5 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-4/5" />
              <Skeleton className="mt-8 h-10 w-full" />
            </Card>
          ))}
        </div>
      </LoadingRegion>
    </div>
  );
}

export function AdminLoadingSkeleton() {
  return (
    <LoadingRegion label="Loading platform administration" className="space-y-8">
      <div className="flex items-end justify-between border-b border-border/50 pb-6">
        <div className="space-y-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96 max-w-[70vw]" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item} className="rounded-sm border-border/60 p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-8 w-16" />
          </Card>
        ))}
      </div>
      <Card className="rounded-sm border-border/60 p-6">
        <Skeleton className="h-6 w-48" />
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="flex items-center gap-4 border-b border-border/40 pb-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="ml-auto h-8 w-20" />
            </div>
          ))}
        </div>
      </Card>
    </LoadingRegion>
  );
}