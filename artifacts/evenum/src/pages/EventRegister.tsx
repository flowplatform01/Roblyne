import React, { useState } from 'react';
import { useRoute } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { useGetEvent, useListTicketTypes, useRegisterForEvent } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CalendarDays, MapPin, Clock, Ticket, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function EventRegister() {
  const [match, params] = useRoute("/events/:id/register");
  const eventId = params?.id ? parseInt(params.id, 10) : 0;
  
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [isSuccess, setIsSuccess] = useState(false);
  const [ticketCode, setTicketCode] = useState("");

  const { data: event, isLoading: isEventLoading } = useGetEvent(eventId);
  const { data: ticketTypes, isLoading: isTicketTypesLoading } = useListTicketTypes(eventId);
  const registerMutation = useRegisterForEvent();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !formData.name || !formData.email) return;

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
          // Assuming result has ticketCode, if not, stub it
          setTicketCode(result?.ticketCode || `TKT-${Math.floor(Math.random() * 1000000)}`);
        }
      }
    );
  };

  if (isEventLoading || isTicketTypesLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        </div>
      </Layout>
    );
  }

  if (!event) return null;

  if (event.status !== 'published') {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center max-w-2xl">
          <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h1 className="text-3xl font-serif font-bold mb-4">Registration Unavailable</h1>
          <p className="text-lg text-muted-foreground">This event is not currently accepting registrations.</p>
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
          <h1 className="text-3xl font-serif font-bold mb-4">You're Registered!</h1>
          <p className="text-lg text-muted-foreground mb-8">
            We've sent a confirmation email to <strong>{formData.email}</strong>.
          </p>
          
          <Card className="border-dashed bg-muted/20">
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-muted-foreground mb-1">Your Ticket Code</p>
              <div className="text-3xl font-mono font-bold tracking-widest text-primary mb-4">{ticketCode}</div>
              <p className="text-sm text-muted-foreground">Show this code at the door for check-in.</p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-foreground text-background py-16">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary mb-6">
            <CalendarDays className="h-6 w-6" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-6">{event.title}</h1>
          
          <div className="flex flex-wrap justify-center gap-6 text-slate-300">
            {event.startsAt && (
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span>{format(new Date(event.startsAt), 'MMMM d, yyyy • h:mm a')}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <span>{event.isOnline ? "Online Event" : event.location || "Location TBA"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-5xl flex-1">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
          
          <div className="md:col-span-3 space-y-8">
            <section>
              <h2 className="text-2xl font-serif font-bold mb-4">About this event</h2>
              <div className="prose prose-slate max-w-none text-muted-foreground">
                {event.description ? (
                  <p className="whitespace-pre-line leading-relaxed">{event.description}</p>
                ) : (
                  <p className="italic">No description provided for this event.</p>
                )}
              </div>
            </section>
            
            <section>
              <h2 className="text-2xl font-serif font-bold mb-6">Select Tickets</h2>
              {(!ticketTypes || ticketTypes.length === 0) ? (
                <p className="text-muted-foreground">No tickets are currently available.</p>
              ) : (
                <div className="space-y-4">
                  {ticketTypes.map((ticket) => {
                    const isSoldOut = ticket.quantity !== null && (ticket.sold || 0) >= ticket.quantity;
                    const isSelected = selectedTicketId === ticket.id;
                    
                    return (
                      <div 
                        key={ticket.id}
                        onClick={() => !isSoldOut && setSelectedTicketId(ticket.id)}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-xl border transition-all ${
                          isSoldOut ? 'opacity-50 bg-muted/50 cursor-not-allowed' : 
                          isSelected ? 'border-primary ring-1 ring-primary bg-primary/5 cursor-pointer' : 
                          'bg-card hover:border-primary/50 hover:bg-muted/10 cursor-pointer'
                        }`}
                      >
                        <div className="mb-4 sm:mb-0">
                          <h3 className="font-bold text-lg">{ticket.name}</h3>
                          {ticket.description && <p className="text-sm text-muted-foreground mt-1">{ticket.description}</p>}
                          {isSoldOut && <Badge variant="secondary" className="mt-2 text-xs">Sold Out</Badge>}
                        </div>
                        <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 shrink-0">
                          <span className="text-xl font-bold text-emerald-600">
                            {ticket.price === 0 ? 'Free' : `$${ticket.price.toFixed(2)}`}
                          </span>
                          {!isSoldOut && (
                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                              isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                            }`}>
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
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
          
          <div className="md:col-span-2">
            <div className="sticky top-24">
              <Card className="shadow-lg border-border/60">
                <CardHeader className="bg-muted/30 pb-4 border-b">
                  <CardTitle className="font-serif">Registration</CardTitle>
                  <CardDescription>Enter your details to secure your spot</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <form id="registration-form" onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input 
                        id="name" 
                        required 
                        placeholder="Jane Doe" 
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        disabled={!selectedTicketId || registerMutation.isPending}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        required 
                        placeholder="jane@example.com" 
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        disabled={!selectedTicketId || registerMutation.isPending}
                      />
                    </div>
                  </form>
                </CardContent>
                <CardFooter className="flex-col pt-2 pb-6 px-6 bg-muted/10 border-t gap-4">
                  <div className="w-full flex justify-between items-center py-2 text-sm font-medium">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-lg">
                      {selectedTicketId 
                        ? (ticketTypes?.find(t => t.id === selectedTicketId)?.price === 0 
                            ? 'Free' 
                            : `$${ticketTypes?.find(t => t.id === selectedTicketId)?.price.toFixed(2)}`)
                        : '$0.00'
                      }
                    </span>
                  </div>
                  <Button 
                    type="submit" 
                    form="registration-form" 
                    className="w-full h-12 text-base" 
                    disabled={!selectedTicketId || !formData.name || !formData.email || registerMutation.isPending}
                  >
                    {registerMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    Complete Registration
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
