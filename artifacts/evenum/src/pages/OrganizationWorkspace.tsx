import React, { useState } from 'react';
import { useRoute, Link } from "wouter";
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
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Users, Vote, CalendarDays, Megaphone, ArrowRight, ExternalLink, Trash2, Shield, UserCheck, Settings, Save, Globe } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { AccentColorPicker } from "@/components/branding/AccentColorPicker";
import { ShareButton } from "@/components/branding/ShareButton";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function OrganizationWorkspace() {
  const [match, params] = useRoute("/organizations/:id");
  const orgId = params?.id ? parseInt(params.id, 10) : 0;
  
  const [activeTab, setActiveTab] = useState("overview");
  
  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'elections', 'events', 'campaigns', 'team', 'settings'].includes(tab)) {
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
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="w-16 h-16 rounded bg-muted object-cover border border-border/60" />
            ) : (
              <div className="w-16 h-16 rounded bg-primary/10 text-primary flex items-center justify-center border border-border/30">
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

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-8 bg-muted/50 p-1 w-full justify-start h-auto border flex-wrap">
          <TabsTrigger value="overview" className="px-4 md:px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 md:flex-none">Overview</TabsTrigger>
          <TabsTrigger value="elections" className="px-4 md:px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 md:flex-none">Elections</TabsTrigger>
          <TabsTrigger value="events" className="px-4 md:px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 md:flex-none">Events</TabsTrigger>
          <TabsTrigger value="campaigns" className="px-4 md:px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 md:flex-none">Campaigns</TabsTrigger>
          <TabsTrigger value="team" className="px-4 md:px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 md:flex-none">Team</TabsTrigger>
          <TabsTrigger value="settings" className="px-4 md:px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 md:flex-none">
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
                  <CardDescription>Latest items across your engines</CardDescription>
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
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 capitalize">{role}</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 text-primary rounded-lg">
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
        <div className="flex items-center justify-center h-48 border rounded-xl bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
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
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-serif font-bold">
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
        <div className="p-2 bg-primary/10 text-primary rounded-lg">
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
        <Button asChild className="w-full sm:w-auto">
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
