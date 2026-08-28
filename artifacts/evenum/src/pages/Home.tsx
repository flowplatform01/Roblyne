import { useState, useCallback } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDiscover, useSearch, DiscoveryItemType } from "@workspace/api-client-react";
import { Loader2, ArrowRight, Vote, CalendarDays, Megaphone, Search, X } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

export default function Home() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    const timer = setTimeout(() => setDebouncedQuery(value), 350);
    return () => clearTimeout(timer);
  }, []);

  const { data: discoverData, isLoading } = useDiscover();
  const { data: searchData, isLoading: isSearchLoading } = useSearch(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length >= 2, queryKey: ['search', debouncedQuery] } }
  );

  return (
    <Layout>
      <div className="flex-1">
        {/* Hero Section */}
        <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-foreground text-background">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-b from-foreground/80 via-foreground/90 to-foreground z-10" />
            <div className="w-full h-full bg-cover bg-center bg-[url('/attached_assets/generated_images/hero-assembly.jpg')] scale-105 animate-in fade-in zoom-in duration-1000" />
            <div className="paper-grain absolute inset-0 z-20 opacity-30" />
          </div>
          
          <div className="relative z-30 container mx-auto px-4 text-center max-w-4xl py-24 animate-in slide-in-from-bottom-8 duration-700 fade-in delay-150 fill-mode-both">
            <div className="inline-flex mb-8">
              <span className="px-4 py-1.5 border border-primary/40 bg-primary/10 text-primary-foreground/90 text-sm uppercase tracking-widest font-sans font-medium rounded-sm shadow-sm backdrop-blur-md">
                 {t("home.heroBadge")}
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold tracking-tight mb-8 leading-[1.1] text-card">
               {t("home.heroTitle")}
            </h1>
            <p className="text-xl md:text-2xl text-muted/80 mb-12 max-w-2xl mx-auto font-sans font-light leading-relaxed">
               {t("home.heroDescription")}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Button size="lg" asChild className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300">
                 <Link href="/register">{t("common.getStarted")}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-14 px-8 text-lg bg-transparent text-card border-card/30 hover:bg-card/10 hover:border-card/50 hover:text-card transition-all duration-300">
                 <Link href="/login">{t("common.signIn")}</Link>
              </Button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-16 sm:h-32 bg-gradient-to-t from-background to-transparent z-20 pointer-events-none" />
        </section>

        {/* Discovery Feed */}
        <section className="py-32 bg-background relative z-30 paper-grain">
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="max-w-3xl">
                 <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 tracking-tight">{t("home.discoverTitle")}</h2>
                <p className="text-muted-foreground text-xl font-light leading-relaxed">
                   {t("home.discoverDescription")}
                </p>
              </div>
              
              <div className="relative max-w-md w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                   placeholder={t("home.searchPlaceholder")}
                  className="w-full pl-12 pr-12 py-4 rounded-sm border-2 border-border/50 bg-card shadow-sm focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all font-medium text-lg placeholder:font-light"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setDebouncedQuery(""); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors bg-muted p-1 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {debouncedQuery.length >= 2 ? (
              /* Search Results Mode */
              isSearchLoading ? (
                <div className="flex items-center justify-center py-32">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
              ) : !searchData || searchData.items.length === 0 ? (
                <div className="text-center py-32 bg-card border border-border/50 rounded-sm shadow-sm">
                  <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-6" />
                   <h3 className="text-2xl font-serif font-bold mb-3">{t("home.noResultsFor", { query: debouncedQuery })}</h3>
                   <p className="text-muted-foreground text-lg font-light">{t("home.tryDifferentKeywords")}</p>
                </div>
              ) : (
                <div className="animate-in fade-in duration-500">
                  <h3 className="text-2xl font-serif font-bold mb-8 text-muted-foreground">
                     {t("home.resultsFor", { count: searchData.total, query: debouncedQuery })}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {searchData.items.map((item: any, i: number) => (
                      <div key={`${item.type}-${item.id}`} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                        <DiscoveryCard item={item} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : isLoading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
            ) : !discoverData ? (
              <div className="text-center py-32 bg-card border border-border/50 rounded-sm shadow-sm">
                 <h3 className="text-2xl font-serif font-bold text-muted-foreground">{t("home.unableToLoad")}</h3>
              </div>
            ) : (
              <div className="space-y-32">
                {/* Featured Section */}
                {discoverData.featured.length > 0 && (
                  <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center gap-4 mb-10">
                      <span className="w-12 h-[2px] bg-primary block"></span>
                       <h3 className="text-3xl font-serif font-bold">{t("home.featured")}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {discoverData.featured.map((item, i) => (
                        <div key={`${item.type}-${item.id}`} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                          <DiscoveryCard item={item} featured />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending Section */}
                {discoverData.trending.length > 0 && (
                  <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center gap-4 mb-10">
                      <span className="w-12 h-[2px] bg-primary block"></span>
                       <h3 className="text-3xl font-serif font-bold">{t("home.trendingNow")}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                      {discoverData.trending.map((item, i) => (
                        <div key={`${item.type}-${item.id}`} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                          <DiscoveryCard item={item} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* General Feed */}
                {discoverData.items.length > 0 && (
                  <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center gap-4 mb-10">
                      <span className="w-12 h-[2px] bg-primary block"></span>
                       <h3 className="text-3xl font-serif font-bold">{t("home.recentActivity")}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                      {discoverData.items.map((item, i) => (
                        <div key={`${item.type}-${item.id}`} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 100}ms` }}>
                          <DiscoveryCard item={item} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        
        {/* Engines Showcase */}
        {!debouncedQuery && (
          <section className="py-32 bg-foreground text-background relative overflow-hidden">
            <div className="paper-grain absolute inset-0 z-0 opacity-20 invert" />
            <div className="container mx-auto px-4 relative z-10">
              <div className="text-center max-w-3xl mx-auto mb-20">
                 <h2 className="text-4xl md:text-5xl font-serif font-bold mb-6 tracking-tight text-card">{t("home.enginesTitle")}</h2>
                <p className="text-muted/80 text-xl font-light leading-relaxed">
                   {t("home.enginesDescription")}
                </p>
              </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-background/5 p-10 border border-background/10 group hover:bg-background/10 transition-colors duration-500">
                <div className="w-16 h-16 bg-primary/20 text-primary rounded-sm flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                  <Vote className="h-8 w-8 text-primary" />
                </div>
                 <h3 className="text-2xl font-serif font-bold mb-4 text-card">{t("home.votingTitle")}</h3>
                <p className="text-muted/70 mb-10 leading-relaxed font-light text-lg">
                   {t("home.votingDescription")}
                </p>
                <Link href="/register" className="text-primary font-medium flex items-center gap-2 hover:gap-4 transition-all uppercase tracking-wide text-sm">
                   {t("home.createElection")} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              
              <div className="bg-background/5 p-10 border border-background/10 group hover:bg-background/10 transition-colors duration-500">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-sm flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                  <CalendarDays className="h-8 w-8" />
                </div>
                 <h3 className="text-2xl font-serif font-bold mb-4 text-card">{t("home.eventsTitle")}</h3>
                <p className="text-muted/70 mb-10 leading-relaxed font-light text-lg">
                   {t("home.eventsDescription")}
                </p>
                <Link href="/register" className="text-emerald-400 font-medium flex items-center gap-2 hover:gap-4 transition-all uppercase tracking-wide text-sm">
                   {t("home.hostEvent")} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              
              <div className="bg-background/5 p-10 border border-background/10 group hover:bg-background/10 transition-colors duration-500">
                <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-sm flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                  <Megaphone className="h-8 w-8" />
                </div>
                 <h3 className="text-2xl font-serif font-bold mb-4 text-card">{t("home.campaignsTitle")}</h3>
                <p className="text-muted/70 mb-10 leading-relaxed font-light text-lg">
                   {t("home.campaignsDescription")}
                </p>
                <Link href="/register" className="text-amber-400 font-medium flex items-center gap-2 hover:gap-4 transition-all uppercase tracking-wide text-sm">
                   {t("home.launchCampaign")} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
        )}
      </div>
    </Layout>
  );
}

function DiscoveryCard({ item, featured = false }: { item: any, featured?: boolean }) {
  const { t } = useTranslation();
  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'election': return <Vote className="h-4 w-4" />;
      case 'event': return <CalendarDays className="h-4 w-4" />;
      case 'campaign': return <Megaphone className="h-4 w-4" />;
      default: return null;
    }
  };
  
  const getTypeColor = (type: string) => {
    switch(type) {
      case 'election': return "bg-primary text-primary-foreground";
      case 'event': return "bg-emerald-700 text-emerald-50";
      case 'campaign': return "bg-amber-600 text-amber-50";
      default: return "bg-slate-700 text-slate-50";
    }
  };

  const getHref = () => {
    switch(item.type) {
      case 'election': return `/elections/${item.id}/vote`;
      case 'event': return `/events/${item.id}/register`;
      case 'campaign': return `/campaigns/${item.id}/participate`;
      default: return "#";
    }
  };

  return (
    <Card className={`relative group overflow-hidden rounded-sm bg-card border border-border/60 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 flex flex-col ${featured ? 'md:row-span-2' : 'h-full'}`}>
      {item.coverImageUrl ? (
        <div className={`w-full ${featured ? 'h-80' : 'h-52'} overflow-hidden relative`}>
          <div className="absolute inset-0 bg-foreground/10 group-hover:bg-transparent transition-colors z-10 duration-500" />
          <img 
            src={item.coverImageUrl} 
            alt={item.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out" 
          />
          <div className={`absolute top-4 left-4 z-20 ${getTypeColor(item.type)} px-3 py-1.5 text-xs uppercase tracking-widest font-semibold flex items-center gap-2 shadow-md`}>
            {getTypeIcon(item.type)}
             <span>{t(`home.type${item.type.charAt(0).toUpperCase()}${item.type.slice(1)}`)}</span>
          </div>
        </div>
      ) : (
        <div className={`w-full ${featured ? 'h-80' : 'h-52'} bg-muted flex items-center justify-center relative overflow-hidden`}>
          {item.type === 'election' && <div className="absolute inset-0 opacity-40 bg-cover bg-center bg-[url('/attached_assets/generated_images/voting-abstract.jpg')] mix-blend-multiply transition-transform duration-1000 group-hover:scale-105" />}
          {item.type === 'campaign' && <div className="absolute inset-0 opacity-40 bg-cover bg-center bg-[url('/attached_assets/generated_images/campaign-abstract.jpg')] mix-blend-multiply transition-transform duration-1000 group-hover:scale-105" />}
          {item.type === 'event' && <div className="absolute inset-0 opacity-40 bg-cover bg-center bg-[url('/attached_assets/generated_images/event-abstract.jpg')] mix-blend-multiply transition-transform duration-1000 group-hover:scale-105" />}
          
          <div className={`absolute top-4 left-4 z-20 ${getTypeColor(item.type)} px-3 py-1.5 text-xs uppercase tracking-widest font-semibold flex items-center gap-2 shadow-md`}>
            {getTypeIcon(item.type)}
             <span>{t(`home.type${item.type.charAt(0).toUpperCase()}${item.type.slice(1)}`)}</span>
          </div>
          <div className="z-10 p-4 bg-background/80 backdrop-blur-sm rounded-full shadow-sm text-foreground/50">
            {getTypeIcon(item.type)}
          </div>
        </div>
      )}
      
      <CardHeader className={`${featured ? 'pt-8 pb-6 px-8' : 'pt-6 pb-4 px-6'}`}>
        <div className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2 uppercase tracking-wide">
          {item.organizationName}
        </div>
        <CardTitle className={`font-serif leading-tight ${featured ? 'text-3xl' : 'text-xl'} group-hover:text-primary transition-colors line-clamp-2`}>
          <Link href={getHref()} className="before:absolute before:inset-0">
            {item.title}
          </Link>
        </CardTitle>
      </CardHeader>
      
      <CardContent className={`flex-1 ${featured ? 'px-8' : 'px-6'}`}>
        {item.description && (
          <p className="text-foreground/70 font-light text-base line-clamp-3 mb-6 leading-relaxed">
            {item.description}
          </p>
        )}
        
        <div className="flex flex-wrap gap-y-3 gap-x-6 text-sm font-medium text-muted-foreground mt-auto pt-6 border-t border-border/50">
          {item.startsAt && (
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {format(new Date(item.startsAt), 'MMM d, yyyy')}
            </div>
          )}
          {item.participantsCount !== undefined && (
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">{item.participantsCount}</span> 
               <span className="font-light text-foreground/60">{t("common.participants")}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
