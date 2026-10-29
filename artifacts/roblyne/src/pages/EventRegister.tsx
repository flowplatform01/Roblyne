import React, { useEffect, useState } from 'react';
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useGetEvent, useListTicketTypes, useRegisterForEvent } from "@workspace/api-client-react";
import type { Event as EventResource, TicketType } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CalendarDays, MapPin, Clock, AlertCircle, CheckCircle2, Ticket, ShieldCheck, ArrowRight, Video, ChevronDown, ChevronUp, Building2, ExternalLink, Bookmark, Download, Printer } from "lucide-react";
import { ShareButton } from "@/components/branding/ShareButton";
import { PublicHeroBackdrop } from "@/components/branding/PublicHeroBackdrop";
import { useOrgBranding } from "@/lib/branding";
import { QRCodeSVG } from "qrcode.react";
import { useCountdown } from "@/hooks/useLifecycle";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@/lib/currency";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { ParticipationLoadingSkeleton } from "@/components/loading/LoadingStates";
import { openFlowPayCheckout } from "@/lib/flowpay-checkout";
import { apiUrl } from "@/lib/api-url";

type SavedEventTicket = {
  eventId: number;
  ticketCode: string;
  attendeeName: string;
  ticketTypeName: string;
};

const eventTicketStorageKey = (eventId: number) => `evenum:event-ticket:${eventId}`;

function generateICS(event: any): string {
  const start = event.startsAt ? new Date(event.startsAt) : new Date();
  const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + 3600000);

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ROBLYNE//EN',
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

async function renderSvgAsPngDataUrl(svg: SVGSVGElement): Promise<string> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", "420");
  copy.setAttribute("height", "420");

  const imageUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render the ticket QR code."));
      image.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 420;
    canvas.height = 420;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the ticket QR code.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const match = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return match
    ? [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)]
    : [217, 119, 6];
}

function safeFilePart(value: string): string {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "event";
}

