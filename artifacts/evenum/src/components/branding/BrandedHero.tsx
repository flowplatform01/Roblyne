import React from 'react';
import { cn } from '@/lib/utils';
import { useOrgBranding } from '@/lib/branding';

interface BrandedHeroProps {
  title: string;
  subtitle?: string | null;
  org?: any;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  imageUrl?: string | null;
  size?: 'default' | 'small' | 'large';
  logoUrl?: string | null;
}

export function BrandedHero({ title, subtitle, org, badge, actions, className, imageUrl, size = 'default', logoUrl }: BrandedHeroProps) {
  const brandingStyle = useOrgBranding(org);
  const hasImage = !!imageUrl;

  return (
    <div 
      className={cn(
        "relative w-full overflow-hidden flex flex-col justify-end transition-all",
        size === 'small' ? 'min-h-[25vh] pt-16 pb-8' : size === 'large' ? 'min-h-[60vh] pt-32 pb-16' : 'min-h-[40vh] pt-24 pb-12',
        !hasImage && 'bg-[#0A1628]',
        className
      )}
      style={brandingStyle}
    >
      {hasImage ? (
        <>
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${imageUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 opacity-[0.15]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A1628] via-transparent to-transparent" />
        </div>
      )}

      <div className={cn("container mx-auto px-4 relative z-10", hasImage ? "text-white" : "")}>
        <div className="max-w-4xl">
          {logoUrl && (
            <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-white/20 mb-6 bg-background shadow-lg shrink-0">
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {badge}
            {org?.name && !logoUrl && (
              <span className={cn(
                "text-sm font-bold uppercase tracking-widest",
                hasImage ? "text-white/70" : "text-primary/80"
              )}>
                {org.name}
              </span>
            )}
          </div>
          <h1 className={cn(
            "font-serif font-bold tracking-tight mb-4",
            size === 'small' ? 'text-3xl md:text-4xl' : size === 'large' ? 'text-5xl md:text-7xl' : 'text-4xl md:text-6xl',
            hasImage ? 'text-white' : 'text-white drop-shadow-sm'
          )}>
            {title}
          </h1>
          {subtitle && (
            <p className={cn(
              "text-lg md:text-xl font-light max-w-2xl",
              hasImage ? 'text-white/80' : 'text-slate-300'
            )}>
              {subtitle}
            </p>
          )}
          {actions && (
            <div className="mt-8 flex flex-wrap gap-4 items-center">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
