import React, { useState } from 'react';
import { useRoute, useLocation, Link } from "wouter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { 
  useGetOrganization, 
  useGetOrganizationStats,
  useListElections,
  useListEvents,
  useListCampaigns,
  useListOrganizationMembers,
  useAddOrganizationMember,
  useUpdateOrganizationMember,
  useRemoveOrganizationMember,
  useUpdateOrganization,
  getListOrganizationMembersQueryKey,
  getGetOrganizationQueryKey,
  getListOrganizationsQueryKey,
  getGetPublicOrganizationQueryKey,
  useGetOrgFinanceSummary,
  useListOrgTransactions,
  useListOrgSettlements,
  useGetOrgAnalytics,
  useRequestOrgWithdrawal,
  getGetOrgFinanceSummaryQueryKey,
  getListOrgTransactionsQueryKey,
  getListOrgSettlementsQueryKey,
  getGetOrgAnalyticsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Users, Vote, CalendarDays, Megaphone, ArrowRight, ExternalLink, Trash2, Shield, UserCheck, Settings, Save, Globe, Wallet, Receipt, ArrowUpRight, CheckCircle2, TrendingUp, BarChart3, Activity } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { AccentColorPicker } from "@/components/branding/AccentColorPicker";
import { ShareButton } from "@/components/branding/ShareButton";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatCurrency as formatCurrencyValue } from "@/lib/currency";
import { WorkspaceLoadingSkeleton, InlineListLoadingSkeleton } from "@/components/loading/LoadingStates";
import { Skeleton } from "@/components/ui/skeleton";

