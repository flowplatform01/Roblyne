import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api-url";

type Providers = { google?: boolean; microsoft?: boolean; linkedin?: boolean; discord?: boolean };

export function SocialLogin({ returnTo }: { returnTo: string }) {
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

  const startProvider = (provider: "google" | "microsoft" | "linkedin" | "discord") => {
    const target = new URL(apiUrl(`/api/auth/oauth/${provider}/start`), window.location.origin);
    target.searchParams.set("returnTo", returnTo);
    window.location.assign(target.toString());
  };

  return (
    <div className="mt-6 border-t border-border/50 pt-6">
      <div className="space-y-3">
        {providers.google && <Button type="button" variant="outline" className="h-12 w-full" onClick={() => startProvider("google")}>Continue with Google</Button>}
        {providers.microsoft && <Button type="button" variant="outline" className="h-12 w-full" onClick={() => startProvider("microsoft")}>Continue with Microsoft</Button>}
        {providers.linkedin && <Button type="button" variant="outline" className="h-12 w-full" onClick={() => startProvider("linkedin")}>Continue with LinkedIn</Button>}
        {providers.discord && <Button type="button" variant="outline" className="h-12 w-full" onClick={() => startProvider("discord")}>Continue with Discord</Button>}
      </div>
    </div>
  );
}
