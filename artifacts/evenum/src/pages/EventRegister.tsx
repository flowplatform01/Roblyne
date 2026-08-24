import React, { useState } from 'react';
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useGetEvent, useListTicketTypes, useRegisterForEvent } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CalendarDays, MapPin, Clock, AlertCircle, CheckCircle2, Ticket, ShieldCheck, ArrowRight, Video, ChevronDown, ChevronUp, Building2, ExternalLink } from "lucide-react";
import { ShareButton } from "@/components/branding/ShareButton";
import { hexToHsl } from "@/lib/branding";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";
import { useCountdown } from "@/hooks/useLifecycle";

const FAQS = [
  {
    q: 'Will I receive a confirmation after registering?',
    a: 'Yes. Your digital ticket is shown immediately after registration. Screenshot or save it for entry.',
  },
  {
    q: 'Is my ticket transferable?',
    a: 'Tickets are issued in your name and linked to the entry code on your ticket. Contact the organizer if you need a transfer.',
  },
  {
    q: 'What is the cancellation policy?',
    a: 'Cancellation terms are set by the organizing team. Reach out to them directly for refund or cancellation requests.',
  },
];

function generateICS(event: any): string {
  const start = event.startsAt ? new Date(event.startsAt) : new Date();
  const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + 3600000);

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Evenum//EN',
    'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${event.title || 'Event'}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')}`,
    `LOCATION:${event.isOnline ? 'Online' : (event.location || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export default function EventRegister() {
  const [, params] = useRoute("/events/:id/register");
  const eventId = params?.id ? parseInt(params.id, 10) : 0;

  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [isSuccess, setIsSuccess] = useState(false);
  const [ticketCode, setTicketCode] = useState('');
  const [ticketTypeName, setTicketTypeName] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { data: event, isLoading: isEventLoading } = useGetEvent(eventId);
  const { data: ticketTypes, isLoading: isTicketTypesLoading } = useListTicketTypes(eventId);
  const registerMutation = useRegisterForEvent();
  const countdown = useCountdown(event?.endsAt);

  const shareUrl = `${window.location.origin}/events/${eventId}/register`;

  usePageMeta(event ? {
    title: event.title,
    description: event.description || `Register for ${event.title} — secure your spot on Evenum.`,
    image: (event as any).heroImageUrl || event.coverImageUrl || null,
    url: shareUrl,
  } : null);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !formData.name || !formData.email) return;

    const selectedTicket = ticketTypes?.find(t => t.id === selectedTicketId);
    const now = countdown.now;
    if (countdown.expired) return;
    if (selectedTicket?.saleStartsAt && Date.parse(selectedTicket.saleStartsAt) > now) return;
    if (selectedTicket?.saleEndsAt && Date.parse(selectedTicket.saleEndsAt) <= now) return;

    registerMutation.mutate(
      {
        eventId,
        data: {
          ticketTypeId: selectedTicketId,
          attendeeName: formData.name,
          attendeeEmail: formData.email,
          quantity: 1,
        },
      },
      {
        onSuccess: (result) => {
          setIsSuccess(true);
          setTicketCode(result?.ticketCode || `TKT-${Math.floor(Math.random() * 1000000)}`);
          setTicketTypeName(selectedTicket?.name || 'General Admission');
        },
      }
    );
  };

  const handleAddToCalendar = () => {
    if (!event) return;
    const ics = generateICS(event);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(event.title || 'event').replace(/\s+/g, '-').toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isEventLoading || isTicketTypesLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600/50" />
        </div>
      </Layout>
    );
  }

  if (!event) return null;

  const primaryStyle: React.CSSProperties = (event as any).accentColor
    ? { "--primary": hexToHsl((event as any).accentColor) } as React.CSSProperties
    : {};

  if (event.status !== 'published') {
    const orgId = (event as any).orgId;
    const orgLogoUrl = (event as any).organizationLogoUrl;
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl animate-in fade-in duration-700">
          <AlertCircle className="h-14 w-14 text-muted-foreground/40 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Registration Unavailable</h1>
          <p className="text-xl text-muted-foreground font-light mb-8">This event is not currently accepting registrations.</p>
          {event.organizationName && (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground/70 border border-border/50 rounded-full px-4 py-1.5">
              {orgLogoUrl
                ? <img src={orgLogoUrl} alt={event.organizationName} className="w-4 h-4 rounded-full object-cover shrink-0" />
                : <Building2 className="h-3.5 w-3.5 shrink-0" />}
              <span>Organized by{' '}
                {orgId
                  ? <Link href={`/organizations/${orgId}/public`} className="font-medium hover:text-foreground transition-colors">{event.organizationName}</Link>
                  : <span className="font-medium">{event.organizationName}</span>}
              </span>
            </div>
          )}
        </div>
      </Layout>
    );
  }

  if (countdown.expired) {
    const orgId = (event as any).orgId;
    const orgLogoUrl = (event as any).organizationLogoUrl;
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl animate-in fade-in duration-700">
          <AlertCircle className="h-14 w-14 text-muted-foreground/40 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">Registration Closed</h1>
          <p className="text-xl text-muted-foreground font-light mb-8">Registration for this event has ended.</p>
          {event.organizationName && (
            <div className="flex flex-col items-center gap-3">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground/70 border border-border/50 rounded-full px-4 py-1.5">
                {orgLogoUrl
                  ? <img src={orgLogoUrl} alt={event.organizationName} className="w-4 h-4 rounded-full object-cover shrink-0" />
                  : <Building2 className="h-3.5 w-3.5 shrink-0" />}
                <span>Organized by{' '}
                  {orgId
                    ? <Link href={`/organizations/${orgId}/public`} className="font-medium hover:text-foreground transition-colors">{event.organizationName}</Link>
                    : <span className="font-medium">{event.organizationName}</span>}
                </span>
              </div>
              {orgId && (
                <Link href={`/organizations/${orgId}/public`} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors inline-flex items-center gap-1">
                  See more from this organizer <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // ── Success: digital ticket ────────────────────────────────────────────────

  if (isSuccess) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-24 max-w-2xl animate-in zoom-in-95 fade-in duration-700">
          <div className="text-center mb-12">
            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h1 className="text-5xl font-serif font-bold mb-4 tracking-tight">You're In</h1>
            <p className="text-xl text-muted-foreground font-light leading-relaxed">
              Confirmation sent to <strong className="text-foreground">{formData.email}</strong>. Present this ticket at the door.
            </p>
          </div>

          {/* Ticket */}
          <div className="border border-border/70 rounded-sm overflow-hidden shadow-2xl bg-card">
            {/* Header */}
            <div className="bg-foreground text-background px-8 py-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-5">
                <Ticket className="absolute -right-4 -top-4 w-40 h-40 rotate-12" />
              </div>
              <p className="text-background/50 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" /> Official Ticket ·{' '}
                {(event as any).orgId ? (
                  <Link href={`/organizations/${(event as any).orgId}/public`} className="hover:text-background/90 transition-colors inline-flex items-center gap-1.5">
                    {(event as any).organizationLogoUrl && (
                      <img src={(event as any).organizationLogoUrl} alt={event.organizationName || ''} className="w-4 h-4 rounded object-cover border border-background/20 inline-block shrink-0" />
                    )}
                    {event.organizationName || 'Evenum'}<ExternalLink className="w-2.5 h-2.5 opacity-50" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    {(event as any).organizationLogoUrl && (
                      <img src={(event as any).organizationLogoUrl} alt={event.organizationName || ''} className="w-4 h-4 rounded object-cover border border-background/20 inline-block shrink-0" />
                    )}
                    {event.organizationName || 'Evenum'}
                  </span>
                )}
              </p>
              <h2 className="text-background text-3xl font-serif font-bold leading-tight relative z-10">{event.title}</h2>
            </div>

            {/* Tear line */}
            <div className="relative flex items-center bg-muted/20">
              <div className="absolute -left-3.5 w-7 h-7 rounded-full bg-background border border-border/60" />
              <div className="flex-1 border-t-2 border-dashed border-border/40 mx-4" />
              <div className="absolute -right-3.5 w-7 h-7 rounded-full bg-background border border-border/60" />
            </div>

            {/* Body */}
            <div className="px-8 py-8 flex flex-col sm:flex-row gap-8 items-start bg-card">
              <div className="flex-1 space-y-5 min-w-0">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Attendee</p>
                  <p className="font-serif font-bold text-xl">{formData.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Ticket Type</p>
                  <p className="font-medium text-lg text-emerald-600">{ticketTypeName}</p>
                </div>
                {event.startsAt && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Date</p>
                    <p className="font-medium">{format(new Date(event.startsAt), 'MMMM d, yyyy')}</p>
                    <p className="text-sm text-muted-foreground">{format(new Date(event.startsAt), 'h:mm a')}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Location</p>
                  <p className="font-medium">{event.isOnline ? 'Online Event' : (event.location || 'TBA')}</p>
                </div>
                <div className="pt-4 border-t border-border/50">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Entry Code</p>
                  <p className="font-mono text-xl font-bold tracking-[0.2em]">{ticketCode}</p>
                </div>
              </div>

              {/* QR Code */}
              <div className="shrink-0 flex flex-col items-center gap-3">
                <div className="p-4 bg-white rounded-sm border border-border/60 shadow-sm">
                  <QRCodeSVG value={ticketCode} size={140} level="M" includeMargin={false} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scan at door</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center">
            <Button variant="outline" className="h-12 px-8" onClick={handleAddToCalendar}>
              <CalendarDays className="mr-2 h-4 w-4" /> Add to Calendar
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Main registration page ─────────────────────────────────────────────────

  const selectedTicket = ticketTypes?.find(t => t.id === selectedTicketId);
  const selectedTicketUnavailable = Boolean(
    selectedTicket &&
      (
        (selectedTicket.quantity !== null && (selectedTicket.sold || 0) >= selectedTicket.quantity) ||
        (selectedTicket.saleStartsAt && Date.parse(selectedTicket.saleStartsAt) > countdown.now) ||
        (selectedTicket.saleEndsAt && Date.parse(selectedTicket.saleEndsAt) <= countdown.now)
      ),
  );

  return (
    <Layout>
      {/* Hero */}
      <div className="relative bg-foreground text-background overflow-hidden">
        {((event as any).heroImageUrl || event.coverImageUrl) && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${(event as any).heroImageUrl || event.coverImageUrl})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/50 to-foreground/95" />
        <div className="relative z-10 container mx-auto px-4 pt-20 pb-14 max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-500/30 font-bold uppercase tracking-widest text-xs">
              {event.isOnline ? 'Online' : 'In Person'}
            </Badge>
            <Badge className="bg-background/10 text-background/70 border-background/20 font-bold uppercase tracking-widest text-xs capitalize">
              {event.status}
            </Badge>
          </div>
          <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight leading-tight text-center mb-6">
            {event.title}
          </h1>

          <div className="flex justify-center mb-6">
            <ShareButton
              url={shareUrl}
              title={event.title}
              description={event.description || `Register for ${event.title}`}
              className="bg-transparent border-background/30 text-background hover:bg-background/10 hover:border-background/50 hover:text-background rounded-sm"
            />
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-background/70 text-sm font-medium mb-10">
            {event.startsAt && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-400" />
                {format(new Date(event.startsAt), 'MMMM d, yyyy · h:mm a')}
              </div>
            )}
            <div className="flex items-center gap-2">
              {event.isOnline ? (
                <><Video className="h-4 w-4 text-emerald-400" /> Online Event</>
              ) : (
                <><MapPin className="h-4 w-4 text-emerald-400" /> {event.location || 'Location TBA'}</>
              )}
            </div>
          </div>

          {/* Registration deadline countdown */}
          {event.endsAt && !countdown.expired && (
            <div className="text-center">
              <p className="text-background/40 text-xs font-bold uppercase tracking-widest mb-4">Registration closes in</p>
              <div className="flex items-center justify-center gap-3">
                {[
                  { value: countdown.days, label: 'Days' },
                  { value: countdown.hours, label: 'Hours' },
                  { value: countdown.minutes, label: 'Min' },
                  { value: countdown.seconds, label: 'Sec' },
                ].map(({ value, label }) => (
                  <div key={label} className="flex flex-col items-center bg-background/10 backdrop-blur-md border border-background/20 rounded-sm px-4 py-3 min-w-[60px]">
                    <span className="text-2xl font-serif font-bold tabular-nums leading-none mb-1">
                      {String(value).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-background/40">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="container mx-auto px-4 py-16 max-w-6xl" style={primaryStyle}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">

          {/* Left: Event info */}
          <div className="lg:col-span-3 space-y-14 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">

            {/* About */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-1 flex items-center gap-4">
                <span className="w-6 h-0.5 bg-emerald-600 block" />
                About this event
              </h2>
              <div className="mt-5 text-foreground/80 font-light leading-relaxed">
                {event.description ? (
                  <p className="whitespace-pre-line">{event.description}</p>
                ) : (
                  <p className="italic text-muted-foreground">No description provided.</p>
                )}
              </div>
            </section>

            {/* Venue */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-1 flex items-center gap-4">
                <span className="w-6 h-0.5 bg-emerald-600 block" />
                Venue
              </h2>
              <div className="mt-5 bg-card border border-border/60 rounded-sm p-6 flex items-start gap-4">
                {event.isOnline ? (
                  <>
                    <Video className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-lg">Online Event</p>
                      <p className="text-muted-foreground text-sm mt-1 font-light">
                        A participation link will be shared with registered attendees before the event.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <MapPin className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-lg">{event.location || 'Location TBA'}</p>
                      <p className="text-muted-foreground text-sm mt-1 font-light">Present your ticket QR code at the entrance.</p>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* FAQs */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-1 flex items-center gap-4">
                <span className="w-6 h-0.5 bg-emerald-600 block" />
                Frequently Asked
              </h2>
              <div className="mt-5 space-y-2">
                {FAQS.map((faq, i) => (
                  <div key={i} className="border border-border/60 rounded-sm overflow-hidden bg-card">
                    <button
                      className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-muted/20 transition-colors"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    >
                      <span className="font-medium">{faq.q}</span>
                      {openFaq === i
                        ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>
                    {openFaq === i && (
                      <div className="px-6 pb-5 text-muted-foreground font-light text-sm leading-relaxed border-t border-border/50">
                        <p className="pt-4">{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right: Sticky registration */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200">
              <Card className="shadow-2xl border-border rounded-sm overflow-hidden">
                <div className="h-1.5 w-full bg-emerald-600" />
                <CardHeader className="px-8 pt-8 pb-5 border-b border-border/40">
                  <div className="flex items-center gap-3 mb-1">
                    <Ticket className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="font-serif text-xl">Register</CardTitle>
                  </div>
                  <CardDescription className="font-light">Select a ticket and fill in your details.</CardDescription>
                </CardHeader>

                <CardContent className="p-8 space-y-6 bg-card">
                  {/* Ticket selection */}
                  {(!ticketTypes || ticketTypes.length === 0) ? (
                    <div className="p-4 text-center text-sm text-muted-foreground border border-dashed rounded-sm">
                      No tickets available.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select Ticket</p>
                      {ticketTypes.map(ticket => {
                        const isSoldOut = ticket.quantity !== null && (ticket.sold || 0) >= ticket.quantity;
                        const isSelected = selectedTicketId === ticket.id;

                        const saleNotStarted = ticket.saleStartsAt && Date.parse(ticket.saleStartsAt) > countdown.now;
                        const saleEnded = ticket.saleEndsAt && Date.parse(ticket.saleEndsAt) <= countdown.now;
                        const unavailable = isSoldOut || Boolean(saleNotStarted || saleEnded);

                        return (
                          <div
                            key={ticket.id}
                            onClick={() => !unavailable && setSelectedTicketId(ticket.id)}
                            className={`flex items-center justify-between px-5 py-4 rounded-sm border-2 transition-all
                              ${unavailable ? 'opacity-50 cursor-not-allowed border-border/30 bg-muted/40' :
                                isSelected ? 'border-emerald-600 bg-emerald-50/50 cursor-pointer' :
                                'border-border/60 bg-background hover:border-emerald-600/40 cursor-pointer'}`}
                          >
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="font-serif font-bold truncate">{ticket.name}</p>
                              {ticket.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{ticket.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`font-bold font-serif text-base ${isSelected ? 'text-emerald-700' : 'text-foreground'}`}>
                                {ticket.price === 0 ? 'Free' : `$${ticket.price.toFixed(2)}`}
                              </span>
                              {isSoldOut ? (
                                <Badge variant="secondary" className="text-xs">Sold Out</Badge>
                              ) : saleNotStarted ? (
                                <Badge variant="secondary" className="text-xs">Sales Not Open</Badge>
                              ) : saleEnded ? (
                                <Badge variant="secondary" className="text-xs">Sales Closed</Badge>
                              ) : (
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                                  isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-muted-foreground/30'
                                }`}>
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Form fields */}
                  <form id="reg-form" onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        required
                        placeholder="Jane Doe"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        disabled={!selectedTicketId || registerMutation.isPending}
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        placeholder="jane@example.com"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        disabled={!selectedTicketId || registerMutation.isPending}
                        className="h-12"
                      />
                    </div>
                  </form>
                </CardContent>

                <CardFooter className="flex-col pt-0 pb-8 px-8 gap-4 bg-card">
                  {/* Price summary */}
                  <div className="w-full flex items-center justify-between py-4 border-t border-border/40">
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                    <span className="text-2xl font-serif font-bold text-emerald-700">
                      {selectedTicket
                        ? selectedTicket.price === 0 ? 'Free' : `$${selectedTicket.price.toFixed(2)}`
                        : '—'}
                    </span>
                  </div>

                  <Button
                    type="submit"
                    form="reg-form"
                    className="w-full h-14 text-base font-bold shadow-lg hover:shadow-xl transition-all bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm"
                    disabled={!selectedTicketId || selectedTicketUnavailable || !formData.name || !formData.email || countdown.expired || registerMutation.isPending}
                  >
                    {registerMutation.isPending ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : null}
                    Complete Registration
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <p className="text-[11px] text-center text-muted-foreground flex items-center gap-1.5 justify-center">
                    <ShieldCheck className="h-3.5 w-3.5 opacity-50" />
                    Your details are handled securely
                  </p>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
