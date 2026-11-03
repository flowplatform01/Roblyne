import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api-url";

type LegalDocument = {
  title: string;
  content: string;
  version: number;
  effectiveAt: string | null;
  updatedAt: string;
};

export default function LegalDocumentPage() {
  const { documentType } = useParams<{ documentType: string }>();
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (documentType !== "terms" && documentType !== "privacy") {
      setError("Legal document not found");
      return;
    }
    const controller = new AbortController();
    setDocument(null);
    setError(null);
    void fetch(apiUrl(`/api/legal/${documentType}`), { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null) as LegalDocument | { error?: string } | null;
        if (!response.ok || !body || !("content" in body)) throw new Error(body && "error" in body ? body.error : "Unable to load legal document");
        setDocument(body);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "Unable to load legal document");
      });
    return () => controller.abort();
  }, [documentType]);

  return (
    <Layout>
      <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-4 py-12 sm:py-16">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-3xl">{document?.title ?? "Legal document"}</CardTitle>
            {document && <p className="text-sm text-muted-foreground">Version {document.version} · Effective {document.effectiveAt ? new Date(document.effectiveAt).toLocaleDateString() : "on publication"}</p>}
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="space-y-4"><p className="text-destructive">{error}</p><Button asChild variant="outline"><Link href="/">Return home</Link></Button></div>
            ) : document ? (
              <article className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">{document.content}</article>
            ) : <p className="text-muted-foreground">Loading document…</p>}
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
