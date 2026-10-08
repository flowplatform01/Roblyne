import React, { useState, useCallback } from 'react';
import { useRoute, Link } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { 
  useGetCampaign, 
  useUpdateCampaign,
  useListCampaignSubmissions,
  useGetCampaignAnalytics,
  getGetCampaignQueryKey,
  getListCampaignSubmissionsQueryKey,
  getGetCampaignAnalyticsQueryKey,
  exportCampaignSubmissions
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Megaphone, ArrowLeft, MoreVertical, Play, Square, ExternalLink, BarChart3, Copy, FormInput, ListFilter, Download, Eye, Save, Plus, Trash2 } from "lucide-react";
import { ShareButton } from "@/components/branding/ShareButton";
import { ImageUpload } from "@/components/ui/image-upload";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccentColorPicker } from "@/components/branding/AccentColorPicker";
import { format } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import { ManagementDetailLoadingSkeleton, InlineListLoadingSkeleton } from "@/components/loading/LoadingStates";
import { EntityRecoveryActions } from "@/components/management/EntityRecoveryActions";

type CampaignFieldType = "text" | "textarea" | "email" | "phone" | "number" | "select" | "checkbox" | "date";
type EditableCampaignField = {
  id: string;
  label: string;
  type: CampaignFieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
};

