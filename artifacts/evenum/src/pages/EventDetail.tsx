import React, { useState, useEffect, useRef } from 'react';
import { useRoute, Link, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { 
  useGetEvent, 
  useListTicketTypes,
  useCreateTicketType,
  useUpdateEvent,
  useListAttendees,
  useGetEventAnalytics,
  getListTicketTypesQueryKey,
  getGetEventQueryKey,
  useCheckInAttendee,
  getListAttendeesQueryKey,
  exportEventAttendees
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus, Users, CalendarDays, ArrowLeft, MoreVertical, Play, Square, ExternalLink, BarChart3, Clock, Copy, Ticket, CheckCircle2, QrCode, Download, Camera, Keyboard, Save } from "lucide-react";
import { ShareButton } from "@/components/branding/ShareButton";
import { ImageUpload } from "@/components/ui/image-upload";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccentColorPicker } from "@/components/branding/AccentColorPicker";
import { format } from "date-fns";
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ManagementDetailLoadingSkeleton, InlineListLoadingSkeleton } from "@/components/loading/LoadingStates";

const ticketTypeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0).default(0),
  currency: z.string().default("XAF"),
  quantity: z.coerce.number().min(1).optional().or(z.literal("")),
});

// QR Scanner component using html5-qrcode
interface QrScannerProps {
  onScan: (code: string) => void;
  onError?: (err: string) => void;
}

function QrScannerView({ onScan, onError }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5QrcodeScanner | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initScanner() {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        if (!mounted || !containerRef.current) return;

        const scanner = new Html5QrcodeScanner(
          "qr-scanner-region",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );

        scannerRef.current = scanner;

        scanner.render(
          (decodedText) => {
            if (mounted) onScan(decodedText.trim());
          },
          (rawError) => {
            // Html5QrcodeScanner may pass an object or string — normalise first
            const errorMessage = typeof rawError === "string" ? rawError : String(rawError ?? "");
            // Ignore per-frame "no QR code found" noise
            if (errorMessage.includes("NotFoundException")) return;
            if (errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("denied")) {
              setPermissionDenied(true);
            }
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("denied")) {
          setPermissionDenied(true);
        }
        onError?.(msg);
      }
    }

    initScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  if (permissionDenied) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
        <Camera className="h-12 w-12 text-muted-foreground" />
        <p className="font-medium">Camera permission denied</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Please allow camera access in your browser settings and reload the page to use QR scanning.
        </p>
      </div>
    );
  }

  return <div id="qr-scanner-region" ref={containerRef} className="w-full" />;
}

