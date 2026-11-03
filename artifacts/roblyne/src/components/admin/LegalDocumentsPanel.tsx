import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { apiUrl } from "@/lib/api-url";
import { useToast } from "@/hooks/use-toast";

type LegalDocument = {
  id: number; documentType: "terms" | "privacy"; language: "en" | "fr"; title: string; content: string; version: number;
  status: "draft" | "published" | "archived"; effectiveAt: string | null; requiresReacceptance: boolean; publishedAt: string | null;
};

type LegalDocumentForm = { documentType: "terms" | "privacy"; language: "en" | "fr"; title: string; content: string; requiresReacceptance: boolean };
const defaults: LegalDocumentForm = { documentType: "terms", language: "en", title: "", content: "", requiresReacceptance: true };

export function LegalDocumentsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaults);
  const [editingId, setEditingId] = useState<number | null>(null);
  const documents = useQuery({
    queryKey: ["admin", "legal-documents"],
    queryFn: async () => {
      const response = await fetch(apiUrl("/api/admin/legal-documents"), { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load legal documents");
      return response.json() as Promise<LegalDocument[]>;
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const path = editingId ? `/api/admin/legal-documents/${editingId}` : "/api/admin/legal-documents";
      const response = await fetch(apiUrl(path), {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Unable to save legal document");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "legal-documents"] });
      setForm(defaults); setEditingId(null); toast({ title: "Legal document saved" });
    },
    onError: (error: Error) => toast({ title: "Could not save document", description: error.message, variant: "destructive" }),
  });
  const publish = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(apiUrl(`/api/admin/legal-documents/${id}/publish`), {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error || "Unable to publish legal document");
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["admin", "legal-documents"] }); toast({ title: "Legal document published" }); },
    onError: (error: Error) => toast({ title: "Could not publish document", description: error.message, variant: "destructive" }),
  });

  const edit = (document: LegalDocument) => {
    if (document.status !== "draft") return;
    setEditingId(document.id);
    setForm({ documentType: document.documentType, language: document.language, title: document.title, content: document.content, requiresReacceptance: document.requiresReacceptance });
  };

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
    <Card><CardHeader><CardTitle className="font-serif">Legal document management</CardTitle><CardDescription>Publish only owner- or counsel-reviewed policy wording. Published versions remain immutable.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2"><Label>Document</Label><Select value={form.documentType} disabled={editingId !== null} onValueChange={(documentType: "terms" | "privacy") => setForm((current) => ({ ...current, documentType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="terms">Terms of Service</SelectItem><SelectItem value="privacy">Privacy Policy</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Language</Label><Select value={form.language} disabled={editingId !== null} onValueChange={(language: "en" | "fr") => setForm((current) => ({ ...current, language }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="fr">Français</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
        <div className="space-y-2"><Label>Reviewed policy content</Label><Textarea className="min-h-56" value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} /></div>
        <label className="flex items-start gap-3 text-sm"><Checkbox checked={form.requiresReacceptance} onCheckedChange={(value) => setForm((current) => ({ ...current, requiresReacceptance: value === true }))} /><span>Require users to accept this new version before using authenticated areas.</span></label>
        <div className="flex gap-2"><Button disabled={save.isPending || form.title.trim().length < 3 || form.content.trim().length < 20} onClick={() => save.mutate()}>{editingId ? "Save draft" : "Create draft"}</Button>{editingId && <Button variant="outline" onClick={() => { setEditingId(null); setForm(defaults); }}>Cancel</Button>}</div>
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="font-serif">Versions</CardTitle><CardDescription>Only drafts can be edited. Publishing archives the previous published version of the same document.</CardDescription></CardHeader>
      <CardContent className="space-y-3">{documents.isLoading ? <p className="text-sm text-muted-foreground">Loading documents…</p> : documents.isError ? <p className="text-sm text-destructive">Unable to load legal documents.</p> : documents.data?.length ? documents.data.map((document) => <div key={document.id} className="rounded-sm border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{document.title}</p><p className="text-xs text-muted-foreground">{document.documentType} · {document.language.toUpperCase()} · v{document.version}{document.effectiveAt ? ` · effective ${new Date(document.effectiveAt).toLocaleDateString()}` : ""}</p></div><Badge variant={document.status === "published" ? "default" : "secondary"}>{document.status}</Badge></div>{document.status === "draft" && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => edit(document)}>Edit</Button><Button size="sm" onClick={() => publish.mutate(document.id)} disabled={publish.isPending}>Publish</Button></div>}</div>) : <p className="text-sm text-muted-foreground">No documents yet. Create reviewed drafts before launch.</p>}</CardContent>
    </Card>
  </div>;
}
