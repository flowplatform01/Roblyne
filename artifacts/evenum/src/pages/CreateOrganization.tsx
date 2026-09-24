import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation, Link } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCreateOrganization, getListOrganizationsQueryKey } from "@workspace/api-client-react";
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
import { Loader2, ArrowLeft, Building2 } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { MobileActionBar } from "@/components/layout/MobileActionBar";

const orgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  description: z.string().optional(),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  logoUrl: z.string().optional(),
});

export default function CreateOrganization() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createOrg = useCreateOrganization();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof orgSchema>>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: "",
      description: "",
      website: "",
      logoUrl: "",
    },
  });

  function onSubmit(values: z.infer<typeof orgSchema>) {
    createOrg.mutate(
      { 
        data: {
          name: values.name,
          description: values.description || undefined,
          website: values.website || undefined,
          logoUrl: values.logoUrl || undefined,
        } 
      },
      {
        onSuccess: (org) => {
          queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
          toast({
            title: "Workspace Initialized",
            description: `${org.name} has been successfully created.`,
          });
          setLocation(`/organizations/${org.id}`);
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Initialization failed",
            description: "There was a problem creating your organization. Please try again.",
          });
        },
      }
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto animate-in fade-in duration-700 pt-4">
        <Button variant="ghost" asChild className="mb-8 -ml-4 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workspaces
          </Link>
        </Button>

        <div className="mb-10 flex items-start gap-5">
          <div className="w-14 h-14 bg-primary text-primary-foreground rounded-sm flex items-center justify-center shadow-md shrink-0">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-4xl font-serif font-bold tracking-tight mb-2">Initialize Workspace</h1>
            <p className="text-muted-foreground text-lg font-light">
              Set up a secure environment for your institution's engagements.
            </p>
          </div>
        </div>

        <Card className="border-border shadow-xl bg-card rounded-sm overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary to-primary/40" />
          <CardContent className="p-8 sm:p-10">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-24 md:pb-0">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Institution Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. National Board of Directors" {...field} className="h-14 text-lg bg-background border-border/60" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-8">
                  <div className="space-y-8">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Public Charter / Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Briefly describe the purpose of this organization..." 
                              className="min-h-[140px] resize-none bg-background border-border/60 text-base"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription className="font-light">
                            This may be visible on public pages for your elections and events.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Official Website</FormLabel>
                          <FormControl>
                            <Input placeholder="https://..." {...field} className="h-12 bg-background border-border/60" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="md:pt-0 pt-4 border-t md:border-t-0 md:border-l md:pl-8 border-border/50">
                    <FormField
                      control={form.control}
                      name="logoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-semibold tracking-wide uppercase text-muted-foreground mb-4 block">Official Seal / Logo</FormLabel>
                          <FormControl>
                            <div className="bg-background border border-border/60 rounded-sm p-2 shadow-inner">
                              <ImageUpload
                                value={field.value}
                                onChange={field.onChange}
                                aspectRatio="square"
                                label=""
                                className="w-full"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="hidden md:flex justify-end pt-8 border-t border-border/50 mt-10">
                  <Button type="submit" size="lg" disabled={createOrg.isPending} className="h-14 px-10 text-lg shadow-md hover:shadow-lg transition-all">
                    {createOrg.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    Create Workspace
                  </Button>
                </div>
                <MobileActionBar label="Create Workspace" pending={createOrg.isPending} pendingLabel="Creating workspace…" />
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