export default function EventDetail() {
  const [match, params] = useRoute("/events/:id");
  const eventId = params?.id ? parseInt(params.id, 10) : 0;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("tickets");
  const [isTicketDialogOpen, setIsTicketDialogOpen] = useState(false);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [checkInCode, setCheckInCode] = useState("");
  const [checkInMode, setCheckInMode] = useState<"manual" | "scan">("manual");
  const [isExporting, setIsExporting] = useState(false);

  const { data: event, isLoading: isEventLoading } = useGetEvent(eventId);
  const { data: ticketTypes, isLoading: isTicketTypesLoading } = useListTicketTypes(eventId);
  const { data: attendees, isLoading: isAttendeesLoading } = useListAttendees(eventId);
  const { data: analytics, isLoading: isAnalyticsLoading } = useGetEventAnalytics(eventId);
  
  const updateEvent = useUpdateEvent();
  const createTicketType = useCreateTicketType();
  const checkIn = useCheckInAttendee();

  const form = useForm<z.infer<typeof ticketTypeSchema>>({
    resolver: zodResolver(ticketTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      currency: "XAF",
      quantity: "",
    },
  });

  if (isEventLoading) {
    return (
      <DashboardLayout>
        <ManagementDetailLoadingSkeleton label="Loading event" />
      </DashboardLayout>
    );
  }

  if (!event) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Event Not Found</h2>
          <Button asChild><Link href="/dashboard">Return to Dashboard</Link></Button>
        </div>
      </DashboardLayout>
    );
  }

  const handleStatusChange = (newStatus: 'draft' | 'published' | 'cancelled' | 'completed') => {
    updateEvent.mutate(
      { eventId, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });
          toast({ title: `Event marked as ${newStatus}` });
        }
      }
    );
  };

  const handleCreateTicketType = (values: z.infer<typeof ticketTypeSchema>) => {
    createTicketType.mutate(
      {
        eventId,
        data: {
          name: values.name,
          description: values.description,
          price: values.price,
          currency: values.currency,
          quantity: values.quantity ? Number(values.quantity) : undefined
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTicketTypesQueryKey(eventId) });
          setIsTicketDialogOpen(false);
          form.reset();
          toast({ title: "Ticket type created" });
        }
      }
    );
  };

  const performCheckIn = (code: string) => {
    if (!code) return;
    checkIn.mutate(
      { eventId, data: { ticketCode: code } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAttendeesQueryKey(eventId) });
          toast({ title: "Attendee checked in successfully!" });
          setCheckInCode("");
        },
        onError: () => {
          toast({ title: "Invalid or already used ticket code", variant: "destructive" });
        }
      }
    );
  };

  const handleManualCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    performCheckIn(checkInCode);
  };

  const handleQrScan = (code: string) => {
    performCheckIn(code);
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const csvText = await exportEventAttendees(eventId);
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `event-${eventId}-attendees.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "CSV exported successfully" });
    } catch {
      toast({ title: "Failed to export CSV", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const copyRegistrationLink = () => {
    const url = `${window.location.origin}/events/${event.id}/register`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard" });
  };

  const getStatusBadge = () => {
    switch (event.status) {
      case 'published': return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Published</Badge>;
      case 'draft': return <Badge variant="outline" className="bg-slate-100 text-slate-800">Draft</Badge>;
      case 'completed': return <Badge variant="secondary">Completed</Badge>;
      case 'cancelled': return <Badge variant="destructive">Cancelled</Badge>;
      default: return null;
    }
  };

  return (
    <DashboardLayout orgId={event.orgId.toString()}>
      <div className="mb-6">
        <Button variant="ghost" asChild className="-ml-4 text-muted-foreground mb-4">
          <Link href={`/organizations/${event.orgId}?tab=events`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Organization
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CalendarDays className="h-5 w-5" />
              </div>
              <h1 className="text-3xl font-serif font-bold tracking-tight">{event.title}</h1>
              {getStatusBadge()}
            </div>
            {event.description && <p className="text-muted-foreground max-w-3xl mt-2">{event.description}</p>}
            
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Badge variant="outline">{event.visibility}</Badge></span>
              {event.isOnline ? (
                <span className="flex items-center gap-1.5"><Badge variant="outline">Online Event</Badge></span>
              ) : event.location && (
                <span className="flex items-center gap-1.5 truncate max-w-[200px]"><Badge variant="outline">{event.location}</Badge></span>
              )}
              {event.startsAt && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {format(new Date(event.startsAt), 'MMM d, yyyy h:mm a')}</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {event.status === 'published' && (
              <Button onClick={copyRegistrationLink} variant="outline">
                <Copy className="mr-2 h-4 w-4" /> Copy Reg Link
              </Button>
            )}
            
            <Button asChild variant={event.status === 'published' ? "default" : "secondary"}>
              <Link href={`/events/${event.id}/register`}>
                <ExternalLink className="mr-2 h-4 w-4" /> View Page
              </Link>
            </Button>
            <ShareButton
              url={`${window.location.origin}/events/${event.id}/register`}
              title={event.title}
              description={event.description || `Register for ${event.title}`}
              ctaLabel="Share Event"
              variant="icon"
            />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {event.status === 'draft' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('published')}>
                    <Play className="mr-2 h-4 w-4 text-emerald-600" /> Publish Event
                  </DropdownMenuItem>
                )}
                {event.status === 'published' && (
                  <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Mark Completed
                  </DropdownMenuItem>
                )}
                {(event.status === 'draft' || event.status === 'published') && (
                  <DropdownMenuItem onClick={() => handleStatusChange('cancelled')} className="text-destructive">
                    <Square className="mr-2 h-4 w-4" /> Cancel Event
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 border-b rounded-none bg-transparent p-0 w-full justify-start h-auto overflow-x-auto scrollbar-none">
              <TabsTrigger 
                value="tickets" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap shrink-0"
              >
                Ticket Types
              </TabsTrigger>
              <TabsTrigger 
                value="attendees" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap shrink-0"
              >
                Attendees
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap shrink-0"
              >
                Analytics
              </TabsTrigger>
              <TabsTrigger 
                value="branding" 
                className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none whitespace-nowrap shrink-0"
              >
                Branding
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tickets" className="mt-0 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-serif font-bold">Ticket Types</h2>
                <Dialog open={isTicketDialogOpen} onOpenChange={setIsTicketDialogOpen}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> Add Ticket Type</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Ticket Type</DialogTitle>
                      <DialogDescription>Create a ticket option for your attendees.</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleCreateTicketType)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ticket Name</FormLabel>
                              <FormControl><Input placeholder="e.g. General Admission" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (Optional)</FormLabel>
                              <FormControl><Textarea placeholder="What's included..." {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price (0 for free)</FormLabel>
                                <FormControl><Input type="number" step="0.01" min={0} {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Available Qty</FormLabel>
                                <FormControl><Input type="number" placeholder="Unlimited" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={createTicketType.isPending}>
                            {createTicketType.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Ticket
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>

              {isTicketTypesLoading ? (
                <InlineListLoadingSkeleton rows={3} label="Loading ticket types" />
              ) : !ticketTypes || ticketTypes.length === 0 ? (
                <Card className="border-dashed bg-muted/20">
                  <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No ticket types added</h3>
                    <p className="text-muted-foreground mb-4">Add at least one ticket type so people can register.</p>
                    <Button onClick={() => setIsTicketDialogOpen(true)}>Create First Ticket</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ticketTypes.map(ticket => (
                    <Card key={ticket.id} className="border-border/60 flex flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="font-serif text-lg">{ticket.name}</CardTitle>
                          <span className="font-bold text-lg text-emerald-600">
                            {ticket.price === 0 ? 'Free' : `$${ticket.price.toFixed(2)}`}
                          </span>
                        </div>
                        {ticket.description && <CardDescription className="line-clamp-2">{ticket.description}</CardDescription>}
                      </CardHeader>
                      <CardContent className="mt-auto pt-4">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Sold: {ticket.sold || 0}</span>
                          <span>Total: {ticket.quantity === null ? 'Unlimited' : ticket.quantity}</span>
                        </div>
                        <div className="mt-2 h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ 
                              width: ticket.quantity ? `${((ticket.sold || 0) / ticket.quantity) * 100}%` : '0%' 
                            }} 
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="attendees" className="mt-0 space-y-6">
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <h2 className="text-xl font-serif font-bold">Attendees</h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Export CSV
                  </Button>
                  <Dialog open={isCheckInDialogOpen} onOpenChange={(open) => {
                    setIsCheckInDialogOpen(open);
                    if (!open) setCheckInMode("manual");
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline"><QrCode className="mr-2 h-4 w-4" /> Check-in</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Attendee Check-in</DialogTitle>
                        <DialogDescription>Enter a ticket code manually or scan a QR code.</DialogDescription>
                      </DialogHeader>

                      {/* Mode toggle */}
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant={checkInMode === "manual" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={() => setCheckInMode("manual")}
                        >
                          <Keyboard className="mr-2 h-4 w-4" /> Manual Entry
                        </Button>
                        <Button
                          variant={checkInMode === "scan" ? "default" : "outline"}
                          size="sm"
                          className="flex-1"
                          onClick={() => setCheckInMode("scan")}
                        >
                          <Camera className="mr-2 h-4 w-4" /> Scan QR Code
                        </Button>
                      </div>

                      {checkInMode === "manual" ? (
                        <form onSubmit={handleManualCheckIn} className="space-y-4 pt-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Ticket Code</label>
                            <Input 
                              value={checkInCode} 
                              onChange={(e) => setCheckInCode(e.target.value)} 
                              placeholder="e.g. TKT-123456" 
                              autoFocus
                            />
                          </div>
                          <DialogFooter>
                            <Button type="submit" disabled={!checkInCode || checkIn.isPending}>
                              {checkIn.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Check In
                            </Button>
                          </DialogFooter>
                        </form>
                      ) : (
                        <div className="pt-2 space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Point camera at the attendee's QR code. Check-in happens automatically on scan.
                          </p>
                          <QrScannerView
                            onScan={(code) => {
                              handleQrScan(code);
                            }}
                            onError={(err) => {
                              toast({ title: `Scanner error: ${err}`, variant: "destructive" });
                            }}
                          />
                          {checkIn.isPending && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                              <Loader2 className="h-4 w-4 animate-spin" /> Checking in…
                            </div>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {isAttendeesLoading ? (
                <InlineListLoadingSkeleton rows={5} label="Loading attendees" />
              ) : !attendees || attendees.length === 0 ? (
                <Card className="border-dashed bg-muted/20">
                  <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No attendees yet</h3>
                    <p className="text-muted-foreground">When people register for your event, they will appear here.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-muted-foreground border-b border-border/50">
                        <tr>
                          <th className="px-4 py-3 font-medium">Name</th>
                          <th className="px-4 py-3 font-medium">Email</th>
                          <th className="px-4 py-3 font-medium">Ticket</th>
                          <th className="px-4 py-3 font-medium">Code</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {attendees.map(attendee => (
                          <tr key={attendee.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium">{attendee.attendeeName}</td>
                            <td className="px-4 py-3 text-muted-foreground">{attendee.attendeeEmail}</td>
                            <td className="px-4 py-3">{attendee.ticketTypeName}</td>
                            <td className="px-4 py-3 font-mono text-xs">{attendee.ticketCode}</td>
                            <td className="px-4 py-3">
                              {attendee.status === 'used' ? (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                                  Checked In
                                </Badge>
                              ) : attendee.status === 'cancelled' ? (
                                <Badge variant="secondary">Cancelled</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                  Valid
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="analytics" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Registrations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-serif font-bold">{analytics?.totalAttendees || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Checked In</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-serif font-bold text-primary">
                      {analytics?.checkedIn || 0}
                    </div>
                    {analytics?.checkInRate !== undefined && (
                      <p className="text-sm text-muted-foreground mt-1">{(analytics.checkInRate * 100).toFixed(1)}% attendance</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-serif font-bold text-emerald-600">
                      ${analytics?.revenue?.toFixed(2) || '0.00'}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="branding" className="mt-0">
              <EventBrandingSection event={event} eventId={eventId} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-serif">Event Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Status</span>
                {getStatusBadge()}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Attendees</span>
                <span className="font-medium">{event.attendeesCount || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Ticket Types</span>
                <span className="font-medium">{event.ticketTypesCount || 0}</span>
              </div>
              {event.capacity && (
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-muted-foreground text-sm">Capacity</span>
                  <span className="font-medium">{event.attendeesCount || 0} / {event.capacity}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function EventBrandingSection({ event, eventId }: { event: any; eventId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [heroImageUrl, setHeroImageUrl] = useState<string>(event.heroImageUrl ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState<string>(event.coverImageUrl ?? '');
  const [accentColor, setAccentColor] = useState<string>(event.accentColor ?? '#4F46E5');
  const [theme, setTheme] = useState<'evenum' | 'light' | 'dark'>(event.theme ?? 'evenum');
  const updateEvent = useUpdateEvent();

  const handleSave = () => {
    updateEvent.mutate(
      {
        eventId,
        data: {
          heroImageUrl: heroImageUrl || undefined,
          coverImageUrl: coverImageUrl || undefined,
          accentColor,
          theme,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });
          toast({ title: 'Branding saved', description: 'Event branding updated.' });
        },
        onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-xl font-serif font-bold mb-1">Event Branding</h2>
        <p className="text-sm text-muted-foreground">These settings override the organization theme for this event's public registration page.</p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-serif">Media</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ImageUpload
              label="Hero Image"
              value={heroImageUrl || undefined}
              onChange={v => setHeroImageUrl(v ?? '')}
            />
            <ImageUpload
              label="Cover Image"
              value={coverImageUrl || undefined}
              onChange={v => setCoverImageUrl(v ?? '')}
            />
          </div>
          <p className="text-xs text-muted-foreground">Hero: full-width background on the public registration page. Cover: cards and social sharing.</p>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-serif">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Accent Color</Label>
            <p className="text-xs text-muted-foreground">Primary color for buttons and highlights on the registration page</p>
            <AccentColorPicker value={accentColor} onChange={setAccentColor} />
          </div>
          <div className="space-y-2">
            <Label>Theme</Label>
            <p className="text-xs text-muted-foreground">Visual theme for the public registration experience</p>
            <Select value={theme} onValueChange={v => setTheme(v as 'evenum' | 'light' | 'dark')}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evenum">Evenum (Dark Blue)</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateEvent.isPending} className="h-10 px-8 rounded-sm">
          {updateEvent.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Branding
        </Button>
      </div>
    </div>
  );
}
