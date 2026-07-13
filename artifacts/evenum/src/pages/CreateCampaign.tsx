import React from 'react';
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCreateCampaign, getListCampaignsQueryKey, useListOrganizations } from "@workspace/api-client-react";
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from "@tanstack/react-query";

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowLeft, Megaphone, Plus, Trash2, GripVertical } from "lucide-react";
import { Link } from "wouter";

const fieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1, "Label is required"),
  type: z.enum(["text", "textarea", "email", "phone", "number", "select", "checkbox", "date"]),
  required: z.boolean().default(false),
  options: z.string().optional(), // We'll split this by comma for select options
  placeholder: z.string().optional()
});

const campaignSchema = z.object({
  orgId: z.string().min(1, "Please select an organization"),
  title: z.string().min(3, "Campaign title must be at least 3 characters"),
  description: z.string().optional(),
  type: z.enum(["registration", "contribution", "donation", "application", "membership", "merchandise", "custom"]),
  visibility: z.enum(["public", "private"]),
  requiresPayment: z.boolean().default(false),
  paymentAmount: z.coerce.number().optional().or(z.literal("")),
  goalAmount: z.coerce.number().optional().or(z.literal("")),
  startsAt: z.string().optional().or(z.literal("")),
  endsAt: z.string().optional().or(z.literal("")),
  fields: z.array(fieldSchema)
});

export default function CreateCampaign() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialOrgId = searchParams.get('orgId') || "";

  const { toast } = useToast();
  const createCampaign = useCreateCampaign();
  const queryClient = useQueryClient();
  const { data: organizations, isLoading: isOrgsLoading } = useListOrganizations();

  const form = useForm<z.infer<typeof campaignSchema>>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      orgId: initialOrgId,
      title: "",
      description: "",
      type: "custom",
      visibility: "public",
      requiresPayment: false,
      paymentAmount: "",
      goalAmount: "",
      startsAt: "",
      endsAt: "",
      fields: [
        { id: "field_name", label: "Full Name", type: "text", required: true },
        { id: "field_email", label: "Email Address", type: "email", required: true }
      ]
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "fields",
  });

  const requiresPayment = form.watch("requiresPayment");

  function onSubmit(values: z.infer<typeof campaignSchema>) {
    // Transform options string to array for select fields
    const formattedFields = values.fields.map(f => ({
      ...f,
      id: f.id.replace(/\s+/g, '_').toLowerCase() || `field_${Math.random().toString(36).substring(7)}`,
      options: f.type === 'select' && f.options ? f.options.split(',').map(o => o.trim()) : undefined
    }));

    createCampaign.mutate(
      { 
        data: {
          orgId: parseInt(values.orgId, 10),
          title: values.title,
          description: values.description || undefined,
          type: values.type,
          visibility: values.visibility,
          requiresPayment: values.requiresPayment,
          paymentAmount: values.requiresPayment && values.paymentAmount ? Number(values.paymentAmount) : undefined,
          goalAmount: values.goalAmount ? Number(values.goalAmount) : undefined,
          startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : undefined,
          endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : undefined,
          fields: formattedFields,
        } 
      },
      {
        onSuccess: (campaign) => {
          queryClient.invalidateQueries({ queryKey: getListCampaignsQueryKey() });
          toast({ title: "Campaign created successfully!" });
          setLocation(`/campaigns/${campaign.id}`);
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Creation failed",
            description: "There was a problem creating the campaign. Please try again.",
          });
        },
      }
    );
  }

  const selectedOrgId = form.watch("orgId");

  return (
    <DashboardLayout orgId={selectedOrgId}>
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground">
          <Link href={initialOrgId ? `/organizations/${initialOrgId}?tab=campaigns` : "/dashboard"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>

        <div className="mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 mb-4">
            <Megaphone className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Create Campaign</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Build a custom form to collect data, registrations, or payments.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                              <SelectValue placeholder="Select organization" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {organizations?.map((org) => (
                              <SelectItem key={org.id} value={org.id.toString()}>{org.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="custom">Custom Form</SelectItem>
                            <SelectItem value="registration">Registration</SelectItem>
                            <SelectItem value="application">Application</SelectItem>
                            <SelectItem value="donation">Donation</SelectItem>
                            <SelectItem value="membership">Membership</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Title</FormLabel>
                      <FormControl><Input placeholder="e.g. 2024 Membership Drive" className="h-11" {...field} /></FormControl>
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
                        <Textarea placeholder="Explain what you are collecting..." className="min-h-[100px] resize-none" {...field} />
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
                        <FormLabel>Start Date (Optional)</FormLabel>
                        <FormControl><Input type="datetime-local" className="h-11" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endsAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date (Optional)</FormLabel>
                        <FormControl><Input type="datetime-local" className="h-11" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment & Goals</CardTitle>
                <CardDescription>Configure if this campaign requires a fee or has a target goal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="requiresPayment"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between border rounded-lg p-4 bg-muted/10">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Require Payment</FormLabel>
                        <FormDescription>Participants must pay a fee to submit</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )}
                />

                {requiresPayment && (
                  <FormField
                    control={form.control}
                    name="paymentAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Required Amount (USD)</FormLabel>
                        <FormControl><Input type="number" step="0.01" min={0.5} placeholder="50.00" className="h-11" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="goalAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Goal (Optional)</FormLabel>
                      <FormControl><Input type="number" placeholder="Target amount e.g. 10000" className="h-11" {...field} /></FormControl>
                      <FormDescription>Set a financial goal to display progress on the campaign page.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle>Form Builder</CardTitle>
                  <CardDescription>Define the fields participants will need to fill out.</CardDescription>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => append({ id: "", label: "", type: "text", required: false })}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Field
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 pt-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg bg-card shadow-sm relative group flex gap-4">
                      <div className="mt-2 text-muted-foreground cursor-move shrink-0 hidden sm:block">
                        <GripVertical className="h-5 w-5" />
                      </div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-4">
                          <FormField
                            control={form.control}
                            name={`fields.${index}.label`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Field Label</FormLabel>
                                <FormControl><Input placeholder="e.g. T-Shirt Size" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <FormField
                            control={form.control}
                            name={`fields.${index}.type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="text">Short Text</SelectItem>
                                    <SelectItem value="textarea">Paragraph</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="phone">Phone</SelectItem>
                                    <SelectItem value="select">Dropdown</SelectItem>
                                    <SelectItem value="checkbox">Checkbox</SelectItem>
                                    <SelectItem value="date">Date</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="md:col-span-3">
                          {form.watch(`fields.${index}.type`) === 'select' ? (
                            <FormField
                              control={form.control}
                              name={`fields.${index}.options`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Options (comma separated)</FormLabel>
                                  <FormControl><Input placeholder="Small, Medium, Large" {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                          ) : (
                            <FormField
                              control={form.control}
                              name={`fields.${index}.placeholder`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Placeholder</FormLabel>
                                  <FormControl><Input placeholder="Optional hint..." {...field} /></FormControl>
                                </FormItem>
                              )}
                            />
                          )}
                        </div>
                        <div className="md:col-span-2 flex items-center pt-8">
                          <FormField
                            control={form.control}
                            name={`fields.${index}.required`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <FormLabel className="font-normal cursor-pointer">Required</FormLabel>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border shadow-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {fields.length === 0 && (
                    <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground">
                      No fields added. Your campaign needs at least one field to collect data.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-4 mb-20">
              <Button type="submit" size="lg" disabled={createCampaign.isPending} className="min-w-[150px]">
                {createCampaign.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Create Campaign
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