export default function OrganizationWorkspace() {
  const [match, params] = useRoute("/organizations/:id");
  const orgId = params?.id ? parseInt(params.id, 10) : 0;
  const [location, setLocation] = useLocation();
  
  const [activeTab, setActiveTab] = useState("overview");
  
  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'elections', 'events', 'campaigns', 'team', 'analytics', 'finance', 'settings'].includes(tab)) {
      setActiveTab(tab);
    } else {
      setActiveTab("overview");
    }
  }, [location]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setLocation(`/organizations/${orgId}?tab=${val}`);
  };

  const { data: org, isLoading: isOrgLoading } = useGetOrganization(orgId);
  const { data: stats, isLoading: isStatsLoading } = useGetOrganizationStats(orgId);
  
  const { data: elections, isLoading: isElectionsLoading } = useListElections({ orgId });
  const { data: events, isLoading: isEventsLoading } = useListEvents({ orgId });
  const { data: campaigns, isLoading: isCampaignsLoading } = useListCampaigns({ orgId });

  if (isOrgLoading || isStatsLoading) {
    return (
      <DashboardLayout orgId={orgId.toString()}>
        <WorkspaceLoadingSkeleton />
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
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="w-16 h-16 rounded bg-muted object-cover border border-border/60" />
            ) : (
              <div className="w-16 h-16 rounded bg-primary/10 text-primary dark:bg-white/10 dark:text-white flex items-center justify-center border border-border/30 dark:border-white/20">
                <span className="font-serif font-bold text-2xl">{org.name.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-serif font-bold tracking-tight leading-tight">{org.name}</h1>
            {org.description && <p className="text-muted-foreground max-w-2xl mt-1">{org.description}</p>}
            {org.website && (
              <a href={org.website} target="_blank" rel="noreferrer" className="text-sm text-primary flex items-center gap-1 mt-2 hover:underline w-fit">
                <ExternalLink className="h-3 w-3" /> {org.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full min-w-0">
         <TabsList className="no-scrollbar mb-6 w-full min-w-0 max-w-full justify-start gap-1 overflow-x-auto overscroll-x-contain border bg-muted/50 p-1 flex-nowrap [-webkit-overflow-scrolling:touch]">
           <TabsTrigger value="overview" className="shrink-0 px-3 py-2.5 transition-colors md:px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Overview</TabsTrigger>
           <TabsTrigger value="elections" className="shrink-0 px-3 py-2.5 transition-colors md:px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Elections</TabsTrigger>
           <TabsTrigger value="events" className="shrink-0 px-3 py-2.5 transition-colors md:px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Events</TabsTrigger>
           <TabsTrigger value="campaigns" className="shrink-0 px-3 py-2.5 transition-colors md:px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Campaigns</TabsTrigger>
           <TabsTrigger value="team" className="shrink-0 px-3 py-2.5 transition-colors md:px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">Team</TabsTrigger>
           <TabsTrigger value="analytics" className="shrink-0 px-3 py-2.5 transition-colors md:px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />Analytics
          </TabsTrigger>
           <TabsTrigger value="finance" className="shrink-0 px-3 py-2.5 transition-colors md:px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Wallet className="h-3.5 w-3.5 mr-1.5" />Finance
          </TabsTrigger>
           <TabsTrigger value="settings" className="shrink-0 px-3 py-2.5 transition-colors md:px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Settings className="h-3.5 w-3.5 mr-1.5" />Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
                  <CardDescription>Latest activity across your workspace</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
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

        <TabsContent value="team" className="mt-0 focus-visible:outline-none">
          <TeamSection orgId={orgId} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0 focus-visible:outline-none">
          <AnalyticsSection orgId={orgId} />
        </TabsContent>

        <TabsContent value="finance" className="mt-0 focus-visible:outline-none">
          <FinanceSection orgId={orgId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-0 focus-visible:outline-none">
          <SettingsSection org={org} orgId={orgId} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}

function TeamSection({ orgId }: { orgId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: members, isLoading } = useListOrganizationMembers(orgId);
  const addMember = useAddOrganizationMember();
  const updateMember = useUpdateOrganizationMember();
  const removeMember = useRemoveOrganizationMember();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");

  // Determine current user's role in this org
  const currentMember = members?.find(m => m.userId === user?.id);
  const canManage = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    addMember.mutate(
      { orgId, data: { email: inviteEmail.trim(), role: inviteRole } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOrganizationMembersQueryKey(orgId) });
          setInviteEmail("");
          setInviteRole("member");
          toast({ title: "Member invited", description: `Invitation sent to ${inviteEmail.trim()}` });
        },
        onError: (error: any) => {
          const status = error?.status;
          const msg = error?.data?.error;
          if (status === 409) {
            toast({ variant: "destructive", title: "Already a member", description: msg || "This user is already a member of the organization." });
          } else if (status === 403) {
            toast({ variant: "destructive", title: "Permission denied", description: msg || "You don't have permission to invite members." });
          } else if (status === 404) {
            toast({ variant: "destructive", title: "User not found", description: msg || "No account found for that email address." });
          } else {
            toast({ variant: "destructive", title: "Invite failed", description: msg || "Could not invite member. Please try again." });
          }
        },
      }
    );
  };

  const handleRoleChange = (memberId: number, newRole: "admin" | "member") => {
    updateMember.mutate(
      { orgId, memberId, data: { role: newRole } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOrganizationMembersQueryKey(orgId) });
          toast({ title: "Role updated" });
        },
        onError: (error: any) => {
          const msg = error?.data?.error;
          toast({ variant: "destructive", title: "Update failed", description: msg || "Could not update role. Please try again." });
        },
      }
    );
  };

  const handleRemove = (memberId: number, memberName: string | null | undefined) => {
    removeMember.mutate(
      { orgId, memberId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListOrganizationMembersQueryKey(orgId) });
          toast({ title: "Member removed", description: `${memberName || "Member"} has been removed from the organization.` });
        },
        onError: (error: any) => {
          const status = error?.status;
          const msg = error?.data?.error;
          if (status === 403) {
            toast({ variant: "destructive", title: "Permission denied", description: msg || "You don't have permission to remove this member." });
          } else if (status === 404) {
            toast({ variant: "destructive", title: "Not found", description: msg || "Member not found." });
          } else {
            toast({ variant: "destructive", title: "Remove failed", description: msg || "Could not remove member. Please try again." });
          }
        },
      }
    );
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 capitalize">{role}</Badge>;
      case 'admin':
         return <Badge className="bg-primary/15 text-primary border-primary/25 dark:bg-white/10 dark:text-white dark:border-white/20 capitalize">{role}</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 text-primary dark:bg-white/10 dark:text-white rounded-lg">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-serif font-bold">Team Members</h2>
          <p className="text-sm text-muted-foreground">Manage who has access to this organization</p>
        </div>
      </div>

      {canManage && (
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-serif flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Invite a Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                  disabled={addMember.isPending}
                  className="h-10"
                />
              </div>
              <div className="sm:w-36 space-y-1">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "member")}>
                  <SelectTrigger id="invite-role" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={addMember.isPending || !inviteEmail.trim()} className="h-10">
                  {addMember.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Invite
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <InlineListLoadingSkeleton rows={4} label="Loading team members" />
      ) : !members || members.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center bg-card">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-1">No members yet</h3>
          <p className="text-muted-foreground">Invite team members to collaborate on this organization.</p>
        </div>
      ) : (
        <Card className="border-border/50">
          <div className="divide-y divide-border/50">
            {members.map(member => {
              const isOwner = member.role === 'owner';
              const isSelf = member.userId === user?.id;
              const canModify = canManage && !isOwner && !isSelf;
              return (
                <div key={member.id} className="flex items-center gap-4 p-4 hover:bg-muted/20 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary dark:bg-white/10 dark:text-white flex items-center justify-center shrink-0 font-serif font-bold">
                    {(member.name || member.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{member.name || <span className="text-muted-foreground italic">No name</span>}</div>
                    <div className="text-sm text-muted-foreground truncate">{member.email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canModify ? (
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleRoleChange(member.id, v as "admin" | "member")}
                        disabled={updateMember.isPending}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      getRoleBadge(member.role)
                    )}
                    {canModify && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemove(member.id, member.name)}
                        disabled={removeMember.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {isSelf && !isOwner && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function SettingsSection({ org, orgId }: { org: any; orgId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateOrg = useUpdateOrganization();

  const [name, setName] = useState(org.name ?? '');
  const [description, setDescription] = useState(org.description ?? '');
  const [website, setWebsite] = useState(org.website ?? '');
  const [logoUrl, setLogoUrl] = useState(org.logoUrl ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(org.coverImageUrl ?? '');
  const [heroImageUrl, setHeroImageUrl] = useState(org.heroImageUrl ?? '');
  const [accentColor, setAccentColor] = useState(org.accentColor ?? '#4F46E5');
  const [theme, setTheme] = useState<'evenum' | 'light' | 'dark'>(org.theme ?? 'evenum');

  const shareUrl = `${window.location.origin}/organizations/${orgId}/public`;

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    updateOrg.mutate(
      {
        orgId,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          website: website.trim() || undefined,
          logoUrl: logoUrl || undefined,
          coverImageUrl: coverImageUrl || undefined,
          heroImageUrl: heroImageUrl || undefined,
          accentColor,
          theme,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetOrganizationQueryKey(orgId) });
          queryClient.invalidateQueries({ queryKey: getListOrganizationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPublicOrganizationQueryKey(orgId) });
          toast({ title: 'Settings saved', description: 'Organization profile updated.' });
        },
        onError: () =>
          toast({ title: 'Save failed', description: 'Could not save settings. Please try again.', variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 text-primary dark:bg-white/10 dark:text-white rounded-lg">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-serif font-bold">Organization Settings</h2>
          <p className="text-sm text-muted-foreground">Manage identity, branding, and appearance</p>
        </div>
      </div>

      {/* Identity */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-serif">Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input id="org-name" value={name} onChange={e => setName(e.target.value)} placeholder="My Organization" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-description">Description</Label>
            <Textarea
              id="org-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Briefly describe your organization…"
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-website">Website</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="org-website"
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://yourorg.com"
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Media */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-serif">Media</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Logo</Label>
            <p className="text-xs text-muted-foreground">Square logo shown in sidebar and public profile</p>
            <ImageUpload value={logoUrl || undefined} onChange={v => setLogoUrl(v ?? '')} />
          </div>
          <div className="space-y-2">
            <Label>Cover Image</Label>
            <p className="text-xs text-muted-foreground">Wide banner used in cards and previews</p>
            <ImageUpload value={coverImageUrl || undefined} onChange={v => setCoverImageUrl(v ?? '')} />
          </div>
          <div className="space-y-2">
            <Label>Hero Image</Label>
            <p className="text-xs text-muted-foreground">Full-width background for your public organization page</p>
            <ImageUpload value={heroImageUrl || undefined} onChange={v => setHeroImageUrl(v ?? '')} />
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-serif">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Accent Color</Label>
            <p className="text-xs text-muted-foreground">Used as the primary color on voting and registration pages</p>
            <AccentColorPicker value={accentColor} onChange={setAccentColor} />
          </div>
          <div className="space-y-2">
            <Label>Theme</Label>
            <p className="text-xs text-muted-foreground">Visual theme for public-facing pages</p>
            <Select value={theme} onValueChange={v => setTheme(v as 'evenum' | 'light' | 'dark')}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evenum">Evenum (Dark Blue)</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Public Profile */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-serif">Public Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Share your organization page</p>
            <p className="text-xs text-muted-foreground mt-0.5">{shareUrl}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <a href={shareUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" /> Preview
              </a>
            </Button>
            <ShareButton url={shareUrl} title={org.name} description={org.description || undefined} variant="icon" />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateOrg.isPending} className="h-10 px-8 rounded-sm">
          {updateOrg.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>
    </div>
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
       case 'election': return <Vote className="h-4 w-4 text-primary" />;
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
        <Button asChild className="w-full sm:w-auto">
          <Link href={createLink}>
            <Plus className="mr-2 h-4 w-4" /> {createLabel}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <InlineListLoadingSkeleton rows={4} label="Loading activities" />
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
                        {item.goalAmount && <span>Goal: {formatCurrencyValue(item.goalAmount, item.currency || "XAF")}</span>}
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

function AnalyticsSection({ orgId }: { orgId: number }) {
  const { data: analytics, isLoading } = useGetOrgAnalytics(orgId, {
    query: { enabled: !!orgId, queryKey: getGetOrgAnalyticsQueryKey(orgId) },
  });

  const { i18n } = useTranslation();
  const formatCurrency = (v: number, currency = 'XAF') =>
    formatCurrencyValue(v, currency, i18n.language.startsWith("fr") ? "fr-FR" : "en-US");

  const formatPct = (v: number | null | undefined) =>
    v != null ? `${v.toFixed(1)}%` : '—';

  if (isLoading) {
    return (
      <InlineListLoadingSkeleton rows={3} label="Loading analytics" />
    );
  }

  const elections = (analytics?.elections as any[]) || [];
  const events = (analytics?.events as any[]) || [];
  const campaigns = (analytics?.campaigns as any[]) || [];

  const totalVotes = elections.reduce((s: number, e: any) => s + (e.totalVotes || 0), 0);
  const totalTickets = events.reduce((s: number, e: any) => s + (e.ticketsSold || 0), 0);
  const totalRaisedByCurrency = Array.from(campaigns.reduce((totals: Map<string, number>, campaign: any) => {
    const currency = campaign.currency || "XAF";
    totals.set(currency, (totals.get(currency) || 0) + Number(campaign.amountRaised || 0));
    return totals;
  }, new Map<string, number>()));
  // Detect dominant currency from paid elections (fall back to XAF)
  const electionCurrency = elections.find((e: any) => e.currency)?.currency || 'XAF';

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 text-primary rounded-lg">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-serif font-bold">Performance Analytics</h2>
          <p className="text-sm text-muted-foreground">Insights across elections, events, and campaigns</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
               <div className="w-9 h-9 bg-primary/10 rounded-sm flex items-center justify-center shrink-0">
                 <Vote className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-serif font-bold tabular-nums">{totalVotes.toLocaleString()}</p>
            <p className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wide">Total Votes Cast</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{elections.length} elections</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-emerald-50 rounded-sm flex items-center justify-center shrink-0">
                <CalendarDays className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-3xl font-serif font-bold tabular-nums">{totalTickets.toLocaleString()}</p>
            <p className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wide">Tickets Sold</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{events.length} events</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-amber-50 rounded-sm flex items-center justify-center shrink-0">
                <Megaphone className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <div className="text-xl font-serif font-bold tabular-nums">
              {totalRaisedByCurrency.length > 0
                ? totalRaisedByCurrency.map(([currency, amount]) => (
                    <div key={currency}>{formatCurrency(amount, currency)}</div>
                  ))
                : formatCurrency(0)}
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wide">Total Raised</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">{campaigns.length} campaigns</p>
          </CardContent>
        </Card>
      </div>

      {/* Elections analytics */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
             <Vote className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-serif">Elections</CardTitle>
          </div>
          <CardDescription>Participation and voting performance</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {elections.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">No elections yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>Election</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Total Votes</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Paid Votes</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Free Votes</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {elections.map((e: any) => (
                  <TableRow key={e.id} className="hover:bg-muted/20">
                    <TableCell>
                      <Link href={`/elections/${e.id}`} className="font-medium text-sm hover:text-primary transition-colors">{e.title}</Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`capitalize text-xs ${
                        e.status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        e.status === 'ended' ? 'bg-muted text-muted-foreground' :
                        'bg-slate-100 text-slate-800 border-slate-200'
                      }`}>{e.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">{(e.totalVotes || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm text-primary">{(e.paidVotes || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm text-muted-foreground">{(e.freeVotes || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(e.revenue || 0, e.currency || electionCurrency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Events analytics */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-emerald-600" />
            <CardTitle className="text-base font-serif">Events</CardTitle>
          </div>
          <CardDescription>Attendance, capacity utilization, and check-in rates</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">No events yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>Event</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Tickets Sold</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Capacity</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Check-in Rate</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev: any) => (
                  <TableRow key={ev.id} className="hover:bg-muted/20">
                    <TableCell>
                      <Link href={`/events/${ev.id}`} className="font-medium text-sm hover:text-primary transition-colors">{ev.title}</Link>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`capitalize text-xs ${
                        ev.status === 'published' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        ev.status === 'completed' ? 'bg-muted text-muted-foreground' :
                        'bg-slate-100 text-slate-800 border-slate-200'
                      }`}>{ev.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">{(ev.ticketsSold || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm text-muted-foreground">
                      {ev.capacity ? ev.capacity.toLocaleString() : '∞'}
                      {ev.capacityUtilization != null && (
                        <span className="ml-1 text-xs text-primary">({ev.capacityUtilization}%)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm">
                      {formatPct(ev.checkInRate)}
                      <span className="text-xs text-muted-foreground ml-1">({ev.checkedIn || 0} in)</span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(ev.revenue || 0, ev.currency || electionCurrency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Campaigns analytics */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-base font-serif">Campaigns</CardTitle>
          </div>
          <CardDescription>Fundraising progress and contribution insights</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {campaigns.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">No campaigns yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Submissions</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Contributors</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Avg. Contribution</TableHead>
                  <TableHead className="text-right">Amount Raised</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">Goal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c: any) => (
                  <TableRow key={c.id} className="hover:bg-muted/20">
                    <TableCell>
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-sm hover:text-primary transition-colors">{c.title}</Link>
                      {c.goalCompletion != null && (
                        <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden w-24">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(c.goalCompletion, 100)}%` }}
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`capitalize text-xs ${
                        c.status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        c.status === 'ended' ? 'bg-muted text-muted-foreground' :
                        'bg-slate-100 text-slate-800 border-slate-200'
                      }`}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">{(c.submissionsCount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm text-primary">{(c.paidContributors || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm">{formatCurrency(c.avgContribution || 0, c.currency || "XAF")}</TableCell>
                    <TableCell className="text-right text-sm font-medium text-primary">{formatCurrency(c.amountRaised || 0, c.currency || "XAF")}</TableCell>
                    <TableCell className="text-right hidden lg:table-cell text-sm text-muted-foreground">
                      {c.goalAmount ? formatCurrency(c.goalAmount, c.currency || "XAF") : '—'}
                      {c.goalCompletion != null && (
                        <span className="ml-1 text-xs text-primary">({c.goalCompletion.toFixed(1)}%)</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FinanceSection({ orgId }: { orgId: number }) {
  const { data: summary, isLoading: isLoadingSummary } = useGetOrgFinanceSummary(orgId, { query: { enabled: !!orgId, queryKey: getGetOrgFinanceSummaryQueryKey(orgId) } });
  const { toast } = useToast();
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const requestWithdrawal = useRequestOrgWithdrawal();
  const [payoutMethod, setPayoutMethod] = useState<"bank_transfer" | "mobile_money">("mobile_money");
  const [payoutAccount, setPayoutAccount] = useState("");
  const [withdrawalNotes, setWithdrawalNotes] = useState("");
  const [withdrawalCurrency, setWithdrawalCurrency] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalReviewOpen, setWithdrawalReviewOpen] = useState(false);
  
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const { data: transactionsData, isLoading: isLoadingTransactions } = useListOrgTransactions(
    orgId,
    { limit: 50, pillar: pillarFilter !== "all" ? pillarFilter as any : undefined },
    { query: { enabled: !!orgId, queryKey: getListOrgTransactionsQueryKey(orgId, { limit: 50, pillar: pillarFilter !== "all" ? pillarFilter as any : undefined }) } }
  );
  
  const { data: settlements, isLoading: isLoadingSettlements } = useListOrgSettlements(orgId, { query: { enabled: !!orgId, queryKey: getListOrgSettlementsQueryKey(orgId) } });

  const formatCurrency = (amount: number, currency: string = "XAF") => {
    return formatCurrencyValue(amount, currency, i18n.language.startsWith("fr") ? "fr-FR" : "en-US");
  };
  const currencyBalances = summary?.balancesByCurrency ?? [];
  const availableBalances = currencyBalances.filter((balance) => balance.availableBalance > 0);
  const selectedCurrency = availableBalances.some((balance) => balance.currency === withdrawalCurrency)
    ? withdrawalCurrency
    : availableBalances[0]?.currency ?? "";
  const selectedBalance = availableBalances.find((balance) => balance.currency === selectedCurrency);
  const requestedAmount = withdrawalAmount.trim() ? Number(withdrawalAmount) : Number.NaN;
  const withdrawalAmountIsValid = Number.isFinite(requestedAmount)
    && requestedAmount > 0
    && Math.abs(requestedAmount * 100 - Math.round(requestedAmount * 100)) < 0.000001
    && !!selectedBalance
    && requestedAmount <= selectedBalance.availableBalance;
  const remainingAfterWithdrawal = selectedBalance && withdrawalAmountIsValid
    ? Math.max(0, selectedBalance.availableBalance - requestedAmount)
    : null;
  const renderCurrencyBalances = (field: "availableBalance" | "pendingSettlementBalance" | "releasedBalance") => (
    currencyBalances.length > 0
      ? currencyBalances.map((balance) => (
          <div key={balance.currency}>{formatCurrency(balance[field], balance.currency)}</div>
        ))
      : <div>{formatCurrency(0)}</div>
  );

  const getSettlementBadge = (status: string) => {
    switch(status) {
      case 'pending_settlement': return <Badge variant="secondary" className="bg-slate-100 text-slate-800 hover:bg-slate-100">Pending</Badge>;
       case 'ready': return <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/25 hover:bg-primary/20 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/15">Ready</Badge>;
      case 'released': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Released</Badge>;
      case 'completed': return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Completed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTxStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Completed</Badge>;
      case 'refunded': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Refunded</Badge>;
      case 'disputed': return <Badge variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-100">Disputed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExport = () => {
    const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
    window.open(`${API_BASE}/api/organizations/${orgId}/finance/export`);
  };

  const handleWithdrawal = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBalance || selectedBalance.availableBalance <= 0) {
      toast({ title: "No balance available", description: "There are no earnings ready for withdrawal.", variant: "destructive" });
      return;
    }
    if (!withdrawalAmountIsValid) {
      toast({
        title: "Enter a valid withdrawal amount",
        description: `Choose an amount from 0.01 up to ${formatCurrency(selectedBalance.availableBalance, selectedCurrency)}.`,
        variant: "destructive",
      });
      return;
    }
    setWithdrawalReviewOpen(true);
  };

  const submitWithdrawalRequest = () => {
    if (!selectedBalance || !withdrawalAmountIsValid || !payoutAccount.trim()) {
      setWithdrawalReviewOpen(false);
      return;
    }
    requestWithdrawal.mutate(
      {
        orgId,
        data: {
          amount: Math.round(requestedAmount * 100) / 100,
          currency: selectedCurrency,
          payoutMethod,
          payoutAccount: payoutAccount.trim(),
          notes: withdrawalNotes.trim() || null,
        },
      },
      {
        onSuccess: (settlement) => {
          setWithdrawalReviewOpen(false);
          queryClient.invalidateQueries({ queryKey: getGetOrgFinanceSummaryQueryKey(orgId) });
          queryClient.invalidateQueries({ queryKey: getListOrgSettlementsQueryKey(orgId) });
          queryClient.invalidateQueries({ queryKey: getListOrgTransactionsQueryKey(orgId, { limit: 50, pillar: pillarFilter !== "all" ? pillarFilter as any : undefined }) });
          setPayoutAccount("");
          setWithdrawalNotes("");
          setWithdrawalAmount("");
          toast({
            title: "Withdrawal request submitted",
            description: `${formatCurrency(settlement.amount, settlement.currency)} is now being processed.`,
          });
        },
        onError: (error: any) => {
          toast({
            title: "Withdrawal request failed",
            description: error?.data?.error || "Could not submit the withdrawal request. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  if (isLoadingSummary) {
    return (
      <InlineListLoadingSkeleton rows={3} label="Loading financial summary" />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary dark:bg-white/10 dark:text-white rounded-lg">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold">Financial Operations</h2>
            <p className="text-sm text-muted-foreground">Track the amount available to your organization and settlements</p>
          </div>
        </div>
        <Button onClick={handleExport} variant="outline">
          <ArrowUpRight className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card className="border-primary/20 bg-primary/[0.03] dark:border-white/20 dark:bg-white/[0.03]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-serif">Withdraw available earnings</CardTitle>
          <CardDescription>
            Choose the amount you want to withdraw. You can leave part of your available balance for a later request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-lg border border-border/60 bg-background/70 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div>
                <div className="text-xs text-muted-foreground">Available in {selectedCurrency || "selected currency"}</div>
                <div className="mt-1 font-serif text-xl font-bold">
              {selectedBalance ? formatCurrency(selectedBalance.availableBalance, selectedCurrency) : "No available balance"}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {remainingAfterWithdrawal === null
                  ? "Enter an amount to preview your remaining balance."
                  : `${formatCurrency(remainingAfterWithdrawal, selectedCurrency)} will remain available.`}
              </div>
            </div>
          </div>
          <form onSubmit={handleWithdrawal} className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.5fr_1.5fr_auto] items-end">
            <div className="space-y-1.5">
              <Label htmlFor="withdrawal-currency">Currency</Label>
              <Select
                value={selectedCurrency}
                onValueChange={(currency) => {
                  setWithdrawalCurrency(currency);
                  setWithdrawalAmount("");
                }}
                disabled={availableBalances.length === 0 || requestWithdrawal.isPending}
              >
                <SelectTrigger id="withdrawal-currency"><SelectValue placeholder="No available balance" /></SelectTrigger>
                <SelectContent>
                  {availableBalances.map((balance) => (
                    <SelectItem key={balance.currency} value={balance.currency}>{balance.currency}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="withdrawal-amount">Amount to withdraw</Label>
              <Input
                id="withdrawal-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                max={selectedBalance?.availableBalance}
                step="0.01"
                value={withdrawalAmount}
                onChange={(event) => setWithdrawalAmount(event.target.value)}
                placeholder="Enter an amount"
                required
                disabled={!selectedBalance || requestWithdrawal.isPending}
              />
              {selectedBalance && (
                <p className="text-xs text-muted-foreground">
                  Maximum: {formatCurrency(selectedBalance.availableBalance, selectedCurrency)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-method">Payout method</Label>
              <Select value={payoutMethod} onValueChange={(value) => setPayoutMethod(value as typeof payoutMethod)}>
                <SelectTrigger id="payout-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile_money">Mobile money</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-account">{payoutMethod === "mobile_money" ? "Mobile money number" : "Bank account details"}</Label>
              <Input
                id="payout-account"
                value={payoutAccount}
                onChange={(event) => setPayoutAccount(event.target.value)}
                placeholder={payoutMethod === "mobile_money" ? "e.g. 6XXXXXXXX" : "Account name and number"}
                required
                minLength={3}
                maxLength={160}
                disabled={requestWithdrawal.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="withdrawal-notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="withdrawal-notes"
                value={withdrawalNotes}
                onChange={(event) => setWithdrawalNotes(event.target.value)}
                placeholder="Any payout instructions"
                maxLength={500}
                disabled={requestWithdrawal.isPending}
              />
            </div>
            <Button type="submit" disabled={requestWithdrawal.isPending || !selectedBalance || !payoutAccount.trim() || !withdrawalAmountIsValid}>
              {requestWithdrawal.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-2 h-4 w-4" />}
              Review payout
            </Button>
          </form>
        </CardContent>
      </Card>
      <AlertDialog open={withdrawalReviewOpen} onOpenChange={setWithdrawalReviewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm payout request</AlertDialogTitle>
            <AlertDialogDescription>
              Review the amount and destination before submitting this payout request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 rounded-md border bg-muted/30 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Amount</span>
              <strong>{formatCurrency(requestedAmount, selectedCurrency)}</strong>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Payout method</span>
              <strong>{payoutMethod === "mobile_money" ? "Mobile money" : "Bank transfer"}</strong>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">Destination</span>
              <strong className="break-all">{payoutAccount.trim()}</strong>
            </div>
            {remainingAfterWithdrawal !== null && (
              <div className="flex justify-between gap-4 border-t pt-3">
                <span className="text-muted-foreground">Remaining available balance</span>
                <strong>{formatCurrency(remainingAfterWithdrawal, selectedCurrency)}</strong>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Evenum does not calculate payout-provider fees here. Your bank or mobile-money provider may charge separately.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={requestWithdrawal.isPending}>Back to form</AlertDialogCancel>
            <AlertDialogAction
              disabled={requestWithdrawal.isPending || !withdrawalAmountIsValid || !payoutAccount.trim()}
              onClick={submitWithdrawalRequest}
            >
              {requestWithdrawal.isPending ? "Submitting…" : "Submit payout request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-primary/20 shadow-sm bg-primary/5 dark:border-white/20 dark:bg-white/5">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-xs font-medium text-primary flex items-center justify-between">
              Amount available <TrendingUp className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xl font-serif font-bold text-primary">{renderCurrencyBalances("availableBalance")}</div>
            <p className="text-xs text-muted-foreground mt-1">Available to withdraw, shown by currency</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Pending settlement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xl font-serif font-bold">{renderCurrencyBalances("pendingSettlementBalance")}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Released Balance <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xl font-serif font-bold">{renderCurrencyBalances("releasedBalance")}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <div>
              <CardTitle className="text-base font-serif">Amount history</CardTitle>
              <CardDescription>Amounts received by your organization</CardDescription>
              </div>
              <Select value={pillarFilter} onValueChange={setPillarFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Pillars" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pillars</SelectItem>
                  <SelectItem value="event">Events</SelectItem>
                  <SelectItem value="election">Elections</SelectItem>
                  <SelectItem value="campaign">Campaigns</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingTransactions ? (
                <Table>
                  <TableBody>
                    {[0, 1, 2, 3].map((row) => (
                      <TableRow key={row}>
                        {[0, 1, 2, 3].map((cell) => (
                          <TableCell key={cell}><Skeleton className="h-4 w-full max-w-32" /></TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : !transactionsData?.transactions?.length ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-3 opacity-20" />
                  <p>No transactions found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>Date</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Amount received</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsData.transactions.map((tx: any) => (
                      <TableRow key={tx.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="text-xs">
                          {format(new Date(tx.createdAt), 'MMM d, h:mm a')}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{tx.entityTitle}</div>
                          <div className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                            {tx.pillar} • {tx.transactionType.replace('_', ' ')}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-primary text-sm">{formatCurrency(tx.orgEarnings, tx.currency)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            {getTxStatusBadge(tx.status)}
                            {tx.status === 'completed' && <span className="text-[10px] text-muted-foreground capitalize">{tx.settlementStatus.replace('_', ' ')}</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-serif">Settlement History</CardTitle>
              <CardDescription>Payouts to your bank account</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingSettlements ? (
                <Table>
                  <TableBody>
                    {[0, 1, 2].map((row) => (
                      <TableRow key={row}>
                        {[0, 1, 2].map((cell) => (
                          <TableCell key={cell}><Skeleton className="h-4 w-full max-w-24" /></TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : !settlements?.length ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No settlements yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlements.map((s: any) => (
                      <TableRow key={s.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="text-xs">
                          {format(new Date(s.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {formatCurrency(s.amount, s.currency)}
                          <div className="text-[10px] text-muted-foreground font-normal">{s.transactionCount} txns</div>
                        </TableCell>
                        <TableCell>
                          {getSettlementBadge(s.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
