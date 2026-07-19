import React, { useState } from 'react';
import { useRoute } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useGetCampaign, useSubmitCampaignResponse, useGetCampaignAnalytics } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Megaphone, AlertCircle, CheckCircle2, Lock, ArrowRight, ShieldCheck, Users } from "lucide-react";
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
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-amber-600/50" />
        </div>
      </Layout>
    );
  }

  if (!campaign) return null;

  if (campaign.status !== 'active') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl animate-in fade-in duration-700">
          <AlertCircle className="h-14 w-14 text-muted-foreground/40 mx-auto mb-8" />
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
            <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h1 className="text-5xl font-serif font-bold mb-5 tracking-tight">Thank You</h1>
            <p className="text-xl text-muted-foreground font-light mb-4 leading-relaxed">
              Your contribution to{' '}
              <span className="font-medium text-foreground">{campaign.organizationName || 'this campaign'}</span> has been recorded.
            </p>
            <p className="text-sm text-muted-foreground mb-12">
              A copy of your submission has been sent to <strong>{baseData.email}</strong>.
            </p>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8"
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
            className="min-h-[120px] bg-background border-border/60 focus:border-amber-500 text-base p-4 resize-none rounded-sm"
          />
        );
      case 'select':
        return (
          <Select value={value} onValueChange={val => handleFieldChange(field.id, val)} required={field.required}>
            <SelectTrigger className="h-12 bg-background border-border/60 focus:border-amber-500 rounded-sm text-base px-4">
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
            className="h-12 bg-background border-border/60 focus:border-amber-500 rounded-sm text-base px-4"
          />
        );
    }
  };

  // ── Main page ─────────────────────────────────────────────────────────────

  const participantCount = analytics?.submissionsCount ?? null;

  return (
    <Layout>
      {/* Hero */}
      <div className="relative bg-foreground text-background overflow-hidden">
        {campaign.coverImageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{ backgroundImage: `url(${campaign.coverImageUrl})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/60 to-foreground/95" />
        <div className="relative z-10 container mx-auto px-4 pt-20 pb-16 max-w-3xl text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
          {campaign.organizationName && (
            <p className="text-background/50 text-sm font-medium uppercase tracking-widest mb-4">
              {campaign.organizationName}
            </p>
          )}
          <div className="flex justify-center mb-5">
            <Badge className="bg-amber-600/20 text-amber-300 border-amber-500/30 font-bold uppercase tracking-widest text-xs capitalize">
              {campaign.type?.replace('_', ' ')}
            </Badge>
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight leading-tight text-background mb-6">
            {campaign.title}
          </h1>
          {campaign.description && (
            <p className="text-xl text-background/70 font-light max-w-2xl mx-auto leading-relaxed">
              {campaign.description}
            </p>
          )}

          {/* Participation momentum */}
          {participantCount !== null && participantCount > 0 && (
            <div className="mt-10 inline-flex items-center gap-3 bg-background/10 backdrop-blur-md border border-background/20 px-6 py-3 rounded-full">
              <Users className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold">
                <span className="text-amber-400 font-serif text-lg">{participantCount}</span>
                {' '}people have participated
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Form section */}
      <div className="container mx-auto px-4 py-16 max-w-2xl paper-grain">

        {/* "Why your participation matters" callout */}
        <div className="bg-amber-50/60 border border-amber-200/60 rounded-sm p-6 mb-10 flex items-start gap-4">
          <Megaphone className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-900 text-sm mb-1">Why your participation matters</p>
            <p className="text-amber-800/80 text-sm font-light leading-relaxed">
              Every response directly shapes the outcome of this campaign. Your contribution is recorded,
              counted, and reviewed by the organizing team.
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
              {campaign.requiresPayment ? 'Proceed to Payment' : 'Submit Response'}
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
