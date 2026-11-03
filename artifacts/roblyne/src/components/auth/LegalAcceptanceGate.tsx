import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { apiUrl } from "@/lib/api-url";
import { currentLegalLanguage } from "@/i18n";
import { useAuth } from "@/contexts/AuthContext";

type OutstandingDocument = { id: number; documentType: "terms" | "privacy"; title: string; version: number };
type LegalStatus = { required: boolean; documents: OutstandingDocument[] };

export function LegalAcceptanceGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const [acceptedIds, setAcceptedIds] = useState<number[]>([]);
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const exemptPath = /^\/(login|register|password-reset|legal)(?:\/|$)/.test(location);
  const status = useQuery({
    queryKey: ["auth", "legal-status", i18n.language],
    enabled: isAuthenticated && !exemptPath,
    retry: false,
    queryFn: async () => {
      const response = await fetch(apiUrl(`/api/auth/legal-status?lang=${currentLegalLanguage()}`), { credentials: "include" });
      if (!response.ok) throw new Error("Unable to check current legal documents");
      return response.json() as Promise<LegalStatus>;
    },
  });

  if (isLoading || !isAuthenticated || exemptPath || !status.data?.required) return <>{children}</>;
  const documents = status.data.documents;
  const canAccept = documents.length > 0 && documents.every((document) => acceptedIds.includes(document.id));
  const accept = async () => {
    const response = await fetch(apiUrl("/api/auth/legal-acceptances"), {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ documentIds: acceptedIds }),
    });
    if (response.ok) await queryClient.invalidateQueries({ queryKey: ["auth", "legal-status"] });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl">
        <CardHeader><CardTitle className="font-serif text-2xl">{t("legal.gateTitle")}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">{t("legal.gateDescription")}</p>
          {documents.map((document) => (
            <label key={document.id} className="flex cursor-pointer items-start gap-3 rounded-sm border p-3 text-sm">
              <Checkbox
                checked={acceptedIds.includes(document.id)}
                onCheckedChange={(value) => setAcceptedIds((current) => value ? [...new Set([...current, document.id])] : current.filter((id) => id !== document.id))}
                aria-label={t("auth.acceptDocumentAria", { title: document.title })}
                className="mt-0.5"
              />
              <span>
                <Trans
                  i18nKey="legal.gateAcceptLabel"
                  values={{ title: document.title }}
                  components={{ legalLink: <Link href={`/legal/${document.documentType}`} className="font-medium text-primary underline underline-offset-2" /> }}
                />
              </span>
            </label>
          ))}
          {status.isError && <p className="text-sm text-destructive">{t("legal.gateLoadError")}</p>}
          <Button className="w-full" disabled={!canAccept} onClick={() => void accept()}>{t("legal.gateContinue")}</Button>
        </CardContent>
      </Card>
    </main>
  );
}
