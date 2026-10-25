import React from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useCreateEvent, getListEventsQueryKey, useListOrganizations } from "@workspace/api-client-react";
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
import { Loader2, ArrowLeft, CalendarDays } from "lucide-react";
import { Link } from "wouter";
import { ImageUpload } from "@/components/ui/image-upload";
import { MobileActionBar } from "@/components/layout/MobileActionBar";

const eventSchema = z.object({
  orgId: z.string().min(1, "Please select an organization"),
  title: z.string().min(3, "Event title must be at least 3 characters"),
  description: z.string().optional(),
  coverImageUrl: z.string().optional(), // accepts base64 data URLs from ImageUpload
  location: z.string().optional(),
  isOnline: z.boolean().default(false),
  onlineUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  visibility: z.enum(["public", "private", "invite_only"]),
  startsAt: z.string().optional().or(z.literal("")),
  endsAt: z.string().optional().or(z.literal("")),
  capacity: z.coerce.number().min(1).optional().or(z.literal("")),
});

export default function CreateEvent() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialOrgId = searchParams.get('orgId') || "";

  const { toast } = useToast();
  const createEvent = useCreateEvent();
  const queryClient = useQueryClient();
  const { data: organizations, isLoading: isOrgsLoading } = useListOrganizations();

  const form = useForm<z.infer<typeof eventSchema>>({
    resolver: zodResolver(eventSchema as any),
    defaultValues: {
      orgId: initialOrgId,
      title: "",
      description: "",
      coverImageUrl: "",
      location: "",
      isOnline: false,
      onlineUrl: "",
      visibility: "public",
      startsAt: "",
      endsAt: "",
      capacity: "",
    },
  });

  const isOnline = form.watch("isOnline");

  function onSubmit(values: z.infer<typeof eventSchema>) {
    createEvent.mutate(
      { 
        data: {
          orgId: parseInt(values.orgId, 10),
          title: values.title,
          description: values.description || undefined,
          coverImageUrl: values.coverImageUrl || undefined,
          location: values.location || undefined,
          isOnline: values.isOnline,
          onlineUrl: values.onlineUrl || undefined,
          visibility: values.visibility,
          startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : undefined,
          endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : undefined,
          capacity: values.capacity ? Number(values.capacity) : undefined,
        } 
      },
      {
        onSuccess: (event) => {
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
          toast({
            title: "Event created",
            description: "Your event has been successfully created. Now add some ticket types.",
          });
          setLocation(`/events/${event.id}`);
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Creation failed",
            description: "There was a problem creating the event. Please try again.",
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
          <Link href={initialOrgId ? `/organizations/${initialOrgId}?tab=events` : "/dashboard"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>

        <div className="mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 mb-4">
            <CalendarDays className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-serif font-bold tracking-tight">Create Event</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Set up an event, configure details, and prepare for registrations.
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
                      <FormLabel>Event Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Annual Tech Conference 2024" className="h-11" {...field} />
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
                          placeholder="Provide details about the event agenda, speakers, etc..." 
                          className="min-h-[120px] resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="coverImageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cover Image (Optional)</FormLabel>
                      <FormControl>
                        <ImageUpload
                          value={field.value || undefined}
                          onChange={(val) => field.onChange(val || "")}
                          aspectRatio="banner"
                          label=""
                          placeholder="Upload an event cover image"
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
                        <FormLabel>Start Date & Time</FormLabel>
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
                        <FormLabel>End Date & Time</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" className="h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-serif font-medium">Location & Capacity</h3>
                  
                  <div className="grid gap-6 p-4 border rounded-lg bg-muted/20">
                    <FormField
                      control={form.control}
                      name="isOnline"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between space-y-0">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Online Event</FormLabel>
                            <FormDescription>
                              This event will be hosted virtually
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
                    
                    {isOnline ? (
                      <FormField
                        control={form.control}
                        name="onlineUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Meeting URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://zoom.us/j/..." className="h-11" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Physical Location</FormLabel>
                            <FormControl>
                              <Input placeholder="123 Conference Center, City, ST" className="h-11" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Capacity (Optional)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Leave blank for unlimited" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-serif font-medium">Access & Visibility</h3>
                  
                  <div className="grid gap-6 p-4 border rounded-lg bg-muted/20">
                    <FormField
                      control={form.control}
                      name="visibility"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Visibility</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Select visibility" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="public">Public (Visible in discovery)</SelectItem>
                              <SelectItem value="private">Private (Only accessible via link)</SelectItem>
                              <SelectItem value="invite_only">Invite Only (Requires approval)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="hidden md:flex justify-end pt-6 mt-8">
                  <Button type="submit" size="lg" disabled={createEvent.isPending} className="min-w-[150px]">
                    {createEvent.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    Create Event
                  </Button>
                </div>
                <MobileActionBar label="Create Event" pending={createEvent.isPending} pendingLabel="Creating event…" />
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
