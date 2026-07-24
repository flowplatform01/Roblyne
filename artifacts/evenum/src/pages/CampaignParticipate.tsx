import React, { useState } from 'react';
import { useRoute } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useGetCampaign, useSubmitCampaignResponse, useGetCampaignAnalytics } from "@workspace/api-client-react";
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
  Users, Heart, TrendingUp, Target, Sparkles, CreditCard, Wallet, ArrowLeft, BadgeCheck
} from "lucide-react";
import { ShareButton } from "@/components/branding/ShareButton";
import { hexToHsl } from "@/lib/branding";
import { useToast } from '@/hooks/use-toast';

export default function CampaignParticipate() {
  const [, params] = useRoute("/campaigns/:id/participate");
  const campaignId = params?.id ? parseInt(params.id, 10) : 0;

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [baseData, setBaseData] = useState({ name: '', email: '' });
  const [isSuccess, setIsSuccess] = useState(false);

  const { data: campaign, isLoading: isCampaignLoading } = useGetCampaign(campaignId);
  const { data: analytics } = useGetCampaignAnalytics(campaignId);
  const submitMutation = useSubmitCampaignResponse();
  const { toast } = useToast();

  const shareUrl = `${window.location.origin}/campaigns/${campaignId}/participate`;

  usePageMeta(campaign ? {
    title: campaign.title,
    description: campaign.description || `Participate in ${campaign.title} — join the campaign on Evenum.`,
    image: (campaign as any).heroImageUrl || campaign.coverImageUrl || null,
    url: shareUrl,
  } : null);

  const handleFieldChange = (id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseData.name || !baseData.email) return;

    let isValid = true;
    campaign?.fields?.forEach(field => {
      if (field.required && (formData[field.id] === undefined || formData[field.id] === '')) {
        isValid = false;
      }
    });

    if (!isValid) {
      toast({ title: 'Please fill out all required fields', variant: 'destructive' });
      return;
    }

    submitMutation.mutate(
      {
        campaignId,
        data: {
          submitterName: baseData.name,
          submitterEmail: baseData.email,
          data: formData,
        },
      },
      {
        onSuccess: () => setIsSuccess(true),
        onError: () => toast({ title: 'Submission failed', description: 'There was a problem. Please try again.', variant: 'destructive' }),
      }
    );
  };

  if (isCampaignLoading) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-amber-600/40" />
          <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">Loading Campaign</p>
        </div>
      </Layout>
    );
  }

  if (!campaign) return null;

  const primaryStyle: React.CSSProperties = (campaign as any).accentColor
    ? { "--primary": hexToHsl((campaign as any).accentColor) } as React.CSSProperties
    : {};

  if (campaign.status !== 'active') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl">
          <AlertCircle className="h-14 w-14 text-muted-foreground/30 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Campaign Unavailable</h1>
          <p className="text-xl text-muted-foreground font-light">This campaign is not currently accepting submissions.</p>
        </div>
      </Layout>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────

  if (isSuccess) {
    return (
      <Layout>
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="container mx-auto px-4 py-24 text-center max-w-xl animate-in zoom-in-95 fade-in duration-700">
            <div className="relative inline-flex mb-12 justify-center">
              <div className="w-32 h-32 rounded-full border-4 border-amber-200 bg-amber-50 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-2 border-amber-300 bg-amber-100 flex items-center justify-center">
                  <Heart className="h-12 w-12 text-amber-500 fill-amber-300" />
                </div>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-600 mb-6">
              <Sparkles className="h-4 w-4" /> Contribution Recorded
            </div>
            <h1 className="text-5xl font-serif font-bold mb-5 tracking-tight">Thank You</h1>
            <p className="text-xl text-muted-foreground font-light mb-4 leading-relaxed">
              Your contribution to{' '}
              <span className="font-medium text-foreground">{campaign.organizationName || 'this campaign'}</span> has been recorded.
            </p>
            <p className="text-sm text-muted-foreground mb-12">
              A copy has been noted for <strong>{baseData.email}</strong>.
            </p>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 rounded-sm"
              onClick={() => {
                setIsSuccess(false);
                setFormData({});
                setBaseData({ name: '', email: '' });
              }}
            >
              Submit Another Response
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Analytics-derived stats ───────────────────────────────────────────────
  const participantCount = analytics?.submissionsCount ?? null;
  const goalProgress = analytics?.goalProgress ?? null;
  const totalRevenue = analytics?.totalRevenue ?? null;
  const hasGoal = !!campaign.goalAmount;
  const goalProgressPct = goalProgress != null ? Math.min(Math.round(goalProgress * 100), 100) : null;

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
      <div className="relative bg-foreground text-background overflow-hidden">
        {((campaign as any).heroImageUrl || campaign.coverImageUrl) && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${(campaign as any).heroImageUrl || campaign.coverImageUrl})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/60 to-foreground/95" />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, currentColor, currentColor 1px, transparent 0, transparent 50%)',
          backgroundSize: '24px 24px',
        }} />
        <div className="relative z-10 container mx-auto px-4 pt-20 pb-16 max-w-3xl text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          {campaign.organizationName && (
            <p className="text-background/40 text-xs font-bold uppercase tracking-widest mb-5">
              {campaign.organizationName}
            </p>
          )}
          <div className="flex justify-center mb-5">
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/30 font-bold uppercase tracking-widest text-xs capitalize">
              {campaign.type?.replace('_', ' ')}
            </Badge>
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight leading-tight text-background mb-6">
            {campaign.title}
          </h1>
          {campaign.description && (
            <p className="text-xl text-background/65 font-light max-w-2xl mx-auto mb-6 leading-relaxed">
              {campaign.description}
            </p>
          )}

          <div className="flex justify-center mb-4">
            <ShareButton
              url={shareUrl}
              title={campaign.title}
              description={campaign.description || `Participate in ${campaign.title}`}
              className="bg-transparent border-background/30 text-background hover:bg-background/10 hover:border-background/50 hover:text-background rounded-sm"
            />
          </div>

          {/* Live participation stats */}
          {participantCount !== null && participantCount > 0 && (
            <div className="mt-10 inline-flex items-center gap-3 bg-background/10 backdrop-blur-md border border-background/20 px-6 py-3.5 rounded-full">
              <Users className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold text-background">
                <span className="text-amber-400 font-serif text-xl">{participantCount.toLocaleString()}</span>
                {' '}people have already participated
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Goal progress */}
      {hasGoal && (goalProgressPct !== null || totalRevenue !== null) && (
        <div className="border-b border-border/50 bg-amber-50/30">
          <div className="container mx-auto px-4 py-10 max-w-3xl">
            <div className="flex items-center gap-3 mb-5">
              <Target className="h-5 w-5 text-amber-600 shrink-0" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Campaign Progress</h2>
              {goalProgressPct !== null && (
                <span className="ml-auto text-2xl font-serif font-bold text-amber-700">{goalProgressPct}%</span>
              )}
            </div>

            {goalProgressPct !== null && (
              <div className="relative h-3 bg-amber-100 rounded-full overflow-hidden border border-amber-200/60 mb-4">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${goalProgressPct}%` }}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-6 text-sm">
              {totalRevenue != null && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                  <span className="text-muted-foreground">Raised:</span>
                  <span className="font-serif font-bold text-amber-700">${totalRevenue.toLocaleString()}</span>
                </div>
              )}
              {campaign.goalAmount && (
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Goal:</span>
                  <span className="font-bold">${campaign.goalAmount.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form section */}
      <div className="container mx-auto px-4 py-16 max-w-2xl" style={primaryStyle}>

        {/* Why your participation matters */}
        <div className="rounded-sm overflow-hidden border border-amber-200/60 mb-10">
          <div className="bg-amber-600 px-6 py-3 flex items-center gap-2">
            <Heart className="h-4 w-4 text-white/80 fill-white/30" />
            <p className="text-xs font-bold uppercase tracking-widest text-white">Why Your Participation Matters</p>
          </div>
          <div className="bg-amber-50/60 px-6 py-5">
            <p className="text-amber-900/80 text-sm font-light leading-relaxed">
              Every response directly shapes the outcome of this campaign. Your contribution is recorded,
              counted, and reviewed by the organizing team.
              {campaign.goalAmount && ` Together, participants are working toward a goal of $${campaign.goalAmount.toLocaleString()}.`}
              {' '}Your voice matters — participate with confidence.
            </p>
          </div>
        </div>

        <Card className="shadow-xl border-border/70 rounded-sm overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
          <div className="h-1.5 w-full bg-amber-500" />
          <CardHeader className="px-8 pt-8 pb-5 border-b border-border/40">
            <CardTitle className="font-serif text-2xl">Your Contribution</CardTitle>
            <CardDescription className="font-light">Complete all required fields to participate.</CardDescription>
          </CardHeader>

          <CardContent className="p-8 bg-card">
            <form id="campaign-form" onSubmit={handleSubmit} className="space-y-10">

              {/* Personal details */}
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="h-px bg-border/50 flex-1" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your Details</span>
                  <span className="h-px bg-border/50 flex-1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="base-name"
                    required
                    placeholder="Your full name"
                    value={baseData.name}
                    onChange={e => setBaseData({ ...baseData, name: e.target.value })}
                    className="h-12 rounded-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base-email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="base-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={baseData.email}
                    onChange={e => setBaseData({ ...baseData, email: e.target.value })}
                    className="h-12 rounded-sm"
                  />
                </div>
              </div>

              {/* Campaign-specific fields */}
              {campaign.fields && campaign.fields.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="h-px bg-border/50 flex-1" />
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Campaign Questions</span>
                    <span className="h-px bg-border/50 flex-1" />
                  </div>
                  {campaign.fields.map(field => (
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
            {campaign.requiresPayment && campaign.paymentAmount && (
              <div className="w-full p-6 rounded-sm bg-amber-50/50 border border-amber-200/60 flex flex-col sm:flex-row items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-amber-100 rounded-sm border border-amber-200/60 shrink-0">
                    <Lock className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <p className="font-bold text-amber-900 mb-0.5">Secure Payment Required</p>
                    <p className="text-amber-800/70 text-sm font-light">This campaign requires a financial contribution to participate.</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600/60 mb-1">Amount</p>
                  <span className="font-bold font-serif text-3xl text-amber-900">${campaign.paymentAmount.toFixed(2)}</span>
                </div>
              </div>
            )}

            <Button
              type="submit"
              form="campaign-form"
              className="w-full h-14 text-base font-bold shadow-lg hover:shadow-xl transition-all bg-amber-600 hover:bg-amber-700 text-white rounded-sm"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {campaign.requiresPayment ? 'Proceed to Payment' : 'Submit My Response'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <p className="text-[11px] text-center text-muted-foreground flex items-center gap-1.5 justify-center">
              <ShieldCheck className="h-3.5 w-3.5 opacity-50" />
              Data securely processed for {campaign.organizationName || 'the organizer'}
            </p>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
}