export default function CampaignDetail() {
  const [match, params] = useRoute("/campaigns/:id");
  const campaignId = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("submissions");
  const [isExporting, setIsExporting] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState<any | null>(null);
  const [pendingStatus, setPendingStatus] = useState<"active" | "ended" | null>(null);
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [formFieldsDraft, setFormFieldsDraft] = useState<EditableCampaignField[]>([]);

  const { data: campaign, isLoading: isCampaignLoading } = useGetCampaign(campaignId);
  const { data: submissions, isLoading: isSubmissionsLoading } = useListCampaignSubmissions(campaignId, {
    query: { queryKey: getListCampaignSubmissionsQueryKey(campaignId), enabled: activeTab === "submissions" },
  });
  const { data: analytics, isLoading: isAnalyticsLoading } = useGetCampaignAnalytics(campaignId, {
    query: { queryKey: getGetCampaignAnalyticsQueryKey(campaignId), enabled: activeTab === "analytics" },
  });
  
  const updateCampaign = useUpdateCampaign();

  if (isCampaignLoading) {
    return (
      <DashboardLayout>
        <ManagementDetailLoadingSkeleton label="Loading campaign" />
      </DashboardLayout>
    );
  }

  if (!campaign) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Campaign Not Found</h2>
          <Button asChild><Link href="/dashboard">Return to Dashboard</Link></Button>
        </div>
      </DashboardLayout>
    );
  }

  const handleStatusChange = (newStatus: 'draft' | 'active' | 'ended') => {
    updateCampaign.mutate(
      { campaignId, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
          toast({ title: `Campaign marked as ${newStatus}` });
        },
        onError: (error) => {
          toast({
            title: "Could not update campaign status",
            description: error instanceof Error ? error.message : "Please try again.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const canEditFormFields = campaign.status === "draft" && (campaign.submissionsCount ?? 0) === 0;
  const beginFormFieldEditing = () => {
    setFormFieldsDraft(((campaign.fields ?? []) as EditableCampaignField[]).map((field) => ({ ...field })));
    setIsEditingFields(true);
  };
  const addFormField = () => {
    const id = `field_${Date.now().toString(36)}_${formFieldsDraft.length + 1}`;
    setFormFieldsDraft((fields) => [...fields, {
      id,
      label: "New field",
      type: "text",
      required: false,
    }]);
  };
  const moveFormField = (index: number, direction: -1 | 1) => {
    setFormFieldsDraft((fields) => {
      const target = index + direction;
      if (target < 0 || target >= fields.length) return fields;
      const next = [...fields];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const handleSaveFormFields = () => {
    const ids = formFieldsDraft.map((field) => field.id);
    const hasInvalidField = formFieldsDraft.some((field) => (
      !field.id.trim()
      || !field.label.trim()
      || (field.type === "select" && !(field.options ?? []).some((option) => option.trim()))
    ));
    if (hasInvalidField || new Set(ids).size !== ids.length) {
      toast({
        title: "Check the form fields",
        description: "Each field needs a label, a unique response key, and select fields need at least one option.",
        variant: "destructive",
      });
      return;
    }

    updateCampaign.mutate(
      {
        campaignId,
        data: {
          fields: formFieldsDraft.map((field) => ({
            ...field,
            label: field.label.trim(),
            options: field.type === "select"
              ? (field.options ?? []).map((option) => option.trim()).filter(Boolean)
              : undefined,
            placeholder: field.placeholder?.trim() || undefined,
          })),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
          setIsEditingFields(false);
          toast({ title: "Campaign form updated" });
        },
        onError: (error: any) => {
          toast({
            title: "Could not update the campaign form",
            description: error?.data?.error || "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const csvText = await exportCampaignSubmissions(campaignId);
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `campaign-${campaignId}-submissions.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "CSV exported successfully" });
    } catch {
      toast({ title: "Failed to export CSV", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const copyFormLink = () => {
    const url = `${window.location.origin}/campaigns/${campaign.id}/participate`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard" });
  };

  const getStatusBadge = () => {
    switch (campaign.status) {
      case 'active': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Active</Badge>;
      case 'draft': return <Badge variant="outline" className="bg-slate-100 text-slate-800">Draft</Badge>;
      case 'ended': return <Badge variant="secondary">Ended</Badge>;
      default: return null;
    }
  };

  return (
    <DashboardLayout orgId={campaign.orgId.toString()}>
      <div className="mb-6">
        <Button variant="ghost" asChild className="-ml-4 text-muted-foreground mb-4">
          <Link href={`/organizations/${campaign.orgId}?tab=campaigns`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Organization
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded bg-amber-100 text-amber-700 flex items-center justify-center">
                <Megaphone className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-serif font-bold tracking-tight">{campaign.title}</h1>
              {getStatusBadge()}
            </div>
            {campaign.description && <p className="text-muted-foreground max-w-3xl mt-2">{campaign.description}</p>}
            
            <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Badge variant="outline" className="capitalize">{campaign.type}</Badge></span>
              <span className="flex items-center gap-1.5"><Badge variant="outline">{campaign.visibility}</Badge></span>
              {campaign.requiresPayment && <span className="flex items-center gap-1.5 font-medium text-emerald-600">Requires {formatCurrency(campaign.paymentAmount, campaign.currency || "XAF", i18n.language.startsWith("fr") ? "fr-FR" : "en-US")} fee</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {campaign.status === 'active' && (
              <Button onClick={copyFormLink} variant="outline">
                <Copy className="mr-2 h-4 w-4" /> Copy Form Link
              </Button>
            )}
            
            <Button asChild variant={campaign.status === 'active' ? "default" : "secondary"}>
              <Link href={`/campaigns/${campaign.id}/participate`}>
                <ExternalLink className="mr-2 h-4 w-4" /> View Public Form
              </Link>
            </Button>
            <ShareButton
              url={`${window.location.origin}/campaigns/${campaign.id}/participate`}
              title={campaign.title}
              description={campaign.description || `Participate in ${campaign.title}`}
              ctaLabel="Share Campaign"
              variant="icon"
            />
            <EntityRecoveryActions kind="campaign" entity={campaign} />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Campaign actions"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {campaign.status === 'draft' && (
                  <DropdownMenuItem onClick={() => setPendingStatus('active')}>
                    <Play className="mr-2 h-4 w-4 text-emerald-600" /> Start Campaign
                  </DropdownMenuItem>
                )}
                {campaign.status === 'active' && (
                  <DropdownMenuItem onClick={() => setPendingStatus('ended')}>
                    <Square className="mr-2 h-4 w-4 text-amber-600" /> End Campaign
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <AlertDialog open={pendingStatus !== null} onOpenChange={(open) => { if (!open) setPendingStatus(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingStatus === "active" ? "Start this campaign?" : "End this campaign?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === "active"
                ? "The public form will open and people can begin submitting responses or contributions."
                : "New responses will stop. Existing submissions and financial records will be preserved, and an ended campaign cannot be reopened."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateCampaign.isPending}>Keep current status</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingStatus || updateCampaign.isPending}
              className={pendingStatus === "ended" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
              onClick={(event) => {
                event.preventDefault();
                if (!pendingStatus) return;
                handleStatusChange(pendingStatus);
                setPendingStatus(null);
              }}
            >
              {pendingStatus === "active" ? "Start campaign" : "End campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 border-b rounded-none bg-transparent p-0 w-full justify-start h-auto overflow-x-auto scrollbar-none">
              <TabsTrigger 
                value="submissions" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap shrink-0"
              >
                Submissions
              </TabsTrigger>
              <TabsTrigger 
                value="form" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap shrink-0"
              >
                Form Schema
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap shrink-0"
              >
                Analytics
              </TabsTrigger>
              <TabsTrigger 
                value="branding" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap shrink-0"
              >
                Branding
              </TabsTrigger>
            </TabsList>

            <TabsContent value="submissions" className="mt-0 space-y-6">
              {isSubmissionsLoading ? (
                <InlineListLoadingSkeleton rows={5} label="Loading submissions" />
              ) : !submissions || submissions.length === 0 ? (
                <Card className="border-dashed bg-muted/20">
                  <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <ListFilter className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No submissions yet</h3>
                    <p className="text-muted-foreground">When people fill out your form, their data will appear here.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-muted-foreground border-b border-border/50">
                        <tr>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Name</th>
                          <th className="px-4 py-3 font-medium">Email</th>
                          {campaign.requiresPayment && <th className="px-4 py-3 font-medium">Payment</th>}
                          <th className="px-4 py-3 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {submissions.map(sub => (
                          <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {format(new Date(sub.submittedAt), 'MMM d, yyyy HH:mm')}
                            </td>
                            <td className="px-4 py-3 font-medium">{sub.submitterName}</td>
                            <td className="px-4 py-3">{sub.submitterEmail}</td>
                            {campaign.requiresPayment && (
                              <td className="px-4 py-3">
                                {sub.status === 'confirmed' ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-none">Paid</Badge>
                                ) : (
                                  <Badge variant="secondary">Pending</Badge>
                                )}
                              </td>
                            )}
                            <td className="px-4 py-3 text-right">
                              <Button variant="ghost" size="sm" onClick={() => setViewingSubmission(sub)}>
                                <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="form" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FormInput className="h-5 w-5 text-muted-foreground" />
                        Form Schema
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {canEditFormFields
                          ? "Edit the questions contributors answer when submitting this campaign form."
                          : "Form structure is locked after the campaign leaves draft or receives a submission."}
                      </CardDescription>
                    </div>
                    {!isEditingFields && (
                      <Button variant="outline" onClick={beginFormFieldEditing} disabled={!canEditFormFields}>
                        <FormInput className="mr-2 h-4 w-4" /> Edit fields
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditingFields ? (
                    <div className="space-y-4">
                      {formFieldsDraft.map((field, index) => (
                        <div key={field.id} className="grid gap-4 rounded-lg border border-border/70 bg-muted/5 p-4 md:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`campaign-field-label-${index}`}>Field label</Label>
                            <Input
                              id={`campaign-field-label-${index}`}
                              value={field.label}
                              onChange={(event) => setFormFieldsDraft((fields) => fields.map((item, i) => i === index ? { ...item, label: event.target.value } : item))}
                              maxLength={120}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Field type</Label>
                            <Select
                              value={field.type}
                              onValueChange={(value) => setFormFieldsDraft((fields) => fields.map((item, i) => i === index
                                ? {
                                  ...item,
                                  type: value as CampaignFieldType,
                                  options: value === "select" ? (item.options?.length ? item.options : ["Option 1"]) : undefined,
                                }
                                : item))}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(["text", "textarea", "email", "phone", "number", "select", "checkbox", "date"] as CampaignFieldType[]).map((type) => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`campaign-field-placeholder-${index}`}>Placeholder <span className="font-normal text-muted-foreground">(optional)</span></Label>
                            <Input
                              id={`campaign-field-placeholder-${index}`}
                              value={field.placeholder ?? ""}
                              onChange={(event) => setFormFieldsDraft((fields) => fields.map((item, i) => i === index ? { ...item, placeholder: event.target.value } : item))}
                              maxLength={160}
                            />
                          </div>
                          {field.type === "select" && (
                            <div className="space-y-1.5">
                              <Label htmlFor={`campaign-field-options-${index}`}>Options, separated by commas</Label>
                              <Input
                                id={`campaign-field-options-${index}`}
                                value={(field.options ?? []).join(", ")}
                                onChange={(event) => setFormFieldsDraft((fields) => fields.map((item, i) => i === index
                                ? { ...item, options: event.target.value.split(",").map((option: string) => option.trim()).filter(Boolean) }
                                  : item))}
                                placeholder="Option one, Option two"
                              />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(event) => setFormFieldsDraft((fields) => fields.map((item, i) => i === index ? { ...item, required: event.target.checked } : item))}
                              />
                              Required field
                            </label>
                            <span className="mr-auto text-xs text-muted-foreground font-mono">Response key: {field.id}</span>
                            <Button type="button" variant="outline" size="sm" onClick={() => moveFormField(index, -1)} disabled={index === 0}>Move up</Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => moveFormField(index, 1)} disabled={index === formFieldsDraft.length - 1}>Move down</Button>
                            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setFormFieldsDraft((fields) => fields.filter((_, i) => i !== index))}>
                              <Trash2 className="mr-1.5 h-4 w-4" /> Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                      <div className="flex flex-wrap justify-between gap-3">
                        <Button type="button" variant="outline" onClick={addFormField}>
                          <Plus className="mr-2 h-4 w-4" /> Add field
                        </Button>
                        <div className="flex gap-2">
                          <Button type="button" variant="ghost" onClick={() => setIsEditingFields(false)} disabled={updateCampaign.isPending}>Cancel</Button>
                          <Button type="button" onClick={handleSaveFormFields} disabled={updateCampaign.isPending}>
                            {updateCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save form
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : !campaign.fields || campaign.fields.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">No fields configured.</div>
                  ) : (
                    <div className="space-y-4">
                      {campaign.fields.map((field, i) => (
                        <div key={field.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-muted/5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-muted-foreground">{i+1}.</span>
                              <span className="font-medium">{field.label}</span>
                              {field.required && <span className="text-destructive text-xs">*</span>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 font-mono">{field.id}</div>
                          </div>
                          <Badge variant="outline" className="mt-2 sm:mt-0 w-fit">{field.type}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Submissions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-serif font-bold">{analytics?.submissionsCount || 0}</div>
                  </CardContent>
                </Card>
                {campaign.requiresPayment && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-serif font-bold text-emerald-600">
                        {formatCurrency(analytics?.totalRevenue || 0, campaign.currency || "XAF", i18n.language.startsWith("fr") ? "fr-FR" : "en-US")}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {campaign.goalAmount && (
                <Card className="mb-6 border-border/60 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-serif">Campaign Goal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-end mb-2">
                      <div className="text-3xl font-bold text-primary">{formatCurrency(campaign.currentAmount || 0, campaign.currency || "XAF", i18n.language.startsWith("fr") ? "fr-FR" : "en-US")}</div>
                      <div className="text-muted-foreground font-medium">
                        Goal: {formatCurrency(campaign.goalAmount, campaign.currency || "XAF", i18n.language.startsWith("fr") ? "fr-FR" : "en-US")}
                      </div>
                    </div>
                    <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(100, ((campaign.currentAmount || 0) / campaign.goalAmount) * 100)}%` }}
                      />
                    </div>
                    <div className="text-right text-sm text-muted-foreground mt-2">
                      {(((campaign.currentAmount || 0) / campaign.goalAmount) * 100).toFixed(1)}% funded
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="branding" className="mt-0">
              <CampaignBrandingSection campaign={campaign} campaignId={campaignId} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-serif">Campaign Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Status</span>
                {getStatusBadge()}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Submissions</span>
                <span className="font-medium">{campaign.submissionsCount || 0}</span>
              </div>
              {campaign.requiresPayment && (
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-muted-foreground text-sm">Total Raised</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(campaign.currentAmount || 0, campaign.currency || "XAF", i18n.language.startsWith("fr") ? "fr-FR" : "en-US")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Submission Data Viewer */}
      <Dialog open={!!viewingSubmission} onOpenChange={(open) => { if (!open) setViewingSubmission(null); }}>
        <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
          </DialogHeader>
          {viewingSubmission && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Name</p>
                  <p className="font-medium">{viewingSubmission.submitterName || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</p>
                  <p className="font-medium text-sm">{viewingSubmission.submitterEmail || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Submitted</p>
                  <p className="font-medium text-sm">{viewingSubmission.submittedAt ? format(new Date(viewingSubmission.submittedAt), 'PPP p') : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                  <Badge variant={viewingSubmission.status === 'confirmed' ? 'default' : 'secondary'}>
                    {viewingSubmission.status || 'pending'}
                  </Badge>
                </div>
              </div>

              {viewingSubmission.data && Object.keys(viewingSubmission.data).length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Form Responses</h4>
                  <div className="space-y-3">
                    {Object.entries(viewingSubmission.data).map(([key, value]) => (
                      <div key={key} className="border rounded-md p-3">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm whitespace-pre-wrap">
                          {Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value) || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No form response data on this submission.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function CampaignBrandingSection({ campaign, campaignId }: { campaign: any; campaignId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [heroImageUrl, setHeroImageUrl] = useState<string>(campaign.heroImageUrl ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState<string>(campaign.coverImageUrl ?? '');
  const [accentColor, setAccentColor] = useState<string>(campaign.accentColor ?? '#4F46E5');
  const [theme, setTheme] = useState<'evenum' | 'light' | 'dark'>(campaign.theme ?? 'evenum');
  const updateCampaign = useUpdateCampaign();

  const handleSave = () => {
    updateCampaign.mutate(
      {
        campaignId,
        data: {
          heroImageUrl: heroImageUrl || undefined,
          coverImageUrl: coverImageUrl || undefined,
          accentColor,
          theme,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
          toast({ title: 'Branding saved', description: 'Campaign branding updated.' });
        },
        onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-xl font-serif font-bold mb-1">Campaign Branding</h2>
        <p className="text-sm text-muted-foreground">These settings override the organization theme for this campaign's public participation page.</p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-serif">Media</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ImageUpload
              label="Hero Image"
              value={heroImageUrl || undefined}
              onChange={v => setHeroImageUrl(v ?? '')}
            />
            <ImageUpload
              label="Cover Image"
              value={coverImageUrl || undefined}
              onChange={v => setCoverImageUrl(v ?? '')}
            />
          </div>
          <p className="text-xs text-muted-foreground">Hero: full-width background on the campaign page. Cover: cards and social sharing.</p>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-serif">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Accent Color</Label>
            <p className="text-xs text-muted-foreground">Primary color for buttons and highlights on the campaign page</p>
            <AccentColorPicker value={accentColor} onChange={setAccentColor} />
          </div>
          <div className="space-y-2">
            <Label>Theme</Label>
            <p className="text-xs text-muted-foreground">Visual theme for the public campaign experience</p>
            <Select value={theme} onValueChange={v => setTheme(v as 'evenum' | 'light' | 'dark')}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evenum">Evenum (Dark Blue)</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateCampaign.isPending} className="h-10 px-8 rounded-sm">
          {updateCampaign.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Branding
        </Button>
      </div>
    </div>
  );
}
