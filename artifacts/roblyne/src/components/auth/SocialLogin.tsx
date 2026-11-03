import { useEffect, useState } from "react";
import { FaDiscord, FaGoogle, FaLinkedin, FaMicrosoft } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api-url";

type Providers = { google?: boolean; microsoft?: boolean; linkedin?: boolean; discord?: boolean };
type Provider = keyof Providers;

type SocialLoginProps = {
  returnTo: string;
  legalDocumentIds?: number[];
  requiresLegalAcceptance?: boolean;
};

const providerDetails: Record<Provider, { label: string; icon: typeof FaGoogle; className: string }> = {
  google: { label: "Google", icon: FaGoogle, className: "text-[#4285F4]" },
  microsoft: { label: "Microsoft", icon: FaMicrosoft, className: "text-[#00A4EF]" },
  linkedin: { label: "LinkedIn", icon: FaLinkedin, className: "text-[#0A66C2]" },
  discord: { label: "Discord", icon: FaDiscord, className: "text-[#5865F2]" },
};

export function SocialLogin({ returnTo, legalDocumentIds = [], requiresLegalAcceptance = false }: SocialLoginProps) {
  const [providers, setProviders] = useState<Providers>({});

  useEffect(() => {
    const controller = new AbortController();
    void fetch(apiUrl("/api/auth/providers"), { credentials: "include", signal: controller.signal })
      .then((response) => response.ok ? response.json() : {})
      .then((body: Providers) => setProviders(body))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (!providers.google && !providers.microsoft && !providers.linkedin && !providers.discord) return null;

  const hasRequiredAcceptance = !requiresLegalAcceptance || legalDocumentIds.length === 2;

  const startProvider = (provider: Provider) => {
    if (!hasRequiredAcceptance) return;
    const target = new URL(apiUrl(`/api/auth/oauth/${provider}/start`), window.location.origin);
    target.searchParams.set("returnTo", returnTo);
    if (requiresLegalAcceptance) target.searchParams.set("legalDocumentIds", legalDocumentIds.join(","));
    window.location.assign(target.toString());
  };

  return (
    <div className="mt-6 border-t border-border/50 pt-6">
      <div className="space-y-3">
        {(Object.keys(providerDetails) as Provider[]).map((provider) => {
          if (!providers[provider]) return null;
          const details = providerDetails[provider];
          const Icon = details.icon;
          return (
            <Button
              key={provider}
              type="button"
              variant="outline"
              className="h-12 w-full justify-center gap-3 border-border/70 bg-background text-base font-medium hover:bg-muted/60"
              disabled={!hasRequiredAcceptance}
              onClick={() => startProvider(provider)}
            >
              <Icon aria-hidden="true" className={`size-5 shrink-0 ${details.className}`} />
              <span>Continue with {details.label}</span>
            </Button>
          );
        })}
      </div>
      {requiresLegalAcceptance && !hasRequiredAcceptance && <p className="mt-3 text-center text-sm text-muted-foreground">Accept the Terms of Service and Privacy Policy to continue with social sign-in.</p>}
    </div>
  );
}
