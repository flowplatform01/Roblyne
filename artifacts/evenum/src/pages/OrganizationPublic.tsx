import React from 'react';
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useGetPublicOrganization } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/branding/ShareButton";
import { BrandedHero } from "@/components/branding/BrandedHero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Vote, CalendarDays, Megaphone, ExternalLink, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PublicPageLoadingSkeleton } from "@/components/loading/LoadingStates";

export default function OrganizationPublic() {
  const [, params] = useRoute("/organizations/:id/public");
  const orgId = params?.id ? parseInt(params.id, 10) : 0;
  const { t } = useTranslation();

  const { data: org, isLoading } = useGetPublicOrganization(orgId);
  const shareUrl = `${window.location.origin}/organizations/${orgId}/public`;

  usePageMeta(org ? {
    title: `${org.name} · ROBYNE`,
    description: org.description || `${org.name} uses ROBYNE to run elections, events, and campaigns. Explore their public profile.`,
    image: org.logoUrl || null,
    url: shareUrl,
  } : null);

  if (isLoading) {
    return (
      <Layout>
        <PublicPageLoadingSkeleton label={t("common.loading")} />
      </Layout>
    );
  }

  if (!org) return null;

  const recentElections: any[] = (org as any).recentElections || [];
  const recentEvents: any[] = (org as any).recentEvents || [];
  const recentCampaigns: any[] = (org as any).recentCampaigns || [];

  return (
    <Layout>
      <BrandedHero
        title={org.name}
        subtitle={org.description}
        org={org}
        imageUrl={(org as any).heroImageUrl || (org as any).coverImageUrl}
        logoUrl={org.logoUrl}
        badge={
          <Badge className="bg-background/20 text-background border-background/30 backdrop-blur-sm text-xs font-bold uppercase tracking-widest">
            Organization
          </Badge>
        }
        actions={
          <>
            {org.website && (
              <Button
                variant="outline"
                asChild
                className="h-12 px-6 rounded-sm bg-transparent border-white/40 text-white hover:bg-white/10 hover:border-white/60 hover:text-white focus-visible:ring-white/70"
              >
                <a href={org.website} target="_blank" rel="noopener noreferrer">
                  <Globe className="mr-2 h-4 w-4" />
                   {t("common.website")}
                </a>
              </Button>
            )}
            <ShareButton
              url={shareUrl}
              title={org.name}
              description={org.description || `Visit ${org.name} on ROBYNE`}
              className="bg-white/15 border-white/50 text-white hover:bg-white/25 hover:border-white/70 hover:text-white rounded-sm focus-visible:ring-white/70"
            />
          </>
        }
      />

      <div className="container mx-auto px-4 py-12 max-w-5xl space-y-14">

        {/* Stats */}
        {((org as any).electionsCount > 0 || (org as any).eventsCount > 0 || (org as any).campaignsCount > 0) && (
          <div className="grid grid-cols-3 gap-px bg-border rounded-sm overflow-hidden border border-border">
            <div className="bg-card px-6 py-5 text-center">
              <p className="text-3xl font-serif font-bold tabular-nums">{(org as any).electionsCount ?? 0}</p>
               <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">{t("home.typeElection")}</p>
            </div>
            <div className="bg-card px-6 py-5 text-center">
              <p className="text-3xl font-serif font-bold tabular-nums">{(org as any).eventsCount ?? 0}</p>
               <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">{t("home.typeEvent")}</p>
            </div>
            <div className="bg-card px-6 py-5 text-center">
              <p className="text-3xl font-serif font-bold tabular-nums">{(org as any).campaignsCount ?? 0}</p>
               <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">{t("home.typeCampaign")}s</p>
            </div>
          </div>
        )}

        {/* Elections */}
        {recentElections.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <Vote className="h-5 w-5 text-primary" />
               <h2 className="text-xl font-serif font-bold">{t("home.typeElection")}s</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentElections.map((e: any) => (
                <Card key={e.id} className="flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <Badge variant={e.status === 'active' ? 'default' : 'secondary'} className="w-fit capitalize text-xs mb-1">{e.status}</Badge>
                    <CardTitle className="text-base font-serif line-clamp-2">{e.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 gap-3">
                    {e.description && <CardDescription className="line-clamp-2">{e.description}</CardDescription>}
                    <div className="mt-auto">
                      {e.status === 'active' && (
                        <Button asChild size="sm" className="w-full rounded-sm">
                           <Link href={`/elections/${e.id}/vote`}>
                             <Vote className="mr-2 h-3 w-3" /> {t("common.voteNow")}
                          </Link>
                        </Button>
                      )}
                      {e.status === 'ended' && (
                        <Button asChild size="sm" variant="outline" className="w-full rounded-sm">
                          <Link href={`/elections/${e.id}/results`}>
                             <ExternalLink className="mr-2 h-3 w-3" /> {t("common.viewResults")}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Events */}
        {recentEvents.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <CalendarDays className="h-5 w-5 text-emerald-500" />
               <h2 className="text-xl font-serif font-bold">{t("home.typeEvent")}s</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentEvents.map((e: any) => (
                <Card key={e.id} className="flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <Badge variant={e.status === 'published' ? 'default' : 'secondary'} className="w-fit capitalize text-xs mb-1">{e.status}</Badge>
                    <CardTitle className="text-base font-serif line-clamp-2">{e.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 gap-3">
                    {e.description && <CardDescription className="line-clamp-2">{e.description}</CardDescription>}
                    <div className="mt-auto">
                      {e.status === 'published' && (
                        <Button asChild size="sm" className="w-full rounded-sm">
                          <Link href={`/events/${e.id}/register`}>
                         <ExternalLink className="mr-2 h-3 w-3" /> {t("common.register")}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Campaigns */}
        {recentCampaigns.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <Megaphone className="h-5 w-5 text-amber-500" />
               <h2 className="text-xl font-serif font-bold">{t("home.typeCampaign")}s</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentCampaigns.map((c: any) => (
                <Card key={c.id} className="flex flex-col hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className="w-fit capitalize text-xs mb-1">{c.status}</Badge>
                    <CardTitle className="text-base font-serif line-clamp-2">{c.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 gap-3">
                    {c.description && <CardDescription className="line-clamp-2">{c.description}</CardDescription>}
                    <div className="mt-auto">
                      {c.status === 'active' && (
                        <Button asChild size="sm" className="w-full rounded-sm">
                          <Link href={`/campaigns/${c.id}/participate`}>
                           <Megaphone className="mr-2 h-3 w-3" /> {t("common.participate")}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {recentElections.length === 0 && recentEvents.length === 0 && recentCampaigns.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
             <p className="text-lg font-medium mb-2">{t("home.noActivity")}</p>
             <p className="text-sm">{t("organizations.noPublicActivity")}</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
