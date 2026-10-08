import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCreateElection, getListElectionsQueryKey, useListOrganizations, useGetPublicCommissionRates } from "@workspace/api-client-react";
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from "@tanstack/react-query";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowLeft, Vote, CreditCard } from "lucide-react";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/currency";
import { useTranslation } from "react-i18next";
import { MobileActionBar } from "@/components/layout/MobileActionBar";

const CURRENCIES = [{ value: "XAF", label: "XAF — Central African CFA franc" }];

const electionSchema = z.object({
  orgId: z.string().min(1, "Please select an organization"),
  title: z.string().min(3, "Election title must be at least 3 characters"),
  description: z.string().optional(),
  visibility: z.enum(["public", "private", "invite_only"]),
  eligibilityMode: z.enum(["open", "allowlist"]),
  requiresAuth: z.boolean().default(false),
  startsAt: z.string().optional().or(z.literal("")),
  endsAt: z.string().optional().or(z.literal("")),
  requiresPayment: z.boolean().default(false),
  paymentAmount: z.string().optional().or(z.literal("")),
  currency: z.string().default("XAF"),
});

export default function CreateElection() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialOrgId = searchParams.get('orgId') || "";

  const { toast } = useToast();
  const { i18n } = useTranslation();
  const createElection = useCreateElection();
  const { data: commissionRates } = useGetPublicCommissionRates();
  const queryClient = useQueryClient();
  const { data: organizations, isLoading: isOrgsLoading } = useListOrganizations();

  const form = useForm<z.infer<typeof electionSchema>>({
    resolver: zodResolver(electionSchema),
    defaultValues: {
      orgId: initialOrgId,
      title: "",
      description: "",
      visibility: "public",
      eligibilityMode: "open",
      requiresAuth: false,
      startsAt: "",
      endsAt: "",
      requiresPayment: false,
      paymentAmount: "",
      currency: "XAF",
    },
  });

  function onSubmit(values: z.infer<typeof electionSchema>) {
    createElection.mutate(
      { 
        data: {
          orgId: parseInt(values.orgId, 10),
          title: values.title,
          description: values.description || undefined,
          visibility: values.visibility,
          eligibilityMode: values.eligibilityMode,
          requiresAuth: values.requiresAuth,
          startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : undefined,
          endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : undefined,
          requiresPayment: values.requiresPayment,
          paymentAmount: values.requiresPayment && values.paymentAmount ? parseFloat(values.paymentAmount) : undefined,
          currency: values.currency,
        } 
      },
      {
        onSuccess: (election) => {
          queryClient.invalidateQueries({ queryKey: getListElectionsQueryKey() });
          toast({
            title: "Election created",
            description: "Your election has been successfully created. Now add some positions.",
          });
          setLocation(`/elections/${election.id}`);
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Creation failed",
            description: error.data?.error || "There was a problem creating the election. Please try again.",
          });
        },
      }
    );
  }

  const selectedOrgId = form.watch("orgId");
  const requiresPayment = form.watch("requiresPayment");
  const currency = form.watch("currency") || "XAF";
  const paymentAmount = Number(form.watch("paymentAmount") || 0);
  const electionRate = commissionRates?.election;
  const estimatedReceipt = electionRate == null ? null : Math.max(0, paymentAmount * (1 - electionRate));

  return (
    <DashboardLayout orgId={selectedOrgId}>
      <div className="max-w-3xl mx-auto">
        <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground">
          <Link href={initialOrgId ? `/organizations/${initialOrgId}?tab=elections` : "/dashboard"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>

        <div className="mb-8">
           <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-white/10 dark:text-white mb-4">
            <Vote className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Create Election</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Set up a secure voting event with specific positions and candidates.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-24 md:pb-0">
                
                <FormField
                  control={form.control}
                  name="orgId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        disabled={isOrgsLoading || (!!initialOrgId && organizations?.some(o => o.id.toString() === initialOrgId))}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select an organization" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {organizations?.map((org) => (
                            <SelectItem key={org.id} value={org.id.toString()}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Election Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 2024 Board of Directors Election" className="h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Provide details about the election, rules, and eligibility..." 
                          className="min-h-[120px] resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="startsAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date & Time (Optional)</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" className="h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="endsAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date & Time (Optional)</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" className="h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-serif font-medium">Access & Visibility</h3>
                  
                  <div className="grid gap-6 p-4 border rounded-lg bg-muted/20">
                    <FormField
                      control={form.control}
                      name="visibility"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Election Visibility</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select visibility" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="public">Public (Visible in discovery)</SelectItem>
                              <SelectItem value="private">Private (Only accessible via link)</SelectItem>
                              <SelectItem value="invite_only">Invite Only (Requires invite code)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Invite-only elections generate a secret code you share with allowed participants.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="border-t border-border/50" />

                    <FormField
                      control={form.control}
                      name="eligibilityMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Voter Eligibility</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select eligibility mode" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="open">Open (Anyone can vote)</SelectItem>
                              <SelectItem value="allowlist">Allowlist (Only approved emails can vote)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            With allowlist mode, you manage a list of approved voter emails after creating the election.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="border-t border-border/50" />
                    
                    <FormField
                      control={form.control}
                      name="requiresAuth"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-y-0">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Require Authentication</FormLabel>
                            <FormDescription>
                              Voters must be logged in to cast a ballot
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Participation & Fees */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-serif font-medium">Participation & Fees</h3>
                  <div className="grid gap-6 p-4 border rounded-lg bg-muted/20">
                    <FormField
                      control={form.control}
                      name="requiresPayment"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-y-0">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-primary" />
                              Require Participation Fee
                            </FormLabel>
                            <FormDescription>
                              Voters must pay an entry fee before casting their ballot
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                     {requiresPayment && (
                      <>
                        <div className="border-t border-border/50" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="paymentAmount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Fee Amount</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                     placeholder="e.g. 200"
                                    className="h-11"
                                    {...field}
                                  />
                                </FormControl>
                                 <FormDescription>Amount each voter must pay in XAF</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                           <div className="rounded-md border border-primary/20 bg-primary/5 dark:border-white/20 dark:bg-white/5 p-3 self-end">
                             <p className="text-xs text-muted-foreground">Estimated amount your organization receives</p>
                             <p className="text-lg font-semibold text-primary dark:text-white">
                                {estimatedReceipt == null
                                  ? "Fee estimate unavailable"
                                  : formatCurrency(estimatedReceipt, currency, i18n.language.startsWith("fr") ? "fr-FR" : "en-US")}
                             </p>
                             <p className="mt-1 text-xs text-muted-foreground">
                               {electionRate == null
                                 ? "The final amount uses the platform’s current commission."
                                 : `After a ${(electionRate * 100).toLocaleString(i18n.language, { maximumFractionDigits: 2 })}% platform fee`}
                             </p>
                           </div>
                        </div>
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 rounded-md px-3 py-2">
                           Voters will see this amount before voting. Your organization’s estimated receipt is shown above.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="hidden md:flex justify-end pt-6 mt-8">
                  <Button type="submit" size="lg" disabled={createElection.isPending} className="min-w-[150px]">
                    {createElection.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    Create Election
                  </Button>
                </div>
                <MobileActionBar label="Create Election" pending={createElection.isPending} pendingLabel="Creating election…" />
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
