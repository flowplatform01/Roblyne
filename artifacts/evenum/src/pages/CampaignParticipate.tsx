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
import { Loader2, Megaphone, AlertCircle, CheckCircle2, Lock } from "lucide-react";
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
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        </div>
      </Layout>
    );
  }

  if (!campaign) return null;

  if (campaign.status !== 'active') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center max-w-2xl">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h1 className="text-3xl font-serif font-bold mb-4">Campaign Unavailable</h1>
          <p className="text-lg text-muted-foreground">This campaign is not currently accepting submissions.</p>
        </div>
      </Layout>
    );
  }

  if (isSuccess) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center max-w-lg">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-serif font-bold mb-4">Submission Received</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Thank you for participating! We have received your information.
          </p>
          <Button variant="outline" onClick={() => {
            setIsSuccess(false);
            setFormData({});
            setBaseData({ name: "", email: "" });
          }}>
            Submit Another
          </Button>
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
            className="min-h-[100px]"
          />
        );
      case 'select':
        return (
          <Select 
            value={value} 
            onValueChange={(val) => handleFieldChange(field.id, val)}
            required={field.required}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || "Select an option"} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt: string) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox 
              id={field.id}
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(field.id, checked)}
            />
            <Label htmlFor={field.id} className="font-normal cursor-pointer text-sm">
              I agree <span className="text-destructive">{field.required ? '*' : ''}</span>
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
          />
        );
    }
  };

  return (
    <Layout>
      <div className="bg-muted/30 py-12 border-b">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700 mb-6 shadow-sm">
            <Megaphone className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-serif font-bold tracking-tight mb-4">{campaign.title}</h1>
          {campaign.description && <p className="text-lg text-muted-foreground">{campaign.description}</p>}
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-2xl flex-1">
        <Card className="shadow-lg border-border/60">
          <CardHeader className="bg-muted/10 border-b pb-6">
            <CardTitle className="font-serif">Submit Information</CardTitle>
            <CardDescription>Please complete the form below.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form id="campaign-form" onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-4 p-4 rounded-lg bg-muted/20 border border-dashed">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-2">Basic Details</h3>
                <div className="space-y-2">
                  <Label htmlFor="base-name">Full Name <span className="text-destructive">*</span></Label>
                  <Input 
                    id="base-name" 
                    required 
                    value={baseData.name}
                    onChange={e => setBaseData({ ...baseData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base-email">Email Address <span className="text-destructive">*</span></Label>
                  <Input 
                    id="base-email" 
                    type="email" 
                    required 
                    value={baseData.email}
                    onChange={e => setBaseData({ ...baseData, email: e.target.value })}
                  />
                </div>
              </div>

              {campaign.fields && campaign.fields.length > 0 && (
                <div className="space-y-6 pt-4">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-2 border-b pb-2">Campaign Details</h3>
                  {campaign.fields.map(field => (
                    <div key={field.id} className="space-y-2">
                      {field.type !== 'checkbox' && (
                        <Label htmlFor={field.id} className="text-base">
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
          <CardFooter className="flex-col pt-2 pb-6 px-6 bg-muted/5 border-t gap-4">
            {campaign.requiresPayment && (
              <div className="w-full flex items-center justify-between p-4 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/50 mb-2">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  <span className="font-medium">Secure Payment Required</span>
                </div>
                <span className="font-bold text-lg">${campaign.paymentAmount?.toFixed(2)}</span>
              </div>
            )}
            
            <Button 
              type="submit" 
              form="campaign-form" 
              className="w-full h-12 text-base" 
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {campaign.requiresPayment ? 'Proceed to Payment' : 'Submit'}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              By submitting this form, you agree to share your data with {campaign.organizationName || 'the organizer'}.
            </p>
          </CardFooter>
        </Card>
      </div>
    </Layout>
  );
}
