import React, { useState } from 'react';
import { useRoute, Link } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { 
  useGetOrganization, 
  useGetOrganizationStats,
  useListElections,
  useListEvents,
  useListCampaigns
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Users, Vote, CalendarDays, Megaphone, ArrowRight, ExternalLink } from "lucide-react";
import { format } from "date-fns";

export default function OrganizationWorkspace() {
  const [match, params] = useRoute("/organizations/:id");
  const orgId = params?.id ? parseInt(params.id, 10) : 0;
  
  // Get tab from URL hash/search if possible, otherwise default to overview
  const [activeTab, setActiveTab] = useState("overview");
  
  // Sync tab with URL search params manually since wouter doesn't have useSearchParams hook
  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'elections', 'events', 'campaigns'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', val);
    window.history.pushState({}, '', url.toString());
  };

  const { data: org, isLoading: isOrgLoading } = useGetOrganization(orgId);
  const { data: stats, isLoading: isStatsLoading } = useGetOrganizationStats(orgId);
  
  // Data for tabs
  const { data: elections, isLoading: isElectionsLoading } = useListElections({ orgId });
  const { data: events, isLoading: isEventsLoading } = useListEvents({ orgId });
  const { data: campaigns, isLoading: isCampaignsLoading } = useListCampaigns({ orgId });

  if (isOrgLoading || isStatsLoading) {
    return (
      <DashboardLayout orgId={orgId.toString()}>
        <div className="flex items-center justify-center h-full min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
        </div>
      </DashboardLayout>
    );
  }

  if (!org) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold mb-2">Organization Not Found</h2>
          <p className="text-muted-foreground mb-6">The organization you're looking for doesn't exist or you don't have access.</p>
          <Button asChild><Link href="/dashboard">Return to Dashboard</Link></Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout orgId={orgId.toString()}>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="w-10 h-10 rounded bg-muted object-cover" />
            ) : (
              <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center">
                <span className="font-serif font-bold text-xl">{org.name.charAt(0)}</span>
              </div>
            )}
            <h1 className="text-3xl font-serif font-bold tracking-tight">{org.name}</h1>
          </div>
          {org.description && <p className="text-muted-foreground max-w-3xl">{org.description}</p>}
          {org.website && (
            <a href={org.website} target="_blank" rel="noreferrer" className="text-sm text-primary flex items-center gap-1 mt-2 hover:underline w-fit">
              <ExternalLink className="h-3 w-3" /> Visit Website
            </a>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-8 bg-muted/50 p-1 w-full justify-start h-auto border">
          <TabsTrigger value="overview" className="px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">Overview</TabsTrigger>
          <TabsTrigger value="elections" className="px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">Elections</TabsTrigger>
          <TabsTrigger value="events" className="px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">Events</TabsTrigger>
          <TabsTrigger value="campaigns" className="px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatsCard 
              title="Total Participants" 
              value={stats?.totalParticipants || 0} 
              icon={<Users className="h-5 w-5 text-muted-foreground" />} 
            />
            <StatsCard 
              title="Active Elections" 
              value={stats?.activeElectionsCount || 0} 
              total={stats?.electionsCount}
              icon={<Vote className="h-5 w-5 text-muted-foreground" />} 
            />
            <StatsCard 
              title="Upcoming Events" 
              value={stats?.upcomingEventsCount || 0} 
              total={stats?.eventsCount}
              icon={<CalendarDays className="h-5 w-5 text-muted-foreground" />} 
            />
            <StatsCard 
              title="Active Campaigns" 
              value={stats?.activeCampaignsCount || 0} 
              total={stats?.campaignsCount}
              icon={<Megaphone className="h-5 w-5 text-muted-foreground" />} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="col-span-1 border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-serif">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button variant="outline" className="justify-start h-12" asChild>
                  <Link href={`/elections/new?orgId=${org.id}`}>
                    <Vote className="mr-3 h-4 w-4 text-primary" /> Create New Election
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start h-12" asChild>
                  <Link href={`/events/new?orgId=${org.id}`}>
                    <CalendarDays className="mr-3 h-4 w-4 text-emerald-600" /> Host New Event
                  </Link>
                </Button>
                <Button variant="outline" className="justify-start h-12" asChild>
                  <Link href={`/campaigns/new?orgId=${org.id}`}>
                    <Megaphone className="mr-3 h-4 w-4 text-amber-600" /> Launch Campaign
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="col-span-1 lg:col-span-2 border-border/50 shadow-sm">
              <CardHeader className="pb-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-serif">Recent Activity</CardTitle>
                  <CardDescription>Latest items across your engines</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {/* Aggregate and sort recent items here. For now, simple stubs. */}
                <div className="space-y-4">
                  {!elections?.length && !events?.length && !campaigns?.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No activity yet. Create your first item to get started.
                    </div>
                  ) : (
                    <>
                      {elections?.slice(0, 2).map(e => (
                        <ActivityRow key={`election-${e.id}`} type="election" item={e} orgId={orgId} />
                      ))}
                      {events?.slice(0, 2).map(e => (
                        <ActivityRow key={`event-${e.id}`} type="event" item={e} orgId={orgId} />
                      ))}
                      {campaigns?.slice(0, 2).map(c => (
                        <ActivityRow key={`campaign-${c.id}`} type="campaign" item={c} orgId={orgId} />
                      ))}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="elections" className="mt-0 focus-visible:outline-none">
          <EngineList 
            title="Elections" 
            description="Manage voting events, ballots, and results"
            icon={<Vote className="h-6 w-6" />}
            createLink={`/elections/new?orgId=${orgId}`}
            createLabel="New Election"
            items={elections}
            isLoading={isElectionsLoading}
            type="election"
            orgId={orgId}
          />
        </TabsContent>

        <TabsContent value="events" className="mt-0 focus-visible:outline-none">
          <EngineList 
            title="Events" 
            description="Manage RSVPs, ticketing, and check-ins"
            icon={<CalendarDays className="h-6 w-6" />}
            createLink={`/events/new?orgId=${orgId}`}
            createLabel="New Event"
            items={events}
            isLoading={isEventsLoading}
            type="event"
            orgId={orgId}
          />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-0 focus-visible:outline-none">
          <EngineList 
            title="Campaigns" 
            description="Manage structured data collection and payments"
            icon={<Megaphone className="h-6 w-6" />}
            createLink={`/campaigns/new?orgId=${orgId}`}
            createLabel="New Campaign"
            items={campaigns}
            isLoading={isCampaignsLoading}
            type="campaign"
            orgId={orgId}
          />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

function StatsCard({ title, value, total, icon }: { title: string, value: number, total?: number, icon: React.ReactNode }) {
  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-serif font-bold">
          {value}
          {total !== undefined && <span className="text-lg text-muted-foreground font-sans ml-1">/ {total}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityRow({ type, item, orgId }: { type: string, item: any, orgId: number }) {
  const getIcon = () => {
    switch(type) {
      case 'election': return <Vote className="h-4 w-4 text-blue-600" />;
      case 'event': return <CalendarDays className="h-4 w-4 text-emerald-600" />;
      case 'campaign': return <Megaphone className="h-4 w-4 text-amber-600" />;
      default: return null;
    }
  };
  
  const getBadgeColor = (status: string) => {
    switch(status) {
      case 'active':
      case 'published': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'draft': return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-400';
      case 'ended':
      case 'completed': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getLink = () => {
    switch(type) {
      case 'election': return `/elections/${item.id}`;
      case 'event': return `/events/${item.id}`;
      case 'campaign': return `/campaigns/${item.id}`;
      default: return "#";
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
          {getIcon()}
        </div>
        <div>
          <h4 className="font-medium text-sm hover:text-primary transition-colors">
            <Link href={getLink()}>{item.title}</Link>
          </h4>
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
            <span className="capitalize">{type}</span>
            <span>•</span>
            {format(new Date(item.createdAt), 'MMM d, yyyy')}
          </div>
        </div>
      </div>
      <Badge variant="outline" className={`capitalize ${getBadgeColor(item.status)}`}>
        {item.status}
      </Badge>
    </div>
  );
}

function EngineList({ 
  title, 
  description, 
  icon, 
  createLink, 
  createLabel, 
  items, 
  isLoading, 
  type,
  orgId
}: any) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            {icon}
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button asChild>
          <Link href={createLink}>
            <Plus className="mr-2 h-4 w-4" /> {createLabel}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48 border rounded-xl bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      ) : !items || items.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center bg-card">
          <div className="w-12 h-12 bg-muted text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-4">
            {icon}
          </div>
          <h3 className="text-lg font-medium mb-1">No {title.toLowerCase()} found</h3>
          <p className="text-muted-foreground mb-6">You haven't created any {title.toLowerCase()} yet.</p>
          <Button variant="outline" asChild>
            <Link href={createLink}>{createLabel}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item: any) => (
            <Card key={item.id} className="hover:border-primary/40 transition-colors flex flex-col">
              {item.coverImageUrl ? (
                <div className="h-32 w-full bg-muted overflow-hidden rounded-t-xl border-b">
                  <img src={item.coverImageUrl} alt={item.title} className="w-full h-full object-cover" />
                </div>
              ) : null}
              <CardHeader className={item.coverImageUrl ? "pt-4" : ""}>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className={`capitalize ${
                    item.status === 'active' || item.status === 'published' 
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                      : item.status === 'draft' ? 'bg-slate-100 text-slate-800 border-slate-200'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {item.status}
                  </Badge>
                  <Badge variant="secondary" className="capitalize text-xs font-normal">
                    {item.visibility.replace('_', ' ')}
                  </Badge>
                </div>
                <CardTitle className="text-lg font-serif line-clamp-1">{item.title}</CardTitle>
                <CardDescription className="text-xs">
                  {item.startsAt ? format(new Date(item.startsAt), 'MMM d, yyyy') : 'No date set'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {item.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description</p>
                )}
                
                <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                  {type === 'election' && (
                    <>
                      <span><strong className="text-foreground">{item.candidatesCount || 0}</strong> candidates</span>
                      <span><strong className="text-foreground">{item.totalVotes || 0}</strong> votes</span>
                    </>
                  )}
                  {type === 'event' && (
                    <>
                      <span><strong className="text-foreground">{item.attendeesCount || 0}</strong> attendees</span>
                      {item.capacity && <span><strong className="text-foreground">{item.capacity}</strong> cap</span>}
                    </>
                  )}
                  {type === 'campaign' && (
                    <>
                      <span><strong className="text-foreground">{item.submissionsCount || 0}</strong> submissions</span>
                      {item.goalAmount && <span>Goal: ${item.goalAmount}</span>}
                    </>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t bg-muted/20">
                <Button variant="ghost" className="w-full justify-between" asChild>
                  <Link href={`/${type}s/${item.id}`}>
                    Manage {type} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
