import React, { useEffect, useState } from 'react';
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useGetCampaign, useSubmitCampaignResponse } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, AlertCircle, CheckCircle2, Lock, ArrowRight, ShieldCheck,
  Users, TrendingUp, Target, CreditCard, Wallet, ArrowLeft, BadgeCheck,
  Building2, ExternalLink,
} from "lucide-react";
import { ShareButton } from "@/components/branding/ShareButton";
import { PublicHeroBackdrop } from "@/components/branding/PublicHeroBackdrop";
import { hexToHsl } from "@/lib/branding";
import { useToast } from '@/hooks/use-toast';
import { getLifecycleState, useCountdown } from "@/hooks/useLifecycle";
import { formatCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { ParticipationLoadingSkeleton } from "@/components/loading/LoadingStates";

const LEGACY_PLATFORM_IDENTITY_FIELD_IDS = new Set(["field_name", "field_email", "field_phone"]);

function isLegacyPlatformIdentityField(field: { id: string }): boolean {
  return LEGACY_PLATFORM_IDENTITY_FIELD_IDS.has(field.id);
}

export default function CampaignParticipate() {
  const [, params] = useRoute("/campaigns/:id/participate");
  const campaignId = params?.id ? parseInt(params.id, 10) : 0;

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [baseData, setBaseData] = useState({ name: '', email: '', phone: '' });
  const [isSuccess, setIsSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [paymentStatusToken, setPaymentStatusToken] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const { data: campaign, isLoading: isCampaignLoading } = useGetCampaign(campaignId);
  const submitMutation = useSubmitCampaignResponse();
  const { data: paymentStatus } = usePaymentStatus(paymentId, paymentStatusToken);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const publicFields = campaign?.fields?.filter(field => !isLegacyPlatformIdentityField(field)) ?? [];
  const requiresPayment = Boolean(campaign?.requiresPayment) && Number(campaign?.paymentAmount ?? 0) > 0;
  const countdown = useCountdown(campaign?.endsAt);
  const lifecycleState = getLifecycleState(campaign?.startsAt, campaign?.endsAt, countdown.now);

  useEffect(() => {
    if (!paymentStatus || paymentId === null) return;
    if (paymentStatus.status === "succeeded") {
      setPaymentPending(false);
      setPaymentId(null);
      setPaymentStatusToken(null);
      setCheckoutUrl(null);
      setIsSuccess(true);
    } else if (paymentStatus.status === "failed") {
      setPaymentPending(false);
      setPaymentId(null);
      setPaymentStatusToken(null);
      setCheckoutUrl(null);
      toast({
        title: t("campaignParticipate.paymentFailed"),
        description: t("campaignParticipate.paymentFailedDescription"),
        variant: "destructive",
      });
    }
  }, [paymentStatus, paymentId, toast, t]);

  const shareUrl = `${window.location.origin}/campaigns/${campaignId}/participate`;

  usePageMeta(campaign ? {
    title: campaign.title,
    description: campaign.description || `Participate in ${campaign.title} — join the campaign on ROBYNE.`,
    image: (campaign as any).heroImageUrl || campaign.coverImageUrl || null,
    url: shareUrl,
  } : null);

  const handleFieldChange = (id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lifecycleState !== "live") {
      toast({
        title: lifecycleState === "upcoming" ? t("campaignParticipate.notOpen") : t("campaignParticipate.ended"),
        description: lifecycleState === "upcoming"
          ? t("campaignParticipate.notOpenDescription")
          : t("campaignParticipate.endedDescription"),
        variant: "destructive",
      });
      return;
    }
    if (!baseData.name || !baseData.email) return;

    let isValid = true;
    campaign?.fields?.forEach(field => {
      if (isLegacyPlatformIdentityField(field)) return;
      const value = formData[field.id];
      const isEmpty = value === undefined || value === null
        || (typeof value === "string" && value.trim() === "");
      if (field.required && (field.type === "checkbox" ? value !== true : isEmpty)) {
        isValid = false;
      }
    });

    if (!isValid) {
      toast({ title: t("campaignParticipate.fillRequired"), variant: 'destructive' });
      return;
    }

    submitMutation.mutate(
      {
        campaignId,
        data: {
          submitterName: baseData.name,
          submitterEmail: baseData.email,
           customerPhone: baseData.phone || undefined,
          data: formData,
        },
      },
      {
        onSuccess: (result) => {
          if ("paymentRequired" in result) {
            if (!result.checkoutUrl) {
              toast({ title: "Payment unavailable", description: "No payment checkout link was returned.", variant: "destructive" });
              return;
            }
            setPaymentId(result.paymentId);
            setPaymentStatusToken(result.statusToken);
            setPaymentPending(true);
            setCheckoutUrl(result.checkoutUrl);
            window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
            return;
          }
          setIsSuccess(true);
        },
        onError: () => toast({ title: t("campaignParticipate.failedToSubmit"), description: t("campaignParticipate.failedToSubmitDescription"), variant: 'destructive' }),
      }
    );
  };

  if (isCampaignLoading) {
    return (
      <Layout>
        <ParticipationLoadingSkeleton label="Loading campaign participation" />
      </Layout>
    );
  }

  if (!campaign) return null;

  if (paymentPending) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl">
          <Loader2 className="h-12 w-12 animate-spin text-amber-600/60 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">{t("campaignParticipate.paymentProcessing")}</h1>
          <p className="text-lg text-muted-foreground font-light">
            {t("campaignParticipate.paymentProcessingDescription")}
          </p>
          {checkoutUrl && (
            <Button asChild variant="outline" className="mt-6">
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">{t("campaignParticipate.openPaymentCheckout")}</a>
            </Button>
          )}
        </div>
      </Layout>
    );
  }

  const formatMoney = (amount: number | string | null | undefined) =>
    formatCurrency(amount, campaign.currency || "XAF", i18n.language.startsWith("fr") ? "fr-FR" : "en-US");

  const campaignType = (campaign.type || "custom").toLowerCase();
  const campaignTypeLabelKeys: Record<string, string> = {
    application: "typeApplication",
    contribution: "typeContribution",
    custom: "typeCustom",
    donation: "typeDonation",
    membership: "typeMembership",
    merchandise: "typeMerchandise",
    registration: "typeRegistration",
  };
  const campaignTypeLabel = t(`campaignParticipate.${campaignTypeLabelKeys[campaignType] || "typeCustom"}`);
  const successType = ["application", "contribution", "donation", "membership", "registration"].includes(campaignType)
    ? campaignType
    : campaignType === "merchandise" ? "merchandise" : "submission";
  const successTitle = t(`campaignParticipate.${successType}SuccessTitle`);
  const successDescription = t(`campaignParticipate.${successType}SuccessDescription`, { title: campaign.title });
  const submitActionKey = requiresPayment
    ? "proceedToPayment"
    : ({
        application: "submitApplication",
        registration: "submitRegistration",
        membership: "requestMembership",
         contribution: "submitContribution",
         donation: "submitDonation",
         merchandise: "submitMerchandise",
      }[campaignType] || "submit");
  const campaignAccentColor = (campaign as any).accentColor || "#D97706";
  const primaryStyle: React.CSSProperties = { "--primary": hexToHsl(campaignAccentColor) } as React.CSSProperties;
  const isFinancialCampaign = campaignType === "contribution" || campaignType === "donation";

  if (lifecycleState === "upcoming") {
    const orgId = (campaign as any).orgId;
    const orgLogoUrl = (campaign as any).organizationLogoUrl;
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl">
          <AlertCircle className="h-14 w-14 text-muted-foreground/30 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">{t("campaignParticipate.notOpen")}</h1>
          <p className="text-xl text-muted-foreground font-light mb-8">
            {t("campaignParticipate.opensAt", {
              date: campaign.startsAt
                ? new Intl.DateTimeFormat(i18n.language.startsWith("fr") ? "fr-FR" : "en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(campaign.startsAt))
                : t("campaignParticipate.soon"),
            })}
          </p>
          {campaign.organizationName && (
            <div className="inline-flex items-center gap-2.5 bg-muted/50 border border-border/50 rounded-full pl-2 pr-4 py-1.5">
              {orgLogoUrl ? (
                <img src={orgLogoUrl} alt={campaign.organizationName} className="w-6 h-6 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-muted-foreground/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
              )}
              <span className="text-sm text-muted-foreground">
                A campaign by{' '}
                {orgId
                  ? <Link href={`/organizations/${orgId}/public`} className="font-semibold text-foreground hover:text-primary transition-colors">{campaign.organizationName}</Link>
                  : <span className="font-semibold text-foreground">{campaign.organizationName}</span>}
              </span>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (campaign.status !== 'active' || lifecycleState === "ended") {
    const orgId = (campaign as any).orgId;
    const orgLogoUrl = (campaign as any).organizationLogoUrl;
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl">
          <AlertCircle className="h-14 w-14 text-muted-foreground/30 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">{t("campaignParticipate.unavailable")}</h1>
          <p className="text-xl text-muted-foreground font-light mb-8">{t("campaignParticipate.unavailableDescription")}</p>
          {campaign.organizationName && (
            <div className="inline-flex items-center gap-2.5 bg-muted/50 border border-border/50 rounded-full pl-2 pr-4 py-1.5">
              {orgLogoUrl ? (
                <img src={orgLogoUrl} alt={campaign.organizationName} className="w-6 h-6 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-muted-foreground/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground/50" />
                </div>
              )}
              <span className="text-sm text-muted-foreground">
                A campaign by{' '}
                {orgId
                  ? <Link href={`/organizations/${orgId}/public`} className="font-semibold text-foreground hover:text-primary transition-colors">{campaign.organizationName}</Link>
                  : <span className="font-semibold text-foreground">{campaign.organizationName}</span>}
              </span>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────

  if (isSuccess) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center" style={primaryStyle}>
          <div className="container mx-auto px-4 py-24 text-center max-w-xl animate-in zoom-in-95 fade-in duration-700">
            <div className="relative inline-flex mb-12 justify-center">
              <div className="w-32 h-32 rounded-full border-4 border-primary/20 bg-primary/5 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-2 border-primary/30 bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-primary" />
                </div>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-6">
              {campaignTypeLabel}
            </div>
            <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-5 tracking-tight">{successTitle}</h1>
            <p className="text-xl text-muted-foreground font-light mb-4 leading-relaxed">{successDescription}</p>
            {requiresPayment && (
              <p className="text-sm font-medium text-primary mb-6">{t("campaignParticipate.paymentConfirmed")}</p>
            )}
            {(campaign as any).organizationLogoUrl && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
                <img
                  src={(campaign as any).organizationLogoUrl}
                  alt={campaign.organizationName || ""}
                  className="w-6 h-6 rounded-full object-cover border border-border"
                />
                {(campaign as any).orgId ? (
                  <Link href={`/organizations/${(campaign as any).orgId}/public`} className="hover:text-primary transition-colors">
                    {campaign.organizationName}
                  </Link>
                ) : campaign.organizationName}
              </div>
            )}
            <p className="text-sm text-muted-foreground mb-12">
              {t("campaignParticipate.submittedWith", { email: baseData.email })}
            </p>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 rounded-sm"
              onClick={() => {
                setIsSuccess(false);
                setFormData({});
                 setBaseData({ name: '', email: '', phone: '' });
              }}
            >
              {t("campaignParticipate.submitAnother")}
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Analytics-derived stats ───────────────────────────────────────────────
  const participantCount = campaign.submissionsCount ?? null;
  const totalRevenue = campaign.currentAmount ?? null;
  const hasGoal = Number(campaign.goalAmount) > 0;
  const goalProgressPct = hasGoal
    ? Math.min(Math.round((Number(campaign.currentAmount || 0) / Number(campaign.goalAmount)) * 100), 100)
    : null;

  // ── Field renderer ────────────────────────────────────────────────────────
  const renderField = (field: any) => {
    const value = formData[field.id] || '';
    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={field.id}
            placeholder={field.placeholder}
            required={field.required}
            value={value}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            className="min-h-[120px] bg-background border-border/60 text-base p-4 resize-none rounded-sm"
          />
        );
      case 'select':
        return (
          <Select value={value} onValueChange={val => handleFieldChange(field.id, val)} required={field.required}>
            <SelectTrigger className="h-12 bg-background border-border/60 rounded-sm text-base px-4">
              <SelectValue placeholder={field.placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt: string) => (
                <SelectItem key={opt} value={opt} className="text-base py-3">{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'checkbox':
        return (
          <div className="flex items-start space-x-4 p-4 border border-border/60 rounded-sm bg-background/50">
            <Checkbox
              id={field.id}
              checked={!!value}
              onCheckedChange={checked => handleFieldChange(field.id, checked)}
              aria-required={field.required}
              className="mt-1 w-5 h-5"
            />
            <Label htmlFor={field.id} className="font-normal cursor-pointer text-base leading-relaxed">
              {field.label} {field.required && <span className="text-destructive font-bold">*</span>}
            </Label>
          </div>
        );
      default:
        return (
          <Input
            id={field.id}
            type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
            placeholder={field.placeholder}
            required={field.required}
            value={value}
            onChange={e => handleFieldChange(field.id, e.target.value)}
            className="h-12 bg-background border-border/60 rounded-sm text-base px-4"
          />
        );
    }
  };

  // ── Main page ─────────────────────────────────────────────────────────────

  return (
    <Layout>
      {/* Campaign hero */}
      <div className="relative bg-[#0A1628] text-white overflow-hidden" style={primaryStyle}>
        <PublicHeroBackdrop imageUrl={(campaign as any).heroImageUrl || campaign.coverImageUrl} />
        <div className="relative z-10 container mx-auto px-4 pt-20 pb-16 max-w-3xl text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          {campaign.organizationName && (
            (campaign as any).orgId ? (
              <Link
                href={`/organizations/${(campaign as any).orgId}/public`}
                 className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-xs font-bold uppercase tracking-widest mb-5"
              >
                <Building2 className="w-3 h-3" />
                {campaign.organizationName}
                <ExternalLink className="w-2.5 h-2.5 opacity-50" />
              </Link>
            ) : (
               <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-5">
                {campaign.organizationName}
              </p>
            )
          )}
          <div className="flex justify-center mb-5">
            <Badge className="bg-primary/20 text-white border-primary/40 font-bold uppercase tracking-widest text-xs capitalize">
              {campaignTypeLabel}
            </Badge>
          </div>
           <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight leading-tight text-white mb-6">
            {campaign.title}
          </h1>
          {campaign.description && (
             <p className="text-xl text-white/65 font-light max-w-2xl mx-auto mb-6 leading-relaxed">
              {campaign.description}
            </p>
          )}

          <div className="flex justify-center mb-4">
            <ShareButton
              url={shareUrl}
              title={campaign.title}
              description={campaign.description || `Participate in ${campaign.title}`}
               className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:border-white/50 hover:text-white rounded-sm"
            />
          </div>

          {/* Live participation stats */}
          {participantCount !== null && participantCount > 0 && (
             <div className="mt-10 inline-flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3.5 rounded-full">
              <Users className="h-4 w-4 text-primary" />
               <span className="text-sm font-bold text-white">
                <span className="text-primary font-serif text-xl">{participantCount.toLocaleString()}</span>
                {' '}{t("campaignParticipate.peopleParticipated")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Goal progress */}
      {isFinancialCampaign && hasGoal && (goalProgressPct !== null || totalRevenue !== null) && (
        <div className="border-b border-border/50 bg-primary/5" style={primaryStyle}>
          <div className="container mx-auto px-4 py-10 max-w-3xl">
            <div className="flex items-center gap-3 mb-5">
              <Target className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{t("campaignParticipate.progress")}</h2>
              {goalProgressPct !== null && (
                <span className="ml-auto text-2xl font-serif font-bold text-primary">{goalProgressPct}%</span>
              )}
            </div>

            {goalProgressPct !== null && (
              <div className="relative h-3 bg-primary/10 rounded-full overflow-hidden border border-primary/20 mb-4">
                <div
                  className="h-full bg-primary rounded-full transition-colors duration-300"
                  style={{ width: `${goalProgressPct}%` }}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-6 text-sm">
              {totalRevenue != null && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">{t("campaignParticipate.raised")}:</span>
                  <span className="font-serif font-bold text-primary">{formatMoney(totalRevenue)}</span>
                </div>
              )}
              {campaign.goalAmount && (
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t("campaignParticipate.goal")}:</span>
                  <span className="font-bold">{formatMoney(campaign.goalAmount)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form section */}
      <div className="container mx-auto px-4 py-16 max-w-2xl" style={primaryStyle}>
        <Card className="shadow-xl border-border/70 rounded-sm overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          <div className="h-1.5 w-full bg-primary" />
          <CardHeader className="px-8 pt-8 pb-5 border-b border-border/40">
            <CardTitle className="font-serif text-2xl">{t("campaignParticipate.formTitle")}</CardTitle>
            <CardDescription className="font-light">{t("campaignParticipate.completeRequired")}</CardDescription>
          </CardHeader>

          <CardContent className="p-8 bg-card">
            <form id="campaign-form" onSubmit={handleSubmit} className="space-y-10">

              {/* Personal details */}
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="h-px bg-border/50 flex-1" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("campaignParticipate.contactDetails")}</span>
                  <span className="h-px bg-border/50 flex-1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t("campaignParticipate.fullName")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="base-name"
                    required
                    placeholder={t("campaignParticipate.namePlaceholder")}
                    data-testid="campaign-name"
                    value={baseData.name}
                    onChange={e => setBaseData({ ...baseData, name: e.target.value })}
                    className="h-12 rounded-sm"
                  />
                </div>
                {requiresPayment && (
                  <div className="space-y-2">
                    <Label htmlFor="base-phone" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {t("campaignParticipate.phoneNumber")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="base-phone"
                      type="tel"
                      required
                      placeholder={t("campaignParticipate.phonePlaceholder")}
                      data-testid="campaign-phone"
                      value={baseData.phone}
                      onChange={e => setBaseData({ ...baseData, phone: e.target.value })}
                      className="h-12 rounded-sm"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="base-email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t("campaignParticipate.emailAddress")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="base-email"
                    type="email"
                    required
                    placeholder={t("campaignParticipate.emailPlaceholder")}
                    data-testid="campaign-email"
                    value={baseData.email}
                    onChange={e => setBaseData({ ...baseData, email: e.target.value })}
                    className="h-12 rounded-sm"
                  />
                </div>
              </div>

              {/* Campaign-specific fields */}
              {publicFields.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="h-px bg-border/50 flex-1" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("campaignParticipate.campaignQuestions")}</span>
                    <span className="h-px bg-border/50 flex-1" />
                  </div>
                  {publicFields.map(field => (
                    <div key={field.id} className="space-y-2">
                      {field.type !== 'checkbox' && (
                        <Label htmlFor={field.id} className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {field.label} {field.required && <span className="text-destructive">*</span>}
                        </Label>
                      )}
                      {renderField(field)}
                    </div>
                  ))}
                </div>
              )}
            </form>
          </CardContent>

          <CardFooter className="flex-col pt-0 pb-10 px-8 gap-6 bg-card">
            {/* Payment summary */}
            {requiresPayment && (
              <div className="w-full p-6 rounded-sm bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-primary/10 rounded-sm border border-primary/20 shrink-0">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold mb-0.5">{t("campaignParticipate.securePayment")}</p>
                    <p className="text-muted-foreground text-sm font-light">{t("campaignParticipate.paymentRequiredDescription")}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{t("campaignParticipate.amount")}</p>
                  <span className="font-bold font-serif text-3xl text-primary">{formatMoney(campaign.paymentAmount)}</span>
                </div>
              </div>
            )}

            <Button
              type="submit"
              form="campaign-form"
              className="w-full h-14 text-base font-bold shadow-lg hover:shadow-xl transition-colors bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm"
              disabled={submitMutation.isPending || lifecycleState !== "live" || (requiresPayment && !baseData.phone)}
              data-testid="campaign-submit"
            >
              {submitMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {t(`campaignParticipate.${submitActionKey}`)}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <p className="text-[11px] text-center text-muted-foreground flex items-center gap-1.5 justify-center">
              <ShieldCheck className="h-3.5 w-3.5 opacity-50" />
              {t("campaignParticipate.submissionOrganizerNote")}
            </p>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
}
