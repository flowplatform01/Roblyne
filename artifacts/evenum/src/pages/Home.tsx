import { useState, useCallback } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDiscover, useSearch, DiscoveryItemType } from "@workspace/api-client-react";
import { Loader2, ArrowRight, Vote, CalendarDays, Megaphone, Search, X } from "lucide-react";
import { format } from "date-fns";

export default function Home() {
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
    { query: { enabled: debouncedQuery.length >= 2 } }
  );

  return (
    <Layout>
      <div className="flex-1">
        {/* Hero Section */}
        <section className="relative h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden bg-foreground text-background">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-black/60 mix-blend-multiply z-10" />
            {/* The image will be loaded once generated */}
            <div className="w-full h-full bg-slate-900 bg-cover bg-center bg-[url('/attached_assets/generated_images/hero-assembly.jpg')]" />
          </div>
          
          <div className="relative z-20 container mx-auto px-4 text-center max-w-4xl">
            <Badge className="bg-primary/20 text-primary-foreground border-primary/30 mb-6 px-4 py-1.5 text-sm uppercase tracking-widest font-medium hover:bg-primary/30 transition-colors">
              The Platform for Organized Participation
            </Badge>
            <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tight mb-8 leading-tight text-white">
              Elevate your <br/><span className="text-primary italic">elections, events & campaigns.</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 mb-10 max-w-2xl mx-auto font-light">
              A unified system built by serious teams for serious organizations. Controlled, precise, confident.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" asChild className="h-14 px-8 text-lg bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/register">Get Started</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-14 px-8 text-lg bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white">
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Discovery Feed */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
              <div>
                <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Discover Opportunities</h2>
                <p className="text-muted-foreground text-lg max-w-2xl">
                  Browse public elections, register for upcoming events, or participate in open campaigns from trusted organizations.
                </p>
              </div>
              
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Search by organization or keyword..." 
                  className="w-full pl-10 pr-10 py-3 rounded-md border bg-card focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setDebouncedQuery(""); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                  <Loader2 className="h-12 w-12 animate-spin text-primary/50" />
                </div>
              ) : !searchData || searchData.items.length === 0 ? (
                <div className="text-center py-24 bg-muted/30 rounded-xl border border-dashed">
                  <Search className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-medium mb-2">No results for "{debouncedQuery}"</h3>
                  <p className="text-muted-foreground">Try different keywords or browse all items below.</p>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-serif font-bold mb-6 text-muted-foreground">
                    {searchData.total} result{searchData.total !== 1 ? 's' : ''} for "{debouncedQuery}"
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchData.items.map((item: any) => (
                      <DiscoveryCard key={`${item.type}-${item.id}`} item={item} />
                    ))}
                  </div>
                </div>
              )
            ) : isLoading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="h-12 w-12 animate-spin text-primary/50" />
              </div>
            ) : !discoverData ? (
              <div className="text-center py-32 bg-muted/30 rounded-xl border border-dashed">
                <h3 className="text-xl font-medium text-muted-foreground">Unable to load discovery feed</h3>
              </div>
            ) : (
              <div className="space-y-20">
                {/* Featured Section */}
                {discoverData.featured.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
                      <span className="w-8 h-[2px] bg-primary block"></span>
                      Featured
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {discoverData.featured.map(item => (
                        <DiscoveryCard key={`${item.type}-${item.id}`} item={item} featured />
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending Section */}
                {discoverData.trending.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
                      <span className="w-8 h-[2px] bg-primary block"></span>
                      Trending Now
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {discoverData.trending.map(item => (
                        <DiscoveryCard key={`${item.type}-${item.id}`} item={item} />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* General Feed */}
                {discoverData.items.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
                      <span className="w-8 h-[2px] bg-primary block"></span>
                      Recent Activity
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {discoverData.items.map(item => (
                        <DiscoveryCard key={`${item.type}-${item.id}`} item={item} />
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
          <section className="py-24 bg-card border-y">
            <div className="container mx-auto px-4">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Built for Every Organization</h2>
                <p className="text-muted-foreground text-lg">
                  Evenum unifies the tools organizations need to engage their members, manage attendance, and drive participation.
                </p>
              </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-background rounded-xl p-8 shadow-sm border group hover:border-primary/50 transition-colors">
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Vote className="h-7 w-7" />
                </div>
                <h3 className="text-2xl font-serif font-bold mb-3">Voting & Elections</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Run secure, professional elections with ranked positions, candidate profiles, and live verifiable results.
                </p>
                <Link href="/register" className="text-primary font-medium flex items-center gap-2 hover:gap-3 transition-all">
                  Create Election <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              
              <div className="bg-background rounded-xl p-8 shadow-sm border group hover:border-primary/50 transition-colors">
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <CalendarDays className="h-7 w-7" />
                </div>
                <h3 className="text-2xl font-serif font-bold mb-3">Events & Ticketing</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Manage RSVPs, sell tiered tickets, and check in attendees with QR codes at the door.
                </p>
                <Link href="/register" className="text-primary font-medium flex items-center gap-2 hover:gap-3 transition-all">
                  Host Event <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              
              <div className="bg-background rounded-xl p-8 shadow-sm border group hover:border-primary/50 transition-colors">
                <div className="w-14 h-14 bg-primary/10 text-primary rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Megaphone className="h-7 w-7" />
                </div>
                <h3 className="text-2xl font-serif font-bold mb-3">Structured Campaigns</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Launch donation drives, membership applications, and custom form collections with integrated payments.
                </p>
                <Link href="/register" className="text-primary font-medium flex items-center gap-2 hover:gap-3 transition-all">
                  Launch Campaign <ArrowRight className="h-4 w-4" />
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
      case 'election': return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case 'event': return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
      case 'campaign': return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      default: return "bg-slate-100 text-slate-800";
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
    <Card className={`group overflow-hidden transition-all hover:shadow-md hover:border-primary/30 flex flex-col ${featured ? 'md:row-span-2' : ''}`}>
      {item.coverImageUrl ? (
        <div className={`w-full ${featured ? 'h-64' : 'h-48'} overflow-hidden relative`}>
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors z-10" />
          <img 
            src={item.coverImageUrl} 
            alt={item.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out" 
          />
          <Badge className={`absolute top-4 left-4 z-20 ${getTypeColor(item.type)} border-none shadow-sm flex items-center gap-1.5`}>
            {getTypeIcon(item.type)}
            <span className="capitalize">{item.type}</span>
          </Badge>
        </div>
      ) : (
        <div className={`w-full ${featured ? 'h-64' : 'h-48'} bg-muted/50 flex items-center justify-center relative overflow-hidden`}>
          {item.type === 'election' && <div className="absolute inset-0 opacity-20 bg-cover bg-center bg-[url('/attached_assets/generated_images/voting-abstract.jpg')]" />}
          {item.type === 'campaign' && <div className="absolute inset-0 opacity-20 bg-cover bg-center bg-[url('/attached_assets/generated_images/campaign-abstract.jpg')]" />}
          
          <Badge className={`absolute top-4 left-4 z-20 ${getTypeColor(item.type)} border-none shadow-sm flex items-center gap-1.5`}>
            {getTypeIcon(item.type)}
            <span className="capitalize">{item.type}</span>
          </Badge>
          {getTypeIcon(item.type)}
        </div>
      )}
      
      <CardHeader className={`${featured ? 'pt-8' : ''}`}>
        <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          {item.organizationName}
        </div>
        <CardTitle className={`font-serif leading-tight ${featured ? 'text-2xl' : 'text-xl'} group-hover:text-primary transition-colors line-clamp-2`}>
          <Link href={getHref()} className="before:absolute before:inset-0">
            {item.title}
          </Link>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1">
        {item.description && (
          <p className="text-muted-foreground text-sm line-clamp-3 mb-4">
            {item.description}
          </p>
        )}
        
        <div className="flex flex-wrap gap-y-2 gap-x-4 text-xs font-medium text-slate-500 dark:text-slate-400 mt-auto pt-4 border-t border-border/50">
          {item.startsAt && (
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(new Date(item.startsAt), 'MMM d, yyyy')}
            </div>
          )}
          {item.participantsCount !== undefined && (
            <div className="flex items-center gap-1">
              <span className="font-semibold text-foreground">{item.participantsCount}</span> participants
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
