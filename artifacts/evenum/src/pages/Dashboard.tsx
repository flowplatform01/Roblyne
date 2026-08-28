import React from 'react';
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListOrganizations } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Building2, Plus, ArrowRight, Loader2, CalendarDays, Vote, Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const { data: organizations, isLoading, isError, refetch } = useListOrganizations();
  const { t, i18n } = useTranslation();

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-border/50">
          <div>
            <h1 className="text-4xl font-serif font-bold tracking-tight mb-2">{t("dashboard.yourOrganizations")}</h1>
            <p className="text-muted-foreground text-lg font-light">{t("dashboard.manageWorkspaces")}</p>
          </div>
          <Button asChild size="lg" className="h-12 px-6 shadow-sm hover:shadow-md transition-all">
            <Link href="/organizations/new">
              <Plus className="mr-2 h-5 w-5" />
              {t("dashboard.newOrganization")}
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="bg-card border border-border/60 rounded-sm p-12 text-center max-w-2xl mx-auto w-full shadow-sm mt-8">
            <h2 className="text-2xl font-serif font-bold mb-3">{t("common.somethingWentWrong")}</h2>
            <p className="text-muted-foreground mb-6">{t("common.tryAgain")}</p>
            <Button onClick={() => refetch()}>{t("common.tryAgain")}</Button>
          </div>
        ) : !organizations || organizations.length === 0 ? (
          <div className="bg-card border border-border/60 rounded-sm p-16 text-center max-w-2xl mx-auto w-full shadow-sm mt-8">
            <div className="w-20 h-20 bg-primary/5 text-primary rounded-full flex items-center justify-center mx-auto mb-8 ring-1 ring-primary/20">
              <Building2 className="h-10 w-10" />
            </div>
            <h2 className="text-3xl font-serif font-bold mb-4">{t("dashboard.noOrganizationsTitle")}</h2>
            <p className="text-muted-foreground text-lg font-light mb-10 leading-relaxed">
              {t("dashboard.noOrganizationsDescription")}
            </p>
            <Button size="lg" asChild className="h-14 px-8 text-lg">
              <Link href="/organizations/new">
                <Plus className="mr-2 h-5 w-5" />
                {t("dashboard.createOrganization")}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {organizations.map((org, i) => (
              <Card key={org.id} className="group bg-card border-border/60 hover:border-primary/40 hover:shadow-lg transition-all duration-500 rounded-sm overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-8" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="h-2 w-full bg-muted group-hover:bg-primary/80 transition-colors duration-500" />
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 rounded-sm bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-500 overflow-hidden shadow-sm">
                      {org.logoUrl ? (
                        <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="h-8 w-8 text-primary group-hover:text-primary-foreground transition-colors" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="font-serif text-2xl mb-2 line-clamp-1 group-hover:text-primary transition-colors">{org.name}</CardTitle>
                      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                         {t("dashboard.createdOn", {
                           date: org.createdAt
                             ? new Intl.DateTimeFormat(i18n.language, { month: "short", year: "numeric" }).format(new Date(org.createdAt))
                             : "—",
                         })}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-8 pb-8 flex-1">
                  {org.description ? (
                    <p className="text-foreground/70 font-light leading-relaxed line-clamp-2">{org.description}</p>
                  ) : (
                    <p className="text-muted-foreground/50 italic font-light">{t("dashboard.noDescriptionProvided")}</p>
                  )}
                  
                  {/* Mock stats - we don't have stats in the list endpoint, but visual indicators look good */}
                  <div className="mt-8 flex gap-6 border-t border-border/50 pt-6">
                    <div className="flex flex-col gap-1">
                      <Vote className="h-4 w-4 text-muted-foreground mb-1" />
                       <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("organizations.elections")}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <CalendarDays className="h-4 w-4 text-muted-foreground mb-1" />
                       <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("organizations.events")}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Megaphone className="h-4 w-4 text-muted-foreground mb-1" />
                       <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("organizations.campaigns")}</span>
                    </div>
                  </div>
                </CardContent>
                <div className="px-8 py-4 bg-muted/10 border-t border-border/50 group-hover:bg-primary/5 transition-colors duration-500">
                  <Button variant="ghost" className="w-full justify-between h-12 text-base font-medium group-hover:text-primary" asChild>
                    <Link href={`/organizations/${org.id}`}>
                       {t("dashboard.enterWorkspace")} <ArrowRight className="h-5 w-5 transform group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
