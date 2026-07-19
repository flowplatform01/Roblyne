import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetMeQueryKey } from '@workspace/api-client-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Users, Building2, Vote, CalendarDays, Megaphone,
  ShieldCheck, Trash2, Loader2, ShieldOff, Shield, Search, X,
  TrendingUp, Activity, AlertCircle, BarChart3
} from 'lucide-react';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => customFetch<Record<string, number>>(`${API_BASE}/api/admin/stats`),
  });
}

function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => customFetch<any[]>(`${API_BASE}/api/admin/users`),
  });
}

function useAdminOrgs() {
  return useQuery({
    queryKey: ['admin', 'organizations'],
    queryFn: () => customFetch<any[]>(`${API_BASE}/api/admin/organizations`),
  });
}

export default function AdminDashboard() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [orgSearch, setOrgSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const { data: orgs, isLoading: orgsLoading } = useAdminOrgs();

  const filteredOrgs = useMemo(() => {
    if (!orgs) return [];
    const q = orgSearch.toLowerCase().trim();
    if (!q) return orgs;
    return orgs.filter((o: any) =>
      o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)
    );
  }, [orgs, orgSearch]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u: any) =>
      u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const deleteUser = useMutation({
    mutationFn: (id: number) => customFetch(`${API_BASE}/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast({ title: 'User removed', description: 'The user account has been deleted.' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || 'Failed to delete user' }),
  });

  const deleteOrg = useMutation({
    mutationFn: (id: number) => customFetch(`${API_BASE}/api/admin/organizations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast({ title: 'Organization deleted', description: 'The organization and all its content has been removed.' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || 'Failed to delete organization' }),
  });

  const toggleAdmin = useMutation({
    mutationFn: ({ id, isPlatformAdmin }: { id: number; isPlatformAdmin: boolean }) =>
      customFetch(`${API_BASE}/api/admin/users/${id}/platform-admin`, {
        method: 'PATCH',
        body: JSON.stringify({ isPlatformAdmin }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast({ title: vars.isPlatformAdmin ? 'Admin access granted' : 'Admin access removed' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || 'Failed to update' }),
  });

  const bootstrap = useMutation({
    mutationFn: () => customFetch(`${API_BASE}/api/admin/bootstrap`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: 'Welcome, Administrator', description: 'You now have platform admin access.' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Access denied', description: e?.data?.error || 'Bootstrap failed' }),
  });

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      </DashboardLayout>
    );
  }

  if (isAuthenticated && !user?.isPlatformAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto mt-24 text-center space-y-6 px-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold">Platform Administration</h1>
            <p className="text-muted-foreground mt-2">
              This area is restricted to platform administrators.
            </p>
          </div>
          <Card className="text-left border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-serif">Claim Administrator Access</CardTitle>
              <CardDescription>
                If no platform administrator exists yet, you can claim that role now. This option
                disappears permanently once any administrator is registered.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full">
                    <Shield className="mr-2 h-4 w-4" />
                    Claim Admin Access
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Become Platform Administrator?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This grants your account full platform admin privileges — visibility into all
                      organizations, users, and content. This is only possible when no other admin exists.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => bootstrap.mutate()} disabled={bootstrap.isPending}>
                      {bootstrap.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Yes, make me admin
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const kpiCards = [
    {
      label: 'Total Users',
      value: stats?.total_users,
      sub: `+${stats?.new_users_7d ?? 0} this week`,
      icon: Users,
      accent: 'text-blue-600',
      bg: 'bg-blue-50',
      trend: (stats?.new_users_7d ?? 0) > 0,
    },
    {
      label: 'Organizations',
      value: stats?.total_organizations,
      sub: `+${stats?.new_orgs_7d ?? 0} this week`,
      icon: Building2,
      accent: 'text-violet-600',
      bg: 'bg-violet-50',
      trend: (stats?.new_orgs_7d ?? 0) > 0,
    },
    {
      label: 'Elections',
      value: stats?.total_elections,
      sub: 'all time',
      icon: Vote,
      accent: 'text-primary',
      bg: 'bg-primary/5',
      trend: false,
    },
    {
      label: 'Events',
      value: stats?.total_events,
      sub: 'all time',
      icon: CalendarDays,
      accent: 'text-emerald-600',
      bg: 'bg-emerald-50',
      trend: false,
    },
    {
      label: 'Campaigns',
      value: stats?.total_campaigns,
      sub: 'all time',
      icon: Megaphone,
      accent: 'text-amber-600',
      bg: 'bg-amber-50',
      trend: false,
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Command center header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-sm bg-foreground flex items-center justify-center shrink-0 shadow-md">
              <ShieldCheck className="h-6 w-6 text-background" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-2xl font-serif font-bold">Platform Admin</h1>
                <Badge variant="outline" className="text-xs font-bold uppercase tracking-widest border-primary/40 text-primary">
                  Command Center
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Full operational visibility across all organizations, users, and content
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/50 px-4 py-2 rounded-sm">
            <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
            System Operational
          </div>
        </div>

        {/* Platform KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpiCards.map(({ label, value, icon: Icon, sub, accent, bg, trend }) => (
            <Card key={label} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 ${bg} rounded-sm flex items-center justify-center`}>
                    <Icon className={`h-4.5 w-4.5 ${accent}`} />
                  </div>
                  {trend && (
                    <div className="flex items-center gap-1 text-emerald-600">
                      <TrendingUp className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <p className="text-3xl font-serif font-bold tabular-nums">
                  {statsLoading
                    ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40 inline-block" />
                    : (value ?? '—')}
                </p>
                <p className="text-xs font-medium text-muted-foreground mt-1 uppercase tracking-wide">{label}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Data tables */}
        <Tabs defaultValue="organizations">
          <TabsList className="mb-1">
            <TabsTrigger value="organizations" className="gap-2">
              <Building2 className="h-3.5 w-3.5" />
              Organizations
              {orgs && <span className="ml-1 text-xs opacity-60">({orgs.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-3.5 w-3.5" />
              Users
              {users && <span className="ml-1 text-xs opacity-60">({users.length})</span>}
            </TabsTrigger>
          </TabsList>

          {/* Organizations */}
          <TabsContent value="organizations" className="mt-4">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base font-serif">All Organizations</CardTitle>
                    </div>
                    <CardDescription className="mt-0.5">Every organization registered on the platform.</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search by name or slug…"
                      value={orgSearch}
                      onChange={(e) => setOrgSearch(e.target.value)}
                      className="pl-9 pr-8 h-9 text-sm"
                    />
                    {orgSearch && (
                      <button onClick={() => setOrgSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {orgsLoading ? (
                  <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary/50" /></div>
                ) : filteredOrgs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-14 text-center text-muted-foreground">
                    <Building2 className="h-10 w-10 mb-3 opacity-20" />
                    <p className="font-medium">{orgSearch ? `No organizations match "${orgSearch}"` : 'No organizations yet'}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="font-bold">Organization</TableHead>
                        <TableHead className="text-center hidden md:table-cell font-bold">Members</TableHead>
                        <TableHead className="text-center hidden md:table-cell font-bold">Elections</TableHead>
                        <TableHead className="text-center hidden md:table-cell font-bold">Events</TableHead>
                        <TableHead className="text-center hidden md:table-cell font-bold">Campaigns</TableHead>
                        <TableHead className="hidden lg:table-cell font-bold">Created</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrgs.map((org: any) => (
                        <TableRow key={org.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-sm bg-primary/10 text-primary flex items-center justify-center shrink-0 font-serif font-bold text-sm border border-primary/20">
                                {org.name?.charAt(0) || '?'}
                              </div>
                              <div>
                                <p className="font-medium">{org.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center hidden md:table-cell">
                            <span className="font-bold">{org.member_count}</span>
                          </TableCell>
                          <TableCell className="text-center hidden md:table-cell">{org.election_count}</TableCell>
                          <TableCell className="text-center hidden md:table-cell">{org.event_count}</TableCell>
                          <TableCell className="text-center hidden md:table-cell">{org.campaign_count}</TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            <div>{format(new Date(org.created_at), 'MMM d, yyyy')}</div>
                            <div className="text-xs opacity-60">{formatDistanceToNow(new Date(org.created_at), { addSuffix: true })}</div>
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{org.name}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This permanently deletes the organization and all its elections, events, and campaigns. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteOrg.mutate(org.id)}
                                  >
                                    Delete Organization
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users */}
          <TabsContent value="users" className="mt-4">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base font-serif">All Users</CardTitle>
                    </div>
                    <CardDescription className="mt-0.5">Everyone registered on the platform.</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search by name or email…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 pr-8 h-9 text-sm"
                    />
                    {userSearch && (
                      <button onClick={() => setUserSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary/50" /></div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-14 text-center text-muted-foreground">
                    <Users className="h-10 w-10 mb-3 opacity-20" />
                    <p className="font-medium">{userSearch ? `No users match "${userSearch}"` : 'No users registered yet'}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        <TableHead className="font-bold">User</TableHead>
                        <TableHead className="text-center hidden md:table-cell font-bold">Orgs</TableHead>
                        <TableHead className="hidden md:table-cell font-bold">Role</TableHead>
                        <TableHead className="hidden lg:table-cell font-bold">Joined</TableHead>
                        <TableHead className="w-24 text-right font-bold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u: any) => (
                        <TableRow key={u.id} className={`hover:bg-muted/20 transition-colors ${u.id === user?.id ? 'bg-primary/[0.03]' : ''}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm border ${
                                u.is_platform_admin
                                  ? 'bg-primary/10 text-primary border-primary/20'
                                  : 'bg-muted text-muted-foreground border-border/50'
                              }`}>
                                {(u.name || u.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{u.name}</p>
                                  {u.id === user?.id && (
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm">You</span>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center hidden md:table-cell">
                            <span className="font-bold">{u.org_count}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {u.is_platform_admin
                              ? (
                                <div className="flex items-center gap-1.5">
                                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                  <span className="text-xs font-bold text-primary uppercase tracking-wide">Admin</span>
                                </div>
                              )
                              : <span className="text-xs text-muted-foreground">User</span>
                            }
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            <div>{format(new Date(u.created_at), 'MMM d, yyyy')}</div>
                            <div className="text-xs opacity-60">{formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</div>
                          </TableCell>
                          <TableCell>
                            {u.id !== user?.id && (
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-8 w-8 ${u.is_platform_admin ? 'text-primary hover:text-muted-foreground hover:bg-muted' : 'text-muted-foreground/50 hover:text-primary hover:bg-primary/10'}`}
                                  title={u.is_platform_admin ? 'Remove admin access' : 'Grant admin access'}
                                  onClick={() => toggleAdmin.mutate({ id: u.id, isPlatformAdmin: !u.is_platform_admin })}
                                  disabled={toggleAdmin.isPending}
                                >
                                  {u.is_platform_admin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete "{u.name}"?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This permanently deletes this account. This cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => deleteUser.mutate(u.id)}
                                      >
                                        Delete User
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Platform health notice */}
        <div className="flex items-center gap-3 p-4 bg-muted/30 border border-border/40 rounded-sm text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          <span>
            Administrative actions are permanent. Deleting organizations or users cannot be undone.
            Grant admin access only to trusted team members.
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}
