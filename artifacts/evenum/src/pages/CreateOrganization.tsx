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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Building2 } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

const orgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  description: z.string().optional(),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  logoUrl: z.string().optional(), // accepts base64 data URLs from ImageUpload
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
            title: "Organization created",
            description: `${org.name} has been successfully created.`,
          });
          setLocation(`/organizations/${org.id}`);
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Failed to create organization",
            description: "There was a problem creating your organization. Please try again.",
          });
        },
      }
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>

        <div className="mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Create Organization</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Set up a new workspace for your elections, events, and campaigns.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">Organization Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Professional Association" {...field} className="h-11" />
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
                      <FormLabel className="text-base">Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Briefly describe your organization's purpose..." 
                          className="min-h-[100px] resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        This may be visible on public pages for your elections and events.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.org" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="logoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logo Image</FormLabel>
                        <FormControl>
                          <ImageUpload
                            value={field.value}
                            onChange={field.onChange}
                            aspectRatio="square"
                            label=""
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pt-4 border-t mt-8">
                  <Button type="submit" size="lg" disabled={createOrg.isPending}>
                    {createOrg.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    Create Workspace
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
