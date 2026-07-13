import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@workspace/api-client-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Users, Building2, Vote, CalendarDays, Megaphone, TrendingUp,
  ShieldCheck, Trash2, Loader2, ShieldOff, Shield
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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: users, isLoading: usersLoading } = useAdminUsers();
  const { data: orgs, isLoading: orgsLoading } = useAdminOrgs();

  const deleteUser = useMutation({
    mutationFn: (id: number) =>
      customFetch(`${API_BASE}/api/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast({ title: 'User deleted' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || 'Failed to delete user' }),
  });

  const deleteOrg = useMutation({
    mutationFn: (id: number) =>
      customFetch(`${API_BASE}/api/admin/organizations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      toast({ title: 'Organization deleted' });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast({ title: 'Admin status updated' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || 'Failed to update' }),
  });

  if (authLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated || !user?.isPlatformAdmin) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
          <ShieldCheck className="h-12 w-12 text-muted-foreground/40" />
          <h1 className="text-2xl font-serif font-bold">Access Denied</h1>
          <p className="text-muted-foreground">Platform admin access required.</p>
          <Button onClick={() => setLocation('/dashboard')}>Back to Dashboard</Button>
        </div>
      </Layout>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.total_users, icon: Users, sub: `+${stats?.new_users_7d ?? 0} this week` },
    { label: 'Organizations', value: stats?.total_organizations, icon: Building2, sub: `+${stats?.new_orgs_7d ?? 0} this week` },
    { label: 'Elections', value: stats?.total_elections, icon: Vote, sub: 'all time' },
    { label: 'Events', value: stats?.total_events, icon: CalendarDays, sub: 'all time' },
    { label: 'Campaigns', value: stats?.total_campaigns, icon: Megaphone, sub: 'all time' },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center">
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
                  {statsLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" /> : (value ?? '—')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tables */}
        <Tabs defaultValue="organizations">
          <TabsList>
            <TabsTrigger value="organizations">Organizations</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          {/* Organizations Tab */}
          <TabsContent value="organizations" className="mt-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-serif">All Organizations</CardTitle>
                <CardDescription>Every organization on the platform.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {orgsLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary/50" /></div>
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
                      {orgs?.map((org) => (
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
                                    This will permanently delete the organization and all its elections, events, and campaigns. This cannot be undone.
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
                <CardTitle className="text-base font-serif">All Users</CardTitle>
                <CardDescription>Everyone registered on the platform.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary/50" /></div>
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
                      {users?.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.name}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{u.email}</TableCell>
                          <TableCell className="text-center">{u.org_count}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {u.is_platform_admin
                              ? <Badge variant="default" className="gap-1"><ShieldCheck className="h-3 w-3" /> Platform Admin</Badge>
                              : <Badge variant="outline">User</Badge>
                            }
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                            {format(new Date(u.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 justify-end">
                              {/* Toggle admin (can't toggle self) */}
                              {u.id !== user.id && (
                                <Button
                                  variant="ghost" size="icon"
                                  className={`h-8 w-8 ${u.is_platform_admin ? 'text-primary hover:text-muted-foreground' : 'text-muted-foreground hover:text-primary'}`}
                                  title={u.is_platform_admin ? 'Remove platform admin' : 'Make platform admin'}
                                  onClick={() => toggleAdmin.mutate({ id: u.id, isPlatformAdmin: !u.is_platform_admin })}
                                >
                                  {u.is_platform_admin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                                </Button>
                              )}
                              {/* Delete (can't delete self) */}
                              {u.id !== user.id && (
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
                                        This will permanently delete this user account. This cannot be undone.
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
                              )}
                            </div>
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
    </Layout>
  );
}
