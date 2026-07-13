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
import { format } from 'date-fns';
import {
  Users, Building2, Vote, CalendarDays, Megaphone,
  ShieldCheck, Trash2, Loader2, ShieldOff, Shield, Search, X,
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
    return orgs.filter((o) =>
      o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q)
    );
  }, [orgs, orgSearch]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter((u) =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const deleteUser = useMutation({
    mutationFn: (id: number) =>
      customFetch(`${API_BASE}/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast({ title: 'User removed', description: 'The user account has been deleted.' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || 'Failed to delete user' }),
  });

  const deleteOrg = useMutation({
    mutationFn: (id: number) =>
      customFetch(`${API_BASE}/api/admin/organizations/${id}`, { method: 'DELETE' }),
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
    mutationFn: () =>
      customFetch(`${API_BASE}/api/admin/bootstrap`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: 'Welcome, Administrator', description: 'You now have platform admin access.' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Access denied', description: e?.data?.error || 'Bootstrap failed' }),
  });

  // While auth is loading, show a minimal spinner inside the layout shell
  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      </DashboardLayout>
    );
  }

  // Authenticated but not yet admin — offer bootstrap or explain denial
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
                      organizations, users, and content. This is only possible when no other admin
                      exists.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => bootstrap.mutate()}
                      disabled={bootstrap.isPending}
                    >
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

  const statCards = [
    { label: 'Users', value: stats?.total_users, icon: Users, sub: `+${stats?.new_users_7d ?? 0} this week` },
    { label: 'Organizations', value: stats?.total_organizations, icon: Building2, sub: `+${stats?.new_orgs_7d ?? 0} this week` },
    { label: 'Elections', value: stats?.total_elections, icon: Vote, sub: 'all time' },
    { label: 'Events', value: stats?.total_events, icon: CalendarDays, sub: 'all time' },
    { label: 'Campaigns', value: stats?.total_campaigns, icon: Megaphone, sub: 'all time' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold">Platform Admin</h1>
            <p className="text-sm text-muted-foreground">Full visibility across all organizations and users</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map(({ label, value, icon: Icon, sub }) => (
            <Card key={label} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
                  <Icon className="h-4 w-4 text-muted-foreground/60" />
                </div>
                <p className="text-3xl font-serif font-bold">
                  {statsLoading
                    ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
                    : (value ?? '—')
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tables */}
        <Tabs defaultValue="organizations">
          <TabsList>
            <TabsTrigger value="organizations">
              Organizations {orgs && <span className="ml-1.5 text-xs text-muted-foreground">({orgs.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="users">
              Users {users && <span className="ml-1.5 text-xs text-muted-foreground">({users.length})</span>}
            </TabsTrigger>
          </TabsList>

          {/* Organizations Tab */}
          <TabsContent value="organizations" className="mt-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-serif">All Organizations</CardTitle>
                    <CardDescription>Every organization on the platform.</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search by name or slug…"
                      value={orgSearch}
                      onChange={(e) => setOrgSearch(e.target.value)}
                      className="pl-9 pr-8"
                    />
                    {orgSearch && (
                      <button
                        onClick={() => setOrgSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {orgsLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary/50" /></div>
                ) : filteredOrgs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <Building2 className="h-10 w-10 mb-3 opacity-30" />
                    <p className="font-medium">
                      {orgSearch ? `No organizations match "${orgSearch}"` : 'No organizations yet'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Slug</TableHead>
                        <TableHead className="text-center">Members</TableHead>
                        <TableHead className="text-center hidden md:table-cell">Elections</TableHead>
                        <TableHead className="text-center hidden md:table-cell">Events</TableHead>
                        <TableHead className="text-center hidden md:table-cell">Campaigns</TableHead>
                        <TableHead className="hidden lg:table-cell">Created</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrgs.map((org) => (
                        <TableRow key={org.id}>
                          <TableCell className="font-medium">{org.name}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-sm font-mono">{org.slug}</TableCell>
                          <TableCell className="text-center">{org.member_count}</TableCell>
                          <TableCell className="text-center hidden md:table-cell">{org.election_count}</TableCell>
                          <TableCell className="text-center hidden md:table-cell">{org.event_count}</TableCell>
                          <TableCell className="text-center hidden md:table-cell">{org.campaign_count}</TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                            {format(new Date(org.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
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

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-serif">All Users</CardTitle>
                    <CardDescription>Everyone registered on the platform.</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search by name or email…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 pr-8"
                    />
                    {userSearch && (
                      <button
                        onClick={() => setUserSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary/50" /></div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                    <Users className="h-10 w-10 mb-3 opacity-30" />
                    <p className="font-medium">
                      {userSearch ? `No users match "${userSearch}"` : 'No users registered yet'}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Email</TableHead>
                        <TableHead className="text-center">Orgs</TableHead>
                        <TableHead className="hidden md:table-cell">Role</TableHead>
                        <TableHead className="hidden lg:table-cell">Joined</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id} className={u.id === user?.id ? 'bg-primary/5' : ''}>
                          <TableCell className="font-medium">
                            {u.name}
                            {u.id === user?.id && (
                              <span className="ml-2 text-xs text-muted-foreground font-normal">(you)</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{u.email}</TableCell>
                          <TableCell className="text-center">{u.org_count}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {u.is_platform_admin
                              ? <Badge variant="default" className="gap-1 text-xs"><ShieldCheck className="h-3 w-3" /> Admin</Badge>
                              : <Badge variant="outline" className="text-xs">User</Badge>
                            }
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                            {format(new Date(u.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            {u.id !== user?.id && (
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-8 w-8 ${u.is_platform_admin ? 'text-primary hover:text-muted-foreground' : 'text-muted-foreground hover:text-primary'}`}
                                  title={u.is_platform_admin ? 'Remove admin access' : 'Grant admin access'}
                                  onClick={() => toggleAdmin.mutate({ id: u.id, isPlatformAdmin: !u.is_platform_admin })}
                                  disabled={toggleAdmin.isPending}
                                >
                                  {u.is_platform_admin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
      </div>
    </DashboardLayout>
  );
}
