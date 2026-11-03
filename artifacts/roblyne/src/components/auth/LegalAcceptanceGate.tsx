import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { apiUrl } from "@/lib/api-url";
import { useAuth } from "@/contexts/AuthContext";

type OutstandingDocument = { id: number; documentType: "terms" | "privacy"; title: string; version: number };
type LegalStatus = { required: boolean; documents: OutstandingDocument[] };

export function LegalAcceptanceGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [acceptedIds, setAcceptedIds] = useState<number[]>([]);
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const exemptPath = /^\/(login|register|password-reset|legal)(?:\/|$)/.test(location);
  const status = useQuery({
    queryKey: ["auth", "legal-status"],
    enabled: isAuthenticated && !exemptPath,
    retry: false,
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/auth/legal-status"), { credentials: "include" });
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
        <CardHeader><CardTitle className="font-serif text-2xl">Review updated legal documents</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">Please review and accept the current documents before continuing.</p>
          {documents.map((document) => (
            <label key={document.id} className="flex cursor-pointer items-start gap-3 rounded-sm border p-3 text-sm">
              <Checkbox
                checked={acceptedIds.includes(document.id)}
                onCheckedChange={(value) => setAcceptedIds((current) => value ? [...new Set([...current, document.id])] : current.filter((id) => id !== document.id))}
                className="mt-0.5"
              />
              <span>I accept the <Link href={`/legal/${document.documentType}`} className="font-medium text-primary underline underline-offset-2">{document.title}</Link> (version {document.version}).</span>
            </label>
          ))}
          {status.isError && <p className="text-sm text-destructive">We could not load the legal requirements. Refresh and try again.</p>}
          <Button className="w-full" disabled={!canAccept} onClick={() => void accept()}>Accept and continue</Button>
        </CardContent>
      </Card>
    </main>
  );
}
