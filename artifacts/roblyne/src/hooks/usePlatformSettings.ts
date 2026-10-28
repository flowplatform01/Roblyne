import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type PlatformSettings = {
  defaultCurrency?: string;
  supportedCurrencies?: string;
  supportEmail?: string | null;
  supportPhone?: string | null;
  supportWhatsapp?: string | null;
  supportUrl?: string | null;
};

export function usePlatformSettings() {
  return useQuery<PlatformSettings>({
    queryKey: ["platform-settings", "public"],
    queryFn: () => customFetch<PlatformSettings>('/api/admin/platform-settings/public'),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