export default function EventRegister() {
  const [, params] = useRoute("/events/:id/register");
  const eventId = params?.id ? parseInt(params.id, 10) : 0;
  const inviteFromLink = new URLSearchParams(window.location.search).get('invite')?.trim().toUpperCase() || '';
  const hasInviteLink = inviteFromLink.length > 0;

  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [isSuccess, setIsSuccess] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [paymentStatusToken, setPaymentStatusToken] = useState<string | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [ticketCode, setTicketCode] = useState('');
  const [ticketTypeName, setTicketTypeName] = useState('');
  const [savedTicket, setSavedTicket] = useState<SavedEventTicket | null>(null);
  const [ticketStorageError, setTicketStorageError] = useState(false);
  const [isDownloadingTicket, setIsDownloadingTicket] = useState(false);
  const [ticketDownloadError, setTicketDownloadError] = useState(false);
  const [ticketPdfDownloaded, setTicketPdfDownloaded] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const standardEvent = useGetEvent(eventId, { query: { enabled: !hasInviteLink } });
  const standardTicketTypes = useListTicketTypes(eventId, { query: { enabled: !hasInviteLink } });
  const inviteResources = useQuery({
    queryKey: ['invite-event', eventId, inviteFromLink],
    enabled: hasInviteLink && Number.isInteger(eventId) && eventId > 0,
    retry: false,
    queryFn: async (): Promise<[EventResource, TicketType[]]> => {
      const suffix = `?invite=${encodeURIComponent(inviteFromLink)}`;
      const responses = await Promise.all([
        fetch(apiUrl(`/api/events/${eventId}${suffix}`), { credentials: 'include' }),
        fetch(apiUrl(`/api/events/${eventId}/ticket-types${suffix}`), { credentials: 'include' }),
      ]);
      if (responses.some(response => !response.ok)) throw new Error('This invite link is invalid or no longer available.');
      const [eventData, ticketTypesData] = await Promise.all(responses.map(response => response.json()));
      return [eventData as EventResource, ticketTypesData as TicketType[]];
    },
  });
  const [inviteEvent, inviteTicketTypes] = inviteResources.data ?? [];
  const event = hasInviteLink ? inviteEvent : standardEvent.data;
  const brandingStyle = useOrgBranding(event);
  const ticketTypes = hasInviteLink ? inviteTicketTypes : standardTicketTypes.data;
  const isEventLoading = hasInviteLink ? inviteResources.isLoading : standardEvent.isLoading;
  const isTicketTypesLoading = hasInviteLink ? inviteResources.isLoading : standardTicketTypes.isLoading;
  const registerMutation = useRegisterForEvent();
  const { data: paymentStatus } = usePaymentStatus(paymentId, paymentStatusToken);
  const countdown = useCountdown(event?.endsAt);
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("fr") ? "fr-FR" : "en-US";

  useEffect(() => {
    setSelectedTicketId(null);
    setFormData({ name: "", email: "", phone: "" });
    setIsSuccess(false);
    setPaymentId(null);
    setPaymentStatusToken(null);
    setPaymentPending(false);
    setCheckoutUrl(null);
    setTicketCode("");
    setTicketTypeName("");
    setTicketStorageError(false);
    setIsDownloadingTicket(false);
    setTicketDownloadError(false);
    setTicketPdfDownloaded(false);
    setSavedTicket(null);

    if (!Number.isInteger(eventId) || eventId <= 0) {
      setSavedTicket(null);
      return;
    }

    try {
      const storedTicket = window.localStorage.getItem(eventTicketStorageKey(eventId));
      if (!storedTicket) {
        setSavedTicket(null);
        return;
      }

      const parsed = JSON.parse(storedTicket) as Partial<SavedEventTicket>;
      if (
        typeof parsed.ticketCode === "string"
        && parsed.ticketCode.trim().length >= 6
        && parsed.ticketCode.trim().length <= 128
        && typeof parsed.attendeeName === "string"
        && parsed.attendeeName.trim().length > 0
        && parsed.attendeeName.length <= 200
        && typeof parsed.ticketTypeName === "string"
        && parsed.ticketTypeName.trim().length > 0
        && parsed.ticketTypeName.length <= 100
      ) {
        setSavedTicket({
          eventId,
          ticketCode: parsed.ticketCode.trim(),
          attendeeName: parsed.attendeeName.trim(),
          ticketTypeName: parsed.ticketTypeName.trim(),
        });
      } else {
        setSavedTicket(null);
      }
    } catch {
      setSavedTicket(null);
    }
  }, [eventId]);

  useEffect(() => {
    if (!savedTicket || savedTicket.eventId !== eventId || !event || (event.status === "published" && !countdown.expired)) return;
    setTicketCode(savedTicket.ticketCode);
    setTicketTypeName(savedTicket.ticketTypeName);
    setFormData(current => ({ ...current, name: savedTicket.attendeeName }));
    setIsSuccess(true);
  }, [savedTicket, eventId, event, countdown.expired]);

  useEffect(() => {
    if (!paymentStatus || paymentId === null) return;
    if (paymentStatus.status === "succeeded" && paymentStatus.result) {
      const result = paymentStatus.result as any;
      setTicketCode(result.ticketCode || "");
      setTicketTypeName(result.ticketTypeName || "General Admission");
      setPaymentPending(false);
      setPaymentId(null);
      setPaymentStatusToken(null);
      setCheckoutUrl(null);
      setIsSuccess(true);
    } else if (paymentStatus.status === "failed") {
      setPaymentPending(false);
      setPaymentId(null);
      setPaymentStatusToken(null);
      setCheckoutUrl(null);
    }
  }, [paymentStatus, paymentId]);

  const shareUrl = `${window.location.origin}/events/${eventId}/register`;

  usePageMeta(event ? {
    title: event.title,
    description: event.description || `Register for ${event.title} — secure your spot on ROBLYNE.`,
    image: (event as any).heroImageUrl || event.coverImageUrl || null,
    url: shareUrl,
  } : null);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketId || !formData.name || !formData.email) return;
    setRegistrationError(null);

    const selectedTicket = ticketTypes?.find(t => t.id === selectedTicketId);
    const now = countdown.now;
    if (countdown.expired) return;
    if (selectedTicket?.saleStartsAt && Date.parse(selectedTicket.saleStartsAt) > now) return;
    if (selectedTicket?.saleEndsAt && Date.parse(selectedTicket.saleEndsAt) <= now) return;
    if (selectedTicket && selectedTicket.price > 0 && !formData.phone.trim()) return;

    registerMutation.mutate(
      {
        eventId,
        data: {
          ticketTypeId: selectedTicketId,
          attendeeName: formData.name,
          attendeeEmail: formData.email,
           customerPhone: formData.phone || undefined,
          inviteCode: event?.visibility === 'invite_only' ? inviteFromLink : undefined,
          quantity: 1,
        },
      },
      {
        onSuccess: (result) => {
          if ("paymentRequired" in result) {
            if (!result.checkoutUrl) {
              setRegistrationError(t("eventRegister.paymentCheckoutUnavailable"));
              registerMutation.reset();
              return;
            }
            setPaymentId(result.paymentId);
            setPaymentStatusToken(result.statusToken);
            setPaymentPending(true);
            setCheckoutUrl(result.checkoutUrl);
            openFlowPayCheckout({
              checkoutUrl: result.checkoutUrl,
              paymentId: result.paymentId,
              statusToken: result.statusToken,
              title: t("eventRegister.completePayment", "Event Registration — Complete Payment"),
              onCompleted: (res) => {
                setRegistrationError(null);
                setPaymentPending(false);
                setIsSuccess(true);
                if (res?.ticketCode) {
                  setTicketCode(res.ticketCode);
                }
                if (res?.ticketTypeName) {
                  setTicketTypeName(res.ticketTypeName);
                }
              },
              onFailed: (err) => {
                setPaymentPending(false);
                setRegistrationError(err?.errorMessage || "Payment was not completed. Please try again.");
              },
              onClosed: () => {
                setPaymentPending(false);
              },
            });
            return;
          }
          setRegistrationError(null);
          setIsSuccess(true);
          setTicketCode(result.ticketCode);
          setTicketTypeName(selectedTicket?.name || 'General Admission');
        },
        onError: (error: any) => {
          setPaymentPending(false);
          setRegistrationError(error?.data?.error || `${t("eventRegister.registrationFailed")}. ${t("eventRegister.registrationError")}`);
        },
      }
    );
  };

  const saveTicketOnDevice = () => {
    const attendeeName = formData.name.trim();
    if (!ticketCode || !attendeeName) {
      setTicketStorageError(true);
      return;
    }

    const ticket: SavedEventTicket = {
      eventId,
      ticketCode,
      attendeeName,
      ticketTypeName: ticketTypeName || "General Admission",
    };
    try {
      window.localStorage.setItem(eventTicketStorageKey(eventId), JSON.stringify({
        ticketCode: ticket.ticketCode,
        attendeeName: ticket.attendeeName,
        ticketTypeName: ticket.ticketTypeName,
      }));
      setSavedTicket(ticket);
      setTicketStorageError(false);
    } catch {
      setTicketStorageError(true);
    }
  };

  const openSavedTicket = () => {
    if (!savedTicket || savedTicket.eventId !== eventId) return;
    setFormData({ name: savedTicket.attendeeName, email: "", phone: "" });
    setTicketCode(savedTicket.ticketCode);
    setTicketTypeName(savedTicket.ticketTypeName);
    setTicketStorageError(false);
    setIsSuccess(true);
  };

  const removeSavedTicket = () => {
    try {
      window.localStorage.removeItem(eventTicketStorageKey(eventId));
      setSavedTicket(null);
      setTicketStorageError(false);
    } catch {
      setTicketStorageError(true);
    }
  };

  const downloadTicketPdf = async () => {
    const ticketElement = document.querySelector<HTMLElement>("[data-event-ticket-print]");
    const qrSvg = ticketElement?.querySelector<SVGSVGElement>("[data-ticket-qr] svg");
    if (!event || !ticketCode || !formData.name.trim() || !qrSvg) {
      setTicketDownloadError(true);
      return;
    }

    setIsDownloadingTicket(true);
    setTicketDownloadError(false);
    setTicketPdfDownloaded(false);
    try {
      const [{ jsPDF }, qrImage] = await Promise.all([
        import("jspdf"),
        renderSvgAsPngDataUrl(qrSvg),
      ]);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const accent = hexToRgb((event as any).accentColor || "");

      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), "F");
      pdf.setFillColor(10, 22, 40);
      pdf.rect(0, 0, pageWidth, 44, "F");
      pdf.setFillColor(...accent);
      pdf.rect(0, 0, pageWidth, 3, "F");

      pdf.setTextColor(220, 227, 238);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(`${t("eventRegister.officialTicket").toLocaleUpperCase(locale)} · ${event.organizationName || "ROBLYNE"}`, 14, 13);

      const title = String(event.title || "Event");
      let titleSize = 23;
      pdf.setFont("times", "bold");
      pdf.setFontSize(titleSize);
      let titleLines = pdf.splitTextToSize(title, pageWidth - 28) as string[];
      while (titleLines.length > 2 && titleSize > 15) {
        titleSize -= 1;
        pdf.setFontSize(titleSize);
        titleLines = pdf.splitTextToSize(title, pageWidth - 28) as string[];
      }
      if (titleLines.length > 2) {
        titleLines = [...titleLines.slice(0, 2)];
        titleLines[1] = `${titleLines[1].replace(/[.…]+$/g, "")}…`;
      }
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(titleSize);
      pdf.text(titleLines, 14, 30);

      pdf.setDrawColor(224, 228, 234);
      pdf.line(14, 49, pageWidth - 14, 49);

      const drawDetail = (label: string, value: string, x: number, y: number, width: number) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(116, 125, 138);
        pdf.text(label.toLocaleUpperCase(locale), x, y);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        pdf.setTextColor(27, 35, 48);
        const lines = pdf.splitTextToSize(value || "—", width) as string[];
        pdf.text(lines.slice(0, 2), x, y + 7);
      };

      drawDetail(t("eventRegister.attendee"), formData.name, 14, 61, 120);
      drawDetail(t("eventRegister.ticketType"), ticketTypeName || "General Admission", 14, 84, 120);
      const dateText = event.startsAt
        ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(event.startsAt))
        : "—";
      const locationText = event.isOnline
        ? t("eventRegister.onlineEvent")
        : (event.location || t("eventRegister.locationTba"));
      drawDetail(t("eventRegister.date"), dateText, 14, 107, 58);
      drawDetail(t("eventRegister.location"), locationText, 82, 107, 58);

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(224, 228, 234);
      pdf.roundedRect(153, 57, 45, 45, 2, 2, "FD");
      pdf.addImage(qrImage, "PNG", 155, 59, 41, 41);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(116, 125, 138);
      pdf.text(t("eventRegister.scanAtDoor").toLocaleUpperCase(locale), 175.5, 109, { align: "center" });

      pdf.setDrawColor(224, 228, 234);
      pdf.line(14, 129, pageWidth - 14, 129);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(116, 125, 138);
      pdf.text(t("eventRegister.entryCode").toLocaleUpperCase(locale), 14, 136);
      pdf.setFont("courier", "bold");
      let codeSize = 15;
      pdf.setFontSize(codeSize);
      while (pdf.getTextWidth(ticketCode) > 132 && codeSize > 8) {
        codeSize -= 1;
        pdf.setFontSize(codeSize);
      }
      pdf.setTextColor(27, 35, 48);
      pdf.text(ticketCode, 14, 144);

      const fileName = `${safeFilePart(event.title || "event")}-ticket-${safeFilePart(ticketCode)}.pdf`;
      await pdf.save(fileName);
      setTicketPdfDownloaded(true);
    } catch (error) {
      console.error("Ticket PDF download failed", error);
      setTicketDownloadError(true);
    } finally {
      setIsDownloadingTicket(false);
    }
  };

  const isTicketSaved = savedTicket?.eventId === eventId && savedTicket.ticketCode === ticketCode;

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
        <ParticipationLoadingSkeleton label={t("eventRegister.loadingRegistration")} />
      </Layout>
    );
  }

  if (!event) {
    return (
      <Layout>
        <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-12">
          <div className="w-full rounded-lg border bg-card p-8 text-center shadow-sm">
            <Ticket className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h1 className="text-2xl font-semibold">This registration page needs access</h1>
            <p className="mt-3 text-sm text-muted-foreground">Use the complete link provided by the organizer. Private events remain visible only to their organization.</p>
            <form className="mt-6 flex gap-2" onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              const form = new FormData(submitEvent.currentTarget);
              const code = String(form.get('invite') || '').trim().toUpperCase();
              if (code) window.location.assign(`/events/${eventId}/register?invite=${encodeURIComponent(code)}`);
            }}>
              <Input name="invite" aria-label="Invite code" placeholder="Invite code" className="font-mono" autoComplete="off" />
              <Button type="submit">Continue</Button>
            </form>
            <Button asChild variant="link" className="mt-4"><Link href="/events">Browse public events</Link></Button>
          </div>
        </main>
      </Layout>
    );
  }

  const lightHero = (event as any).theme === "light" && !(event as any).heroImageUrl && !event.coverImageUrl;

  if (paymentPending) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl" style={brandingStyle}>
          <Loader2 className="h-12 w-12 animate-spin text-primary/60 mx-auto mb-8" />
          <h1 className="text-4xl font-serif font-bold mb-4">{t("eventRegister.paymentProcessing")}</h1>
          <p className="text-lg text-muted-foreground font-light">
            {t("eventRegister.paymentProcessingDescription")}
          </p>
          {checkoutUrl && (
            <Button asChild variant="outline" className="mt-6">
              <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">{t("eventRegister.openPaymentCheckout")}</a>
            </Button>
          )}
        </div>
      </Layout>
    );
  }

  if (!isSuccess && event.status !== 'published') {
    const orgId = (event as any).orgId;
    const orgLogoUrl = (event as any).organizationLogoUrl;
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl animate-in fade-in duration-700">
          <AlertCircle className="h-14 w-14 text-muted-foreground/40 mx-auto mb-8" />
          <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-2">{t("eventRegister.registrationUnavailable")}</p>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-4 break-words">{event.title}</h1>
          <p className="text-xl text-muted-foreground font-light mb-8">{t("eventRegister.registrationUnavailableDescription")}</p>
          {event.organizationName && (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground/70 border border-border/50 rounded-full px-4 py-1.5">
              {orgLogoUrl
                ? <img src={orgLogoUrl} alt={event.organizationName} className="w-4 h-4 rounded-full object-cover shrink-0" />
                : <Building2 className="h-3.5 w-3.5 shrink-0" />}
              <span>{t("eventRegister.organizedBy")}{' '}
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

  if (!isSuccess && countdown.expired) {
    const orgId = (event as any).orgId;
    const orgLogoUrl = (event as any).organizationLogoUrl;
    return (
      <Layout>
        <div className="container mx-auto px-4 py-32 text-center max-w-xl animate-in fade-in duration-700">
          <AlertCircle className="h-14 w-14 text-muted-foreground/40 mx-auto mb-8" />
          <p className="text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-2">{t("eventRegister.registrationClosed")}</p>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold mb-4 break-words">{event.title}</h1>
          <p className="text-xl text-muted-foreground font-light mb-8">{t("eventRegister.registrationClosedDescription")}</p>
          {event.organizationName && (
            <div className="flex flex-col items-center gap-3">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground/70 border border-border/50 rounded-full px-4 py-1.5">
                {orgLogoUrl
                  ? <img src={orgLogoUrl} alt={event.organizationName} className="w-4 h-4 rounded-full object-cover shrink-0" />
                  : <Building2 className="h-3.5 w-3.5 shrink-0" />}
                <span>{t("eventRegister.organizedBy")}{' '}
                  {orgId
                    ? <Link href={`/organizations/${orgId}/public`} className="font-medium hover:text-foreground transition-colors">{event.organizationName}</Link>
                    : <span className="font-medium">{event.organizationName}</span>}
                </span>
              </div>
              {orgId && (
                <Link href={`/organizations/${orgId}/public`} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors inline-flex items-center gap-1">
                  {t("eventRegister.seeMoreFromOrganizer")} <ArrowRight className="h-3 w-3" />
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
        <style>{`
          @media print {
            @page { margin: 14mm; }
            body * { visibility: hidden !important; }
            [data-event-ticket-print], [data-event-ticket-print] * { visibility: visible !important; }
            [data-event-ticket-print] {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
              box-shadow: none !important;
              animation: none !important;
              transform: none !important;
              background: #fff !important;
              color: #111 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            [data-event-ticket-print] .bg-card { background: #fff !important; }
          }
        `}</style>
        <div className="container mx-auto px-4 py-24 max-w-2xl animate-in zoom-in-95 fade-in duration-700" style={brandingStyle}>
          <div className="text-center mb-12">
            <div className="w-24 h-24 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h1 className="text-5xl font-serif font-bold mb-4 tracking-tight">{t("eventRegister.youAreRegistered")}</h1>
            <p className="text-xl text-muted-foreground font-light leading-relaxed">
              {t("eventRegister.registrationConfirmed")}
            </p>
          </div>

          {/* Ticket */}
          <div data-event-ticket-print data-testid="event-ticket" className="border border-border/70 rounded-sm overflow-hidden shadow-2xl bg-card">
            <div className="h-1.5 w-full bg-primary" />
            {/* Header */}
            <div className="bg-[#0A1628] text-white px-8 py-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-5">
                <Ticket className="absolute -right-4 -top-4 w-40 h-40 rotate-12" />
              </div>
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" /> {t("eventRegister.officialTicket")} ·{' '}
                {(event as any).orgId ? (
                  <Link href={`/organizations/${(event as any).orgId}/public`} className="hover:text-white/90 transition-colors inline-flex items-center gap-1.5">
                    {(event as any).organizationLogoUrl && (
                      <img src={(event as any).organizationLogoUrl} alt={event.organizationName || ''} className="w-4 h-4 rounded object-cover border border-white/20 inline-block shrink-0" />
                    )}
                    {event.organizationName || 'ROBLYNE'}<ExternalLink className="w-2.5 h-2.5 opacity-50" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    {(event as any).organizationLogoUrl && (
                      <img src={(event as any).organizationLogoUrl} alt={event.organizationName || ''} className="w-4 h-4 rounded object-cover border border-white/20 inline-block shrink-0" />
                    )}
                    {event.organizationName || 'ROBLYNE'}
                  </span>
                )}
              </p>
              <h2 className="text-white text-3xl font-serif font-bold leading-tight relative z-10">{event.title}</h2>
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
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">{t("eventRegister.attendee")}</p>
                  <p className="font-serif font-bold text-xl">{formData.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">{t("eventRegister.ticketType")}</p>
                  <p className="font-medium text-lg text-primary">{ticketTypeName}</p>
                </div>
                {event.startsAt && (
                  <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">{t("eventRegister.date")}</p>
                    <p className="font-medium">{new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(event.startsAt))}</p>
                    <p className="text-sm text-muted-foreground">{new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(event.startsAt))}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">{t("eventRegister.location")}</p>
                  <p className="font-medium">{event.isOnline ? t("eventRegister.onlineEvent") : (event.location || t("eventRegister.locationTba"))}</p>
                </div>
                <div className="pt-4 border-t border-border/50">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">{t("eventRegister.entryCode")}</p>
                  <p className="font-mono text-xl font-bold tracking-[0.2em]">{ticketCode}</p>
                </div>
              </div>

              {/* QR Code */}
              <div className="shrink-0 flex flex-col items-center gap-3">
                <div data-ticket-qr className="p-4 bg-white rounded-sm border border-border/60 shadow-sm">
                  <QRCodeSVG value={ticketCode} size={140} level="M" includeMargin={false} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("eventRegister.scanAtDoor")}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 max-w-xl mx-auto" data-event-ticket-actions>
            <Button variant="default" className="h-12 w-full justify-center px-4" onClick={downloadTicketPdf} disabled={isDownloadingTicket} data-testid="download-event-ticket">
              {isDownloadingTicket ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {t("eventRegister.downloadTicketPdf")}
            </Button>
            <Button variant="outline" className="h-12 w-full justify-center px-4" onClick={() => window.print()} data-testid="print-event-ticket">
              <Printer className="mr-2 h-4 w-4" /> {t("eventRegister.printTicket")}
            </Button>
            <Button variant="outline" className="h-12 w-full justify-center px-4" onClick={handleAddToCalendar}>
              <CalendarDays className="mr-2 h-4 w-4" /> {t("eventRegister.addToCalendar")}
            </Button>
            <Button variant="outline" className="h-12 w-full justify-center px-4" onClick={saveTicketOnDevice} data-testid="save-event-ticket">
              {isTicketSaved ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
              {t(isTicketSaved ? "eventRegister.ticketSavedOnDevice" : "eventRegister.saveTicketOnDevice")}
            </Button>
          </div>
          {ticketDownloadError && (
            <p role="alert" className="mt-4 text-center text-sm text-destructive">
              {t("eventRegister.ticketDownloadError")}
            </p>
          )}
          {ticketPdfDownloaded && !ticketDownloadError && (
            <p role="status" className="mt-4 text-center text-sm text-primary">
              {t("eventRegister.ticketPdfDownloaded")}
            </p>
          )}
          <p role={ticketStorageError ? "alert" : "status"} className="mt-4 text-center text-sm text-muted-foreground">
            {ticketStorageError
              ? t("eventRegister.ticketStorageError")
              : isTicketSaved
                ? t("eventRegister.ticketSavedHint")
                : t("eventRegister.ticketSaveHint")}
          </p>
          {isTicketSaved && (
            <div className="mt-2 text-center">
              <Button variant="ghost" size="sm" onClick={removeSavedTicket} data-testid="remove-saved-event-ticket">
                {t("eventRegister.removeSavedTicket")}
              </Button>
            </div>
          )}
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
      <div className="w-full bg-background text-foreground" style={brandingStyle}>
      {/* Hero */}
      <div className={`relative overflow-hidden ${lightHero ? "bg-background text-foreground" : "bg-[#0A1628] text-white"}`}>
        <PublicHeroBackdrop
          imageUrl={(event as any).heroImageUrl || event.coverImageUrl}
          lightFallback={lightHero}
        />
        <div className="relative z-10 container mx-auto px-4 pt-20 pb-14 max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <Badge className="bg-primary/20 text-white border-primary/40 font-bold uppercase tracking-widest text-xs">
              {event.isOnline ? t("eventRegister.online") : t("eventRegister.inPerson")}
            </Badge>
            <Badge className="bg-white/10 text-white/70 border-white/20 font-bold uppercase tracking-widest text-xs capitalize">
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
              className={lightHero
                ? "bg-transparent border-border text-foreground hover:bg-muted rounded-sm"
                : "bg-transparent border-white/30 text-white hover:bg-white/10 hover:border-white/50 hover:text-white rounded-sm"}
            />
          </div>

          <div className={`flex flex-wrap justify-center gap-6 text-sm font-medium mb-10 ${lightHero ? "text-muted-foreground" : "text-white/70"}`}>
            {event.startsAt && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.startsAt))}
              </div>
            )}
            <div className="flex items-center gap-2">
              {event.isOnline ? (
                <><Video className="h-4 w-4 text-primary" /> {t("eventRegister.onlineEvent")}</>
              ) : (
                <><MapPin className="h-4 w-4 text-primary" /> {event.location || t("eventRegister.locationTba")}</>
              )}
            </div>
          </div>

          {/* Registration deadline countdown */}
          {event.endsAt && !countdown.expired && (
            <div className="text-center">
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">{t("eventRegister.registrationClosesIn")}</p>
              <div className="flex items-center justify-center gap-3">
                {[
                  { value: countdown.days, label: t("eventRegister.days") },
                  { value: countdown.hours, label: t("eventRegister.hours") },
                  { value: countdown.minutes, label: t("eventRegister.minutes") },
                  { value: countdown.seconds, label: t("eventRegister.seconds") },
                ].map(({ value, label }) => (
                    <div key={label} className={`flex flex-col items-center backdrop-blur-md border rounded-sm px-4 py-3 min-w-[60px] ${lightHero ? "bg-background/80 border-border" : "bg-white/10 border-white/20"}`}>
                    <span className="text-2xl font-serif font-bold tabular-nums leading-none mb-1">
                      {String(value).padStart(2, '0')}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${lightHero ? "text-muted-foreground" : "text-white/40"}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">

          {/* Left: Event info */}
          <div className="lg:col-span-3 space-y-14 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">

            {/* About */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-1 flex items-center gap-4">
                <span className="w-6 h-0.5 bg-primary block" />
                {t("eventRegister.aboutEvent")}
              </h2>
              <div className="mt-5 text-foreground/80 font-light leading-relaxed">
                {event.description ? (
                  <p className="whitespace-pre-line">{event.description}</p>
                ) : (
                  <p className="italic text-muted-foreground">{t("eventRegister.noEventDescription")}</p>
                )}
              </div>
            </section>

            {/* Venue */}
            <section>
              <h2 className="text-2xl font-serif font-bold mb-1 flex items-center gap-4">
                <span className="w-6 h-0.5 bg-primary block" />
                {t("eventRegister.venue")}
              </h2>
              <div className="mt-5 bg-card border border-border/60 rounded-sm p-6 flex items-start gap-4">
                {event.isOnline ? (
                  <>
                    <Video className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-lg">{t("eventRegister.onlineEvent")}</p>
                      <p className="text-muted-foreground text-sm mt-1 font-light">
                        {t("eventRegister.onlineEventDetails")}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <MapPin className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-lg">{event.location || t("eventRegister.locationTba")}</p>
                      <p className="text-muted-foreground text-sm mt-1 font-light">{t("eventRegister.entryInstructions")}</p>
                    </div>
                  </>
                )}
              </div>
            </section>

          </div>

          {/* Right: Sticky registration */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 animate-in fade-in slide-in-from-bottom-12 duration-700 delay-200">
              <Card className="shadow-2xl border-border rounded-sm overflow-hidden">
                <div className="h-1.5 w-full bg-primary" />
                <CardHeader className="px-8 pt-8 pb-5 border-b border-border/40">
                    <div className="flex items-center gap-3 mb-1">
                    <Ticket className="h-5 w-5 text-primary" />
                    <CardTitle className="font-serif text-xl">{t("eventRegister.registration")}</CardTitle>
                  </div>
                  <CardDescription className="font-light">{t("eventRegister.enterDetails")}</CardDescription>
                </CardHeader>

                <CardContent className="p-8 space-y-6 bg-card">
                  {savedTicket && (
                    <div className="rounded-sm border border-primary/20 bg-primary/5 p-4 space-y-3" role="status" data-testid="saved-event-ticket">
                      <p className="text-sm font-medium">{t("eventRegister.savedTicketAvailable")}</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button variant="outline" size="sm" onClick={openSavedTicket} data-testid="view-saved-event-ticket">
                          {t("eventRegister.viewSavedTicket")}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={removeSavedTicket} data-testid="remove-saved-event-ticket">
                          {t("eventRegister.removeSavedTicket")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {/* Ticket selection */}
                  {(!ticketTypes || ticketTypes.length === 0) ? (
                    <div className="p-4 text-center text-sm text-muted-foreground border border-dashed rounded-sm">
                      {t("eventRegister.noTicketsAvailable")}
                    </div>
                  ) : (
                    <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("eventRegister.selectTicket")}</p>
                      {ticketTypes.map(ticket => {
                        const isSoldOut = ticket.quantity !== null && (ticket.sold || 0) >= ticket.quantity;
                        const isSelected = selectedTicketId === ticket.id;

                        const saleNotStarted = ticket.saleStartsAt && Date.parse(ticket.saleStartsAt) > countdown.now;
                        const saleEnded = ticket.saleEndsAt && Date.parse(ticket.saleEndsAt) <= countdown.now;
                        const unavailable = isSoldOut || Boolean(saleNotStarted || saleEnded);

                        return (
                          <button
                            key={ticket.id}
                            type="button"
                            disabled={Boolean(unavailable)}
                            aria-pressed={isSelected}
                            onClick={() => !unavailable && setSelectedTicketId(ticket.id)}
                            className={`w-full text-left flex items-center justify-between px-5 py-4 rounded-sm border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                              ${unavailable ? 'opacity-50 cursor-not-allowed border-border/30 bg-muted/40' :
                                isSelected ? 'border-primary bg-primary/5 cursor-pointer' :
                                'border-border/60 bg-background hover:border-primary/40 cursor-pointer'}`}
                          >
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="font-serif font-bold truncate">{ticket.name}</p>
                              {ticket.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{ticket.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`font-bold font-serif text-base ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                {ticket.price === 0 ? t("eventRegister.free") : formatCurrency(ticket.price, ticket.currency || (event as any).currency || "XAF", locale)}
                              </span>
                              {isSoldOut ? (
                                <Badge variant="secondary" className="text-xs">{t("eventRegister.soldOut")}</Badge>
                              ) : saleNotStarted ? (
                                <Badge variant="secondary" className="text-xs">{t("eventRegister.salesNotOpen")}</Badge>
                              ) : saleEnded ? (
                                <Badge variant="secondary" className="text-xs">{t("eventRegister.salesClosed")}</Badge>
                              ) : (
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                                  isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                                }`}>
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Form fields */}
                  {registrationError && (
                    <div
                      role="alert"
                      data-testid="event-registration-error"
                      className="rounded-sm border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                    >
                      {registrationError}
                    </div>
                  )}
                  <form id="reg-form" onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {t("eventRegister.fullName")}
                      </Label>
                      <Input
                        id="name"
                        required
                        placeholder={t("eventRegister.namePlaceholder")}
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        disabled={!selectedTicketId || registerMutation.isPending}
                        className="h-12"
                      />
                    </div>
                    {selectedTicket && selectedTicket.price > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          {t("eventRegister.phoneNumber")}
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          required
                          placeholder={t("eventRegister.phonePlaceholder")}
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                          disabled={!selectedTicketId || registerMutation.isPending}
                          className="h-12"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {t("eventRegister.emailAddress")}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        placeholder={t("eventRegister.emailPlaceholder")}
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
                    <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{t("eventRegister.total")}</span>
                    <span className="text-2xl font-serif font-bold text-primary">
                      {selectedTicket
                        ? selectedTicket.price === 0 ? t("eventRegister.free") : formatCurrency(selectedTicket.price, selectedTicket.currency || (event as any).currency || "XAF", locale)
                        : '—'}
                    </span>
                  </div>

                  <Button
                    type="submit"
                    form="reg-form"
                    className="w-full h-14 text-base font-bold shadow-lg hover:shadow-xl transition-colors bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm"
                     disabled={!selectedTicketId || selectedTicketUnavailable || !formData.name || !formData.email || (Boolean(selectedTicket && selectedTicket.price > 0) && !formData.phone) || countdown.expired || registerMutation.isPending}
                  >
                    {registerMutation.isPending ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : null}
                    {t("eventRegister.completeRegistration")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <p className="text-[11px] text-center text-muted-foreground flex items-center gap-1.5 justify-center">
                    <ShieldCheck className="h-3.5 w-3.5 opacity-50" />
                    {t("eventRegister.secureDetails")}
                  </p>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
        <section className="mt-14 max-w-3xl mx-auto">
          <h2 className="text-2xl font-serif font-bold mb-1 flex items-center gap-4">
            <span className="w-6 h-0.5 bg-primary block" />
            {t("eventRegister.faqTitle")}
          </h2>
          <div className="mt-5 space-y-2">
            {(t("eventRegister.faqs", { returnObjects: true }) as { q: string; a: string }[]).map((faq, i) => (
              <div key={i} className="border border-border/60 rounded-sm overflow-hidden bg-card">
                <button
                  type="button"
                  aria-expanded={openFaq === i}
                  data-testid={`event-faq-toggle-${i}`}
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
      </div>
    </Layout>
  );
}
