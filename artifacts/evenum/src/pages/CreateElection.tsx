import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCreateElection, getListElectionsQueryKey, useListOrganizations } from "@workspace/api-client-react";
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
import { Loader2, ArrowLeft, Vote } from "lucide-react";
import { Link } from "wouter";

const electionSchema = z.object({
  orgId: z.string().min(1, "Please select an organization"),
  title: z.string().min(3, "Election title must be at least 3 characters"),
  description: z.string().optional(),
  visibility: z.enum(["public", "private"]),
  requiresAuth: z.boolean().default(false),
  startsAt: z.string().optional().or(z.literal("")),
  endsAt: z.string().optional().or(z.literal("")),
});

export default function CreateElection() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialOrgId = searchParams.get('orgId') || "";

  const { toast } = useToast();
  const createElection = useCreateElection();
  const queryClient = useQueryClient();
  const { data: organizations, isLoading: isOrgsLoading } = useListOrganizations();

  const form = useForm<z.infer<typeof electionSchema>>({
    resolver: zodResolver(electionSchema),
    defaultValues: {
      orgId: initialOrgId,
      title: "",
      description: "",
      visibility: "public",
      requiresAuth: false,
      startsAt: "",
      endsAt: "",
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
          requiresAuth: values.requiresAuth,
          startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : undefined,
          endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : undefined,
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
        onError: () => {
          toast({
            variant: "destructive",
            title: "Creation failed",
            description: "There was a problem creating the election. Please try again.",
          });
        },
      }
    );
  }

  const selectedOrgId = form.watch("orgId");

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
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 mb-4">
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
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
                        <FormItem className="flex flex-row items-center justify-between space-y-0">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Public Visibility</FormLabel>
                            <FormDescription>
                              Allow this election to appear in discovery feeds
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value === "public"}
                              onCheckedChange={(checked) => field.onChange(checked ? "public" : "private")}
                            />
                          </FormControl>
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

                <div className="flex justify-end pt-6 mt-8">
                  <Button type="submit" size="lg" disabled={createElection.isPending} className="min-w-[150px]">
                    {createElection.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    Create Election
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
