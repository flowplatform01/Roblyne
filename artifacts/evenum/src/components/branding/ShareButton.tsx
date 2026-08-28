import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Share2, Check, Copy, MessageCircle, Send, Link2, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export interface ShareButtonProps {
  url: string;
  title?: string;
  description?: string;
  /** Label shown next to the share icon in "button" variant. Defaults to "Share". */
  ctaLabel?: string;
  variant?: "button" | "icon";
  className?: string;
}

function buildWhatsAppUrl(url: string, title?: string): string {
  const text = title ? `${title}\n${url}` : url;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function buildTelegramUrl(url: string, title?: string): string {
  const params = new URLSearchParams({ url });
  if (title) params.set("text", title);
  return `https://t.me/share/url?${params}`;
}

interface ShareOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void | Promise<void>;
}

/**
 * ShareButton — professional, context-aware sharing for every Evenum entity.
 *
 * - On mobile with native share available: triggers the OS share sheet
 * - Otherwise: shows a compact popover with WhatsApp, Telegram, and Copy URL
 * - Consistent across all pillars (elections, events, campaigns, candidates, orgs)
 */
export function ShareButton({
  url,
  title,
  description,
  ctaLabel,
  variant = "button",
  className,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();
  const resolvedCtaLabel = ctaLabel ?? t("sharing.share");

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function copyToClipboard() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement("textarea");
        input.value = url;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        if (!copied) throw new Error("Clipboard copy was not available");
      }
      setCopied(true);
      toast({ title: t("sharing.linkCopiedTitle"), description: t("sharing.linkCopiedDescription") });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        variant: "destructive",
        title: t("sharing.couldNotCopy"),
        description: t("sharing.copyManually"),
      });
    }
    setOpen(false);
  }

  async function handleShare() {
    // Use the native share sheet if available (mobile)
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: description, url });
        return;
      } catch (err: any) {
        // User cancelled — don't fall through to popover
        if (err?.name === "AbortError") return;
        // Some browser/PWA versions throw when the share sheet closes or
        // rejects a payload. Fall back to the in-app options instead of
        // allowing the platform-specific exception to escape.
      }
    }
    // Desktop: toggle custom share popover
    setOpen((v) => !v);
  }

  const options: ShareOption[] = [
    {
      id: "whatsapp",
      label: t("sharing.shareOnWhatsApp"),
      icon: <MessageCircle className="w-4 h-4 text-green-600" />,
      action: () => {
        window.open(buildWhatsAppUrl(url, title), "_blank", "noopener,noreferrer");
        setOpen(false);
      },
    },
    {
      id: "telegram",
      label: t("sharing.shareOnTelegram"),
      icon: <Send className="w-4 h-4 text-sky-500" />,
      action: () => {
        window.open(buildTelegramUrl(url, title), "_blank", "noopener,noreferrer");
        setOpen(false);
      },
    },
    {
      id: "copy",
      label: copied ? t("sharing.copied") : t("sharing.copyLink"),
      icon: copied
        ? <Check className="w-4 h-4 text-emerald-600" />
        : <Link2 className="w-4 h-4 text-muted-foreground" />,
      action: copyToClipboard,
    },
  ];

  const trigger =
    variant === "icon" ? (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleShare}
        title={resolvedCtaLabel}
        className={className}
      >
        {copied ? (
          <Check className="w-4 h-4 text-emerald-600" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
      </Button>
    ) : (
      <Button
        variant="outline"
        onClick={handleShare}
        className={cn("gap-2", className)}
      >
        {copied ? (
          <Check className="w-4 h-4 text-emerald-600" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
        {resolvedCtaLabel}
      </Button>
    );

  return (
    <div ref={ref} className="relative inline-flex">
      {trigger}

      {open && (
        <div
          className={cn(
            "absolute z-50 min-w-[200px] rounded-xl border bg-popover shadow-lg",
            "p-1.5 text-popover-foreground",
            // Position above or below trigger depending on space (default: below + right-aligned)
            "top-full mt-2 right-0",
            "animate-in fade-in-0 slide-in-from-top-2 duration-150",
          )}
        >
          <div className="flex items-center justify-between px-2 py-1 mb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("sharing.share")}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-0.5 hover:bg-accent text-muted-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={opt.action}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                "hover:bg-accent hover:text-accent-foreground transition-colors",
                "text-left",
              )}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
