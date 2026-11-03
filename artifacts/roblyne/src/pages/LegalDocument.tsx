import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api-url";
import { currentLegalLanguage } from "@/i18n";

type LegalDocument = {
  title: string;
  content: string;
  version: number;
  language: "en" | "fr";
  languageFallback: boolean;
  requestedLanguage: "en" | "fr";
  effectiveAt: string | null;
  updatedAt: string;
};

export default function LegalDocumentPage() {
  const { documentType } = useParams<{ documentType: string }>();
  const { t, i18n } = useTranslation();
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (documentType !== "terms" && documentType !== "privacy") {
      setError("notFound");
      return;
    }
    const controller = new AbortController();
    setDocument(null);
    setError(null);
    void fetch(apiUrl(`/api/legal/${documentType}?lang=${currentLegalLanguage()}`), { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null) as LegalDocument | { error?: string } | null;
        if (!response.ok || !body || !("content" in body)) throw new Error("loadError");
        setDocument(body);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("loadError");
      });
    return () => controller.abort();
  }, [documentType, i18n.language]);

  return (
    <Layout>
      <main className="mx-auto min-h-[70vh] w-full max-w-3xl px-4 py-12 sm:py-16">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-3xl">{document?.title ?? t("legal.documentFallbackTitle")}</CardTitle>
            {document && (
              <p className="text-sm text-muted-foreground">
                {t("legal.version", { version: document.version })} · {document.effectiveAt
                  ? t("legal.effective", { date: new Date(document.effectiveAt).toLocaleDateString(i18n.language) })
                  : t("legal.effectiveOnPublication")}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="space-y-4">
                <p className="text-destructive">{error === "notFound" ? t("legal.notFound") : t("legal.loadError")}</p>
                <Button asChild variant="outline"><Link href="/">{t("legal.returnHome")}</Link></Button>
              </div>
            ) : document ? (
              <div className="space-y-5">
                {document.languageFallback && (
                  <p className="rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground" role="note">
                    {t("legal.languageFallbackNotice", { language: t(`legal.languageNames.${document.language}`) })}
                  </p>
                )}
                <article className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">{document.content}</article>
              </div>
            ) : <p className="text-muted-foreground">{t("legal.loading")}</p>}
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
}
