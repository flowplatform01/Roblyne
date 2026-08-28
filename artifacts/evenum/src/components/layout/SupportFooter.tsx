import { Mail, MessageCircle, Phone, LifeBuoy, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";

function whatsappHref(value: string) {
  const digits = value.replace(/[^\d+]/g, "").replace(/^\+/, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export function SupportFooter() {
  const { t } = useTranslation();
  const { data: settings } = usePlatformSettings();
  const supportWhatsapp = settings?.supportWhatsapp ? whatsappHref(settings.supportWhatsapp) : null;
  const hasChannel = Boolean(settings?.supportEmail || settings?.supportPhone || supportWhatsapp || settings?.supportUrl);

  if (!hasChannel) return null;

  return (
    <footer className="border-t bg-muted/20 px-4 py-6">
      <div className="container mx-auto flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">{t("support.needHelp")}</span>
          <span className="hidden sm:inline">·</span>
          <span>{t("support.contactTeam")}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {settings?.supportEmail && (
            <a className="inline-flex items-center gap-1.5 hover:text-foreground" href={`mailto:${settings.supportEmail}`}>
              <Mail className="h-3.5 w-3.5" /> {settings.supportEmail}
            </a>
          )}
          {settings?.supportPhone && (
            <a className="inline-flex items-center gap-1.5 hover:text-foreground" href={`tel:${settings.supportPhone}`}>
              <Phone className="h-3.5 w-3.5" /> {settings.supportPhone}
            </a>
          )}
          {supportWhatsapp && (
            <a className="inline-flex items-center gap-1.5 hover:text-foreground" href={supportWhatsapp} target="_blank" rel="noreferrer">
              <MessageCircle className="h-3.5 w-3.5" /> {t("support.whatsapp")}
            </a>
          )}
          {settings?.supportUrl && (
            <a className="inline-flex items-center gap-1.5 hover:text-foreground" href={settings.supportUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> {t("support.helpCenter")}
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}