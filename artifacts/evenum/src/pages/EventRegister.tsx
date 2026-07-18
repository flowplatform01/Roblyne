import React, { useState } from 'react';
import { useRoute } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useGetEvent, useListTicketTypes, useRegisterForEvent } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CalendarDays, MapPin, Clock, AlertCircle, CheckCircle2, Ticket, ShieldCheck, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";

export default function EventRegister() {
  const [match, params] = useRoute("/events/:id/register");
  const eventId = params?.id ? parseInt(params.id, 10) : 0;
  
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [isSuccess, setIsSuccess] = useState(false);
  const [ticketCode, setTicketCode] = useState("");
  const [ticketTypeName, setTicketTypeName] = useState("");

  const { data: event, isLoading: isEventLoading } = useGetEvent(eventId);
  const { data: ticketTypes, isLoading: isTicketTypesLoading } = useListTicketTypes(eventId);
  const registerMutation = useRegisterForEvent();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !formData.name || !formData.email) return;

    const selectedTicket = ticketTypes?.find(t => t.id === selectedTicketId);

    registerMutation.mutate(
      {
        eventId,
        data: {
          ticketTypeId: selectedTicketId,
          attendeeName: formData.name,
          attendeeEmail: formData.email,
          quantity: 1
        }
      },
      {
        onSuccess: (result) => {
          setIsSuccess(true);
          setTicketCode(result?.ticketCode || `TKT-${Math.floor(Math.random() * 1000000)}`);
          setTicketTypeName(selectedTicket?.name || "General Admission");
        }
      }
    );
  };

  if (isEventLoading || isTicketTypesLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center min-h-screen paper-grain">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        </div>
      </Layout>
    );
  }

  if (!event) return null;

  if (event.status !== 'published') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-2xl animate-in fade-in duration-700">
          <AlertCircle className="h-16 w-16 text-muted-foreground/50 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Registration Unavailable</h1>
          <p className="text-xl text-muted-foreground font-light">This event is not currently accepting registrations.</p>
        </div>
      </Layout>
    );
  }

  if (isSuccess) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 text-center max-w-2xl animate-in zoom-in-95 duration-700">
          <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="text-5xl font-serif font-bold mb-6 tracking-tight">You're Registered!</h1>
          <p className="text-xl text-muted-foreground font-light mb-12 leading-relaxed">
            We've sent a confirmation email to <strong className="text-foreground">{formData.email}</strong>. Keep this ticket safe.
          </p>
          
          {/* Ticket Card with QR Code */}
          <div className="border border-border/80 rounded-sm overflow-hidden shadow-2xl bg-card text-left max-w-lg mx-auto transform transition-transform hover:-translate-y-2 duration-500">
            {/* Ticket header */}
            <div className="bg-foreground text-background px-8 py-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Ticket className="w-32 h-32" />
              </div>
              <p className="text-background/70 text-xs uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Official Ticket
              </p>
              <h2 className="text-background text-2xl font-serif font-bold leading-tight relative z-10">{event.title}</h2>
            </div>

            {/* Divider with notches */}
            <div className="relative flex items-center px-8 bg-card">
              <div className="absolute -left-4 w-8 h-8 rounded-full bg-background border border-border/80" />
              <div className="flex-1 border-t-2 border-dashed border-border/50 mx-4" />
              <div className="absolute -right-4 w-8 h-8 rounded-full bg-background border border-border/80" />
            </div>

            {/* Ticket body */}
            <div className="px-8 py-8 flex flex-col sm:flex-row gap-8 items-center bg-card">
              <div className="flex-1 space-y-5 min-w-0 w-full">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Attendee</p>
                  <p className="font-serif font-bold text-xl truncate">{formData.name}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Ticket Type</p>
                  <p className="font-medium text-lg text-emerald-600">{ticketTypeName}</p>
                </div>
                {event.startsAt && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Date</p>
                    <p className="font-medium">{format(new Date(event.startsAt), 'MMM d, yyyy • h:mm a')}</p>
                  </div>
                )}
                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Entry Code</p>
                  <p className="font-mono text-lg font-bold tracking-widest">{ticketCode}</p>
                </div>
              </div>

              {/* QR Code */}
              <div className="shrink-0 flex flex-col items-center gap-3">
                <div className="p-4 bg-white rounded-sm border border-border/60 shadow-inner">
                  <QRCodeSVG
                    value={ticketCode}
                    size={150}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Scan at door</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-foreground text-background py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/attached_assets/generated_images/event-abstract.jpg')] bg-cover bg-center opacity-20 mix-blend-screen" />
        <div className="container mx-auto px-4 max-w-4xl text-center relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-sm bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 mb-8 shadow-sm backdrop-blur-sm">
            <CalendarDays className="h-8 w-8" />
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight mb-8 leading-tight text-card">{event.title}</h1>
          
          <div className="flex flex-wrap justify-center gap-8 text-card/80 font-medium">
            {event.startsAt && (
              <div className="flex items-center gap-3 bg-background/10 px-5 py-2.5 rounded-sm border border-background/10 backdrop-blur-md">
                <Clock className="h-5 w-5 text-emerald-400" />
                <span>{format(new Date(event.startsAt), 'MMMM d, yyyy • h:mm a')}</span>
              </div>
            )}
            <div className="flex items-center gap-3 bg-background/10 px-5 py-2.5 rounded-sm border border-background/10 backdrop-blur-md">
              <MapPin className="h-5 w-5 text-emerald-400" />
              <span>{event.isOnline ? "Online Event" : event.location || "Location TBA"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16 max-w-6xl flex-1 paper-grain relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
          
          <div className="lg:col-span-3 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
            {event.coverImageUrl && (
              <div className="w-full h-64 sm:h-80 md:h-96 rounded-sm overflow-hidden shadow-lg border border-border/60">
                <img src={event.coverImageUrl} alt={event.title} className="w-full h-full object-cover" />
              </div>
            )}
            
            <section>
              <h2 className="text-3xl font-serif font-bold mb-6 flex items-center gap-4">
                <span className="w-8 h-1 bg-emerald-600 block"></span>
                About this event
              </h2>
              <div className="prose prose-lg prose-slate max-w-none text-foreground/80 font-light leading-relaxed">
                {event.description ? (
                  <p className="whitespace-pre-line">{event.description}</p>
                ) : (
                  <p className="italic text-muted-foreground">No description provided for this event.</p>
                )}
              </div>
            </section>
            
            <section>
              <h2 className="text-3xl font-serif font-bold mb-8 flex items-center gap-4">
                <span className="w-8 h-1 bg-emerald-600 block"></span>
                Select Tickets
              </h2>
              {(!ticketTypes || ticketTypes.length === 0) ? (
                <div className="p-8 text-center bg-card border border-dashed rounded-sm">
                  <p className="text-muted-foreground">No tickets are currently available.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ticketTypes.map((ticket) => {
                    const isSoldOut = ticket.quantity !== null && (ticket.sold || 0) >= ticket.quantity;
                    const isSelected = selectedTicketId === ticket.id;
                    
                    return (
                      <div 
                        key={ticket.id}
                        onClick={() => !isSoldOut && setSelectedTicketId(ticket.id)}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-6 rounded-sm border-2 transition-all duration-300 ${
                          isSoldOut ? 'opacity-50 bg-muted cursor-not-allowed border-border/50' : 
                          isSelected ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10 shadow-md transform scale-[1.01]' : 
                          'bg-card border-border/60 hover:border-emerald-600/50 hover:shadow-sm cursor-pointer'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-6 mb-4 sm:mb-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-serif font-bold text-2xl truncate">{ticket.name}</h3>
                            {isSoldOut && <Badge variant="secondary" className="text-xs uppercase tracking-widest font-bold">Sold Out</Badge>}
                          </div>
                          {ticket.description && <p className="text-muted-foreground font-light line-clamp-2">{ticket.description}</p>}
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 shrink-0 border-t sm:border-t-0 sm:border-l border-border/50 pt-4 sm:pt-0 sm:pl-6">
                          <span className={`text-2xl font-bold font-serif ${isSoldOut ? 'text-muted-foreground' : 'text-emerald-600'}`}>
                            {ticket.price === 0 ? 'Free' : `$${ticket.price.toFixed(2)}`}
                          </span>
                          {!isSoldOut && (
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-input bg-background'
                            }`}>
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white animate-in zoom-in" />}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
          
          <div className="lg:col-span-2">
            <div className="sticky top-24 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-300">
              <Card className="shadow-2xl border-border rounded-sm overflow-hidden">
                <div className="h-2 w-full bg-emerald-600" />
                <CardHeader className="bg-card px-8 pt-8 pb-6 border-b border-border/50">
                  <div className="flex items-center gap-3 mb-2">
                    <Ticket className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="font-serif text-2xl">Registration</CardTitle>
                  </div>
                  <CardDescription className="text-base font-light">Enter your details to secure your spot</CardDescription>
                </CardHeader>
                <CardContent className="p-8 bg-card">
                  <form id="registration-form" onSubmit={handleRegister} className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Full Name</Label>
                      <Input 
                        id="name" 
                        required 
                        placeholder="Jane Doe" 
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        disabled={!selectedTicketId || registerMutation.isPending}
                        className="h-14 text-lg bg-background border-border/60 focus:border-emerald-500 rounded-sm"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Address</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        required 
                        placeholder="jane@example.com" 
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        disabled={!selectedTicketId || registerMutation.isPending}
                        className="h-14 text-lg bg-background border-border/60 focus:border-emerald-500 rounded-sm"
                      />
                    </div>
                  </form>
                </CardContent>
                <CardFooter className="flex-col pt-0 pb-8 px-8 bg-card gap-6">
                  <div className="w-full p-6 bg-muted/30 border border-border/50 rounded-sm">
                    <div className="flex justify-between items-center text-sm font-medium mb-2">
                      <span className="text-muted-foreground uppercase tracking-widest text-xs font-bold">Selected</span>
                      <span className="font-serif truncate max-w-[150px] text-right">
                        {selectedTicketId ? ticketTypes?.find(t => t.id === selectedTicketId)?.name : 'None'}
                      </span>
                    </div>
                    <div className="w-full flex justify-between items-end border-t border-border/50 pt-4 mt-2">
                      <span className="text-muted-foreground uppercase tracking-widest text-xs font-bold">Total Due</span>
                      <span className="text-3xl font-serif font-bold text-emerald-600">
                        {selectedTicketId 
                          ? (ticketTypes?.find(t => t.id === selectedTicketId)?.price === 0 
                              ? 'Free' 
                              : `$${ticketTypes?.find(t => t.id === selectedTicketId)?.price.toFixed(2)}`)
                          : '$0.00'
                        }
                      </span>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    form="registration-form" 
                    className="w-full h-16 text-lg font-bold shadow-lg hover:shadow-xl transition-all bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm" 
                    disabled={!selectedTicketId || !formData.name || !formData.email || registerMutation.isPending}
                  >
                    {registerMutation.isPending ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : null}
                    Complete Registration <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
          
        </div>
      </div>
    </Layout>
  );
}
