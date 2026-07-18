import React, { useState } from 'react';
import { useRoute } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useGetCampaign, useSubmitCampaignResponse } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Megaphone, AlertCircle, CheckCircle2, Lock, ArrowRight, ShieldCheck, Badge } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

export default function CampaignParticipate() {
  const [match, params] = useRoute("/campaigns/:id/participate");
  const campaignId = params?.id ? parseInt(params.id, 10) : 0;
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [baseData, setBaseData] = useState({ name: "", email: "" });
  const [isSuccess, setIsSuccess] = useState(false);

  const { data: campaign, isLoading: isCampaignLoading } = useGetCampaign(campaignId);
  const submitMutation = useSubmitCampaignResponse();
  const { toast } = useToast();

  const handleFieldChange = (id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseData.name || !baseData.email) return;

    // Very basic client-side validation
    let isValid = true;
    campaign?.fields?.forEach(field => {
      if (field.required && (formData[field.id] === undefined || formData[field.id] === '')) {
        isValid = false;
      }
    });

    if (!isValid) {
      toast({ title: "Please fill out all required fields", variant: "destructive" });
      return;
    }

    submitMutation.mutate(
      {
        campaignId,
        data: {
          submitterName: baseData.name,
          submitterEmail: baseData.email,
          data: formData
        }
      },
      {
        onSuccess: () => {
          setIsSuccess(true);
        },
        onError: () => {
          toast({ title: "Failed to submit", description: "There was a problem processing your submission.", variant: "destructive" });
        }
      }
    );
  };

  if (isCampaignLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center min-h-screen paper-grain">
          <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
        </div>
      </Layout>
    );
  }

  if (!campaign) return null;

  if (campaign.status !== 'active') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-2xl animate-in fade-in duration-700">
          <AlertCircle className="h-16 w-16 text-muted-foreground/50 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Campaign Unavailable</h1>
          <p className="text-xl text-muted-foreground font-light">This campaign is not currently accepting submissions.</p>
        </div>
      </Layout>
    );
  }

  if (isSuccess) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-2xl animate-in zoom-in-95 duration-700">
          <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="text-5xl font-serif font-bold mb-6 tracking-tight">Submission Received</h1>
          <p className="text-xl text-muted-foreground font-light mb-12 leading-relaxed">
            Thank you for participating! We have securely recorded your information for {campaign.organizationName || 'the organizer'}.
          </p>
          <div className="flex justify-center">
            <Button size="lg" variant="outline" className="h-14 px-8 text-base border-border/60 hover:bg-muted/50" onClick={() => {
              setIsSuccess(false);
              setFormData({});
              setBaseData({ name: "", email: "" });
            }}>
              Submit Another Response
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const renderField = (field: any) => {
    const value = formData[field.id] || "";
    
    switch (field.type) {
      case 'textarea':
        return (
          <Textarea 
            id={field.id}
            placeholder={field.placeholder}
            required={field.required}
            value={value}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="min-h-[120px] bg-background border-border/60 focus:border-amber-500 rounded-sm text-base p-4 resize-none"
          />
        );
      case 'select':
        return (
          <Select 
            value={value} 
            onValueChange={(val) => handleFieldChange(field.id, val)}
            required={field.required}
          >
            <SelectTrigger className="h-14 bg-background border-border/60 focus:border-amber-500 rounded-sm text-base px-4">
              <SelectValue placeholder={field.placeholder || "Select an option"} />
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
              onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
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
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            className="h-14 bg-background border-border/60 focus:border-amber-500 rounded-sm text-base px-4"
          />
        );
    }
  };

  return (
    <Layout>
      <div className="bg-foreground text-background py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/attached_assets/generated_images/campaign-abstract.jpg')] bg-cover bg-center opacity-20 mix-blend-screen" />
        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-sm bg-amber-500/20 border border-amber-400/30 text-amber-400 mb-8 shadow-sm backdrop-blur-sm">
            <Megaphone className="h-8 w-8" />
          </div>
          <div className="mb-6 flex justify-center">
            <Badge className="bg-background/10 text-background hover:bg-background/20 px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-sm border border-background/20 backdrop-blur-md">
              {campaign.type}
            </Badge>
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight mb-8 leading-tight text-card">{campaign.title}</h1>
          {campaign.description && <p className="text-xl text-card/80 font-light max-w-2xl mx-auto leading-relaxed">{campaign.description}</p>}
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 max-w-3xl flex-1 paper-grain relative z-20 -mt-8">
        <Card className="shadow-2xl border-border/80 rounded-sm overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-700 delay-150">
          <div className="h-2 w-full bg-amber-500" />
          
          {campaign.coverImageUrl && (
            <div className="w-full h-48 sm:h-64 border-b border-border/50">
              <img src={campaign.coverImageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          
          <CardHeader className="bg-card px-8 pt-10 pb-6 border-b border-border/50 text-center">
            <CardTitle className="font-serif text-3xl">Submission Form</CardTitle>
            <CardDescription className="text-base font-light mt-2">Please complete all required fields below.</CardDescription>
          </CardHeader>
          
          <CardContent className="p-8 sm:p-12 bg-card">
            <form id="campaign-form" onSubmit={handleSubmit} className="space-y-12">
              
              <div className="space-y-6">
                <div className="flex items-center gap-4 mb-8">
                  <span className="h-px bg-border/60 flex-1"></span>
                  <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest shrink-0">Personal Details</h3>
                  <span className="h-px bg-border/60 flex-1"></span>
                </div>
                
                <div className="grid grid-cols-1 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="base-name" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input 
                      id="base-name" 
                      required 
                      value={baseData.name}
                      onChange={e => setBaseData({ ...baseData, name: e.target.value })}
                      className="h-14 bg-background border-border/60 focus:border-amber-500 rounded-sm text-base px-4"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="base-email" className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      Email Address <span className="text-destructive">*</span>
                    </Label>
                    <Input 
                      id="base-email" 
                      type="email" 
                      required 
                      value={baseData.email}
                      onChange={e => setBaseData({ ...baseData, email: e.target.value })}
                      className="h-14 bg-background border-border/60 focus:border-amber-500 rounded-sm text-base px-4"
                    />
                  </div>
                </div>
              </div>

              {campaign.fields && campaign.fields.length > 0 && (
                <div className="space-y-8 pt-4">
                  <div className="flex items-center gap-4 mb-8">
                    <span className="h-px bg-border/60 flex-1"></span>
                    <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-widest shrink-0">Campaign Info</h3>
                    <span className="h-px bg-border/60 flex-1"></span>
                  </div>
                  
                  {campaign.fields.map(field => (
                    <div key={field.id} className="space-y-3">
                      {field.type !== 'checkbox' && (
                        <Label htmlFor={field.id} className="text-sm font-bold uppercase tracking-widest text-muted-foreground block mb-2">
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
          
          <CardFooter className="flex-col pt-0 pb-12 px-8 sm:px-12 bg-card gap-8">
            <div className="w-full h-px bg-border/50 mb-4" />
            
            {campaign.requiresPayment && (
              <div className="w-full p-8 rounded-sm bg-amber-50/50 text-amber-900 border border-amber-200/60 dark:bg-amber-900/10 dark:text-amber-300 dark:border-amber-800/40 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-white/60 dark:bg-black/20 rounded-full shrink-0 shadow-sm border border-amber-200/50">
                    <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-xl mb-1">Secure Payment</h4>
                    <p className="text-sm opacity-80">This campaign requires a financial contribution.</p>
                  </div>
                </div>
                <div className="text-center sm:text-right shrink-0">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Amount Due</p>
                  <span className="font-bold font-serif text-4xl">${campaign.paymentAmount?.toFixed(2)}</span>
                </div>
              </div>
            )}
            
            <Button 
              type="submit" 
              form="campaign-form" 
              className="w-full h-16 text-lg font-bold shadow-lg hover:shadow-xl transition-all bg-amber-600 hover:bg-amber-700 text-white rounded-sm" 
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : null}
              {campaign.requiresPayment ? 'Proceed to Payment' : 'Submit Response'} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 opacity-50" />
              <p>Data securely processed for {campaign.organizationName || 'the organizer'}.</p>
            </div>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
}
