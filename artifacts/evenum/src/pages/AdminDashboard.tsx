import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  customFetch, 
  getGetMeQueryKey,
  useGetAdminFinanceStats,
  useListAdminTransactions,
  useListAdminSettlements,
  useListOrgBalances,
  useListCommissionConfigs,
  getListAdminTransactionsQueryKey,
  getListAdminSettlementsQueryKey,
  getListOrgBalancesQueryKey,
  getListCommissionConfigsQueryKey,
  getGetAdminFinanceStatsQueryKey
} from '@workspace/api-client-react';
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
  TrendingUp, Activity, AlertCircle, BarChart3, Coins, Receipt, Wallet, CheckCircle2, ArrowRight, Settings, Plus
} from 'lucide-react';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import { formatCurrency as formatCurrencyValue } from '@/lib/currency';
import { AdminLoadingSkeleton } from '@/components/loading/LoadingStates';
import { Skeleton } from '@/components/ui/skeleton';
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
  const { t } = useTranslation();
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
        <AdminLoadingSkeleton />
      </DashboardLayout>
    );
  }

  if (isAuthenticated && !user?.isPlatformAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto mt-24 text-center space-y-6 px-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 dark:bg-white/10 flex items-center justify-center mx-auto">
            <ShieldCheck className="h-8 w-8 text-primary dark:text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold">{t("admin.platformAdmin")}</h1>
            <p className="text-muted-foreground mt-2">
              {t("admin.restricted")}
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
      label: t("admin.totalUsers"),
      value: stats?.total_users,
      sub: t("admin.thisWeek", { count: stats?.new_users_7d ?? 0 }),
      icon: Users,
      accent: 'text-primary',
      bg: 'bg-primary/10 dark:bg-white/10',
      trend: (stats?.new_users_7d ?? 0) > 0,
    },
    {
      label: t("admin.organizations"),
      value: stats?.total_organizations,
      sub: t("admin.thisWeek", { count: stats?.new_orgs_7d ?? 0 }),
      icon: Building2,
      accent: 'text-violet-600',
      bg: 'bg-violet-50',
      trend: (stats?.new_orgs_7d ?? 0) > 0,
    },
    {
      label: t("admin.elections"),
      value: stats?.total_elections,
      sub: t("admin.allTime"),
      icon: Vote,
      accent: 'text-primary',
      bg: 'bg-primary/5 dark:bg-white/5',
      trend: false,
    },
    {
      label: t("admin.events"),
      value: stats?.total_events,
      sub: t("admin.allTime"),
      icon: CalendarDays,
      accent: 'text-emerald-600',
      bg: 'bg-emerald-50',
      trend: false,
    },
    {
      label: t("admin.campaigns"),
      value: stats?.total_campaigns,
      sub: t("admin.allTime"),
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
            <div className="h-12 w-12 rounded-sm bg-[#0A1628] flex items-center justify-center shrink-0 shadow-md">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-2xl font-serif font-bold">{t("admin.platformAdmin")}</h1>
                <Badge variant="outline" className="text-xs font-bold uppercase tracking-widest border-primary/40 text-primary dark:border-white/40 dark:text-white">
                  {t("admin.commandCenter")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Full operational visibility across all organizations, users, and content
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 border border-border/50 px-4 py-2 rounded-sm">
            <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
            {t("admin.dataConnected")}
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
                    ? <Skeleton className="h-9 w-20" />
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
          <TabsList className="mb-1 w-full justify-start overflow-x-auto scrollbar-none flex-nowrap">
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
            <TabsTrigger value="finance" className="gap-2">
              <Coins className="h-3.5 w-3.5" />
              Finance
            </TabsTrigger>
            <TabsTrigger value="governance" className="gap-2">
              <Settings className="h-3.5 w-3.5" />
              {t("admin.participation")}
            </TabsTrigger>
            <TabsTrigger value="operations" className="gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("admin.supportTitle")}
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
                      <CardTitle className="text-base font-serif">{t("admin.allOrganizations")}</CardTitle>
                    </div>
                    <CardDescription className="mt-0.5">{t("admin.allOrganizationsDescription")}</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder={t("admin.searchOrganizations")}
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
                  <Table>
                    <TableBody>
                      {[0, 1, 2, 3, 4].map((row) => (
                        <TableRow key={row}>
                          {[0, 1, 2, 3, 4, 5, 6].map((cell) => (
                            <TableCell key={cell}><Skeleton className="h-4 w-full max-w-28" /></TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                              <div className="w-8 h-8 rounded-sm bg-primary/10 text-primary dark:bg-white/10 dark:text-white flex items-center justify-center shrink-0 font-serif font-bold text-sm border border-primary/20 dark:border-white/20">
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
                                    This permanently deletes the organization and its content. Deletion is blocked when financial, ticket, vote, or campaign-response history exists, so those records are not erased.
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
                      <CardTitle className="text-base font-serif">{t("admin.allUsers")}</CardTitle>
                    </div>
                    <CardDescription className="mt-0.5">{t("admin.allUsersDescription")}</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder={t("admin.searchUsers")}
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
                  <Table>
                    <TableBody>
                      {[0, 1, 2, 3, 4].map((row) => (
                        <TableRow key={row}>
                          {[0, 1, 2, 3, 4].map((cell) => (
                            <TableCell key={cell}><Skeleton className="h-4 w-full max-w-28" /></TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
                                   ? 'bg-primary/10 text-primary border-primary/20 dark:bg-white/10 dark:text-white dark:border-white/20'
                                  : 'bg-muted text-muted-foreground border-border/50'
                              }`}>
                                {(u.name || u.email || '?').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{u.name}</p>
                                  {u.id === user?.id && (
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 dark:text-white dark:bg-white/10 px-1.5 py-0.5 rounded-sm">You</span>
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
                                   className={`h-8 w-8 ${u.is_platform_admin ? 'text-primary hover:text-muted-foreground hover:bg-muted' : 'text-muted-foreground/50 hover:text-primary dark:hover:text-white hover:bg-primary/10 dark:hover:bg-white/10'}`}
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
          <TabsContent value="finance" className="mt-4">
            <FinanceAdminSection />
          </TabsContent>
          <TabsContent value="governance" className="mt-4">
            <ParticipationGovernance />
          </TabsContent>
          <TabsContent value="operations" className="mt-4">
            <PlatformSupportSection />
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

function ParticipationGovernance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'platform-settings'],
    queryFn: () => customFetch<any>(`${API_BASE}/api/admin/platform-settings`),
  });
  const [mode, setMode] = useState<'quantity_first' | 'amount_first'>('quantity_first');
  React.useEffect(() => {
    if (settings?.paymentMode === 'amount_first' || settings?.paymentMode === 'quantity_first') {
      setMode(settings.paymentMode);
    }
  }, [settings]);
  const save = useMutation({
    mutationFn: () => customFetch(`${API_BASE}/api/admin/platform-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMode: mode }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'platform-settings'] });
      toast({ title: 'Participation settings saved', description: 'All paid elections now use this payment experience.' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Save failed', description: e?.data?.error || 'Could not save settings.' }),
  });

  return (
    <Card className="border-border/50 shadow-sm max-w-3xl">
      <CardHeader>
        <CardTitle className="font-serif">Participation governance</CardTitle>
        <CardDescription>Control the payment experience consistently across every paid election. Organizations cannot override this setting.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-sm border border-primary/20 bg-primary/5 dark:border-white/20 dark:bg-white/5 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-primary dark:text-white mb-1">Operational currency</p>
          <p className="font-serif text-2xl font-bold">XAF</p>
          <p className="text-sm text-muted-foreground mt-1">XAF is the active platform currency for payment screens, summaries, receipts, and financial reporting.</p>
        </div>
        <div className="space-y-3">
          <Label className="text-base font-medium">Paid voting experience</Label>
          <Select value={mode} onValueChange={(value: 'quantity_first' | 'amount_first') => setMode(value)}>
            <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="quantity_first">Quantity first — participant chooses votes</SelectItem>
              <SelectItem value="amount_first">Amount first — participant chooses contribution</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {mode === 'quantity_first'
              ? 'Participants choose a vote quantity and immediately see the XAF total.'
              : 'Participants enter an XAF amount and immediately see the voting entitlement.'}
          </p>
        </div>
        <Button onClick={() => save.mutate()} disabled={isLoading || save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save governance settings
        </Button>
      </CardContent>
    </Card>
  );
}

function PlatformSupportSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin', 'platform-settings'],
    queryFn: () => customFetch<any>(`${API_BASE}/api/admin/platform-settings`),
  });
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [supportWhatsapp, setSupportWhatsapp] = useState("");
  const [supportUrl, setSupportUrl] = useState("");

  React.useEffect(() => {
    if (!settings) return;
    setSupportEmail(settings.supportEmail || "");
    setSupportPhone(settings.supportPhone || "");
    setSupportWhatsapp(settings.supportWhatsapp || "");
    setSupportUrl(settings.supportUrl || "");
  }, [settings]);

  const save = useMutation({
    mutationFn: () => customFetch(`${API_BASE}/api/admin/platform-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supportEmail, supportPhone, supportWhatsapp, supportUrl }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'platform-settings'] });
      queryClient.invalidateQueries({ queryKey: ['platform-settings', 'public'] });
      toast({ title: t("admin.supportSaved"), description: t("admin.supportSaveDescription") });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: t("admin.saveFailed"), description: e?.data?.error || t("common.tryAgain") }),
  });

  return (
    <Card className="border-border/50 shadow-sm max-w-3xl">
      <CardHeader>
        <CardTitle className="font-serif">{t("admin.supportTitle")}</CardTitle>
        <CardDescription>{t("admin.supportDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {[0, 1, 2, 3].map((field) => (
              <div key={field} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="support-email">{t("admin.supportEmail")}</Label>
                <Input id="support-email" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder={t("admin.supportEmailPlaceholder")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="support-phone">{t("admin.supportPhone")}</Label>
                <Input id="support-phone" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder={t("admin.supportPhonePlaceholder")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="support-whatsapp">{t("admin.supportWhatsapp")}</Label>
                <Input id="support-whatsapp" value={supportWhatsapp} onChange={(e) => setSupportWhatsapp(e.target.value)} placeholder={t("admin.supportWhatsappPlaceholder")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="support-url">{t("admin.supportUrl")}</Label>
                <Input id="support-url" type="url" value={supportUrl} onChange={(e) => setSupportUrl(e.target.value)} placeholder={t("admin.supportUrlPlaceholder")} />
              </div>
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.saveSupport")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FinanceAdminSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  const { data: stats, isLoading: isLoadingStats } = useGetAdminFinanceStats({ query: { queryKey: getGetAdminFinanceStatsQueryKey() } });
  
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const [trendCurrency, setTrendCurrency] = useState("");
  const { data: transactionsData, isLoading: isLoadingTransactions } = useListAdminTransactions(
    { limit: 50, pillar: pillarFilter !== "all" ? pillarFilter as any : undefined },
    { query: { queryKey: getListAdminTransactionsQueryKey({ limit: 50, pillar: pillarFilter !== "all" ? pillarFilter as any : undefined }) } }
  );

  const [settlementFilter, setSettlementFilter] = useState<string>("all");
  const { data: settlements, isLoading: isLoadingSettlements } = useListAdminSettlements(
    { status: settlementFilter !== "all" ? settlementFilter as any : undefined },
    { query: { queryKey: getListAdminSettlementsQueryKey({ status: settlementFilter !== "all" ? settlementFilter as any : undefined }) } }
  );

  const { data: orgBalances, isLoading: isLoadingBalances } = useListOrgBalances({ query: { queryKey: getListOrgBalancesQueryKey() } });
  const { data: commissionConfigs, isLoading: isLoadingConfigs } = useListCommissionConfigs({ query: { queryKey: getListCommissionConfigsQueryKey() } });

  const formatCurrency = (amount: number, currency: string = "XAF") =>
    formatCurrencyValue(amount, currency, i18n.language.startsWith("fr") ? "fr-FR" : "en-US");
  const adminCurrencyStats = (stats?.byCurrency ?? []) as any[];
  const effectiveTrendCurrency = adminCurrencyStats.some((item) => item.currency === trendCurrency)
    ? trendCurrency
    : adminCurrencyStats[0]?.currency ?? "";
  const revenueTrend = ((stats?.revenueByDay ?? []) as any[])
    .filter((row) => row.currency === effectiveTrendCurrency);
  const pendingSettlementRows = (stats?.pendingSettlements ?? []) as any[];
  const availableOrgBalances = ((orgBalances ?? []) as any[])
    .filter((balance) => Number(balance.available_balance) > 0);

  const getSettlementBadge = (status: string) => {
    switch(status) {
      case 'pending_settlement': return <Badge variant="secondary" className="bg-slate-100 text-slate-800 hover:bg-slate-100">Pending</Badge>;
      case 'ready': return <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/25 hover:bg-primary/20 dark:bg-white/10 dark:text-white dark:border-white/20 dark:hover:bg-white/15">Ready</Badge>;
      case 'released': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Released</Badge>;
      case 'completed': return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Completed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const updateSettlement = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      customFetch(`${API_BASE}/api/admin/finance/settlements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAdminSettlementsQueryKey() });
      toast({ title: 'Settlement status updated' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || 'Failed to update settlement' }),
  });

  const [createSettlementSelection, setCreateSettlementSelection] = useState<string>("");
  const [createSettlementOpen, setCreateSettlementOpen] = useState(false);
  
  const createSettlement = useMutation({
    mutationFn: ({ orgId, currency }: { orgId: number; currency: string }) =>
      customFetch(`${API_BASE}/api/admin/finance/settlements`, {
        method: 'POST',
        body: JSON.stringify({ orgId, currency }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAdminSettlementsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListOrgBalancesQueryKey() });
      toast({ title: 'Settlement created' });
      setCreateSettlementOpen(false);
      setCreateSettlementSelection("");
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || 'Failed to create settlement' }),
  });

  const [editingConfigPillar, setEditingConfigPillar] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<string>("");

  const updateConfig = useMutation({
    mutationFn: ({ pillar, rate }: { pillar: string; rate: number }) =>
      customFetch(`${API_BASE}/api/admin/finance/commission-config/${pillar}`, {
        method: 'PATCH',
        body: JSON.stringify({ rate }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListCommissionConfigsQueryKey() });
      toast({ title: 'Commission configuration updated' });
      setEditingConfigPillar(null);
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || 'Failed to update config' }),
  });

  const handleAdminExport = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    window.open(`${base}/api/admin/finance/export`);
  };

  const kpis = [
    { label: 'Platform Revenue', field: 'total_platform_revenue', icon: Coins, accent: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Commission Collected', field: 'total_commission_collected', icon: Receipt, accent: 'text-primary dark:text-white', bg: 'bg-primary/10 dark:bg-white/10' },
    { label: 'Revenue Today', field: 'revenue_today', icon: TrendingUp, accent: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Revenue This Week', field: 'revenue_this_week', icon: Activity, accent: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Revenue This Month', field: 'revenue_this_month', icon: BarChart3, accent: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Total Transactions', value: stats?.total_transactions || 0, icon: BarChart3, accent: 'text-primary dark:text-white', bg: 'bg-primary/5 dark:bg-white/5', isCount: true },
  ];

  return (
    <div className="space-y-8">
      {/* Revenue KPI Cards */}
      <div className="flex items-center justify-between gap-4">
        <div />
        <Button onClick={handleAdminExport} variant="outline" size="sm" className="gap-2">
          <ArrowRight className="h-3.5 w-3.5" /> Export All Transactions
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => (
          <Card key={idx} className="border-border/50 shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                {kpi.label} <kpi.icon className={`h-4 w-4 ${kpi.accent}`} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-lg font-serif font-bold tabular-nums">
                {isLoadingStats ? <Skeleton className="h-8 w-20" /> : kpi.isCount ? kpi.value : (
                  adminCurrencyStats.length > 0
                    ? adminCurrencyStats.map((item) => (
                        <div key={item.currency}>{formatCurrency(Number(item[kpi.field!] ?? 0), item.currency)}</div>
                      ))
                    : formatCurrency(0)
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue by Pillar */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-serif">Revenue Trend (30 Days)</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-6 pl-0">
              <div className="h-64 w-full px-4">
                {isLoadingStats ? (
                  <div className="h-full flex items-end gap-3 px-6 pb-4">
                    {['h-20', 'h-32', 'h-24', 'h-40', 'h-28', 'h-36', 'h-18', 'h-30'].map((height, bar) => (
                      <Skeleton key={bar} className={`${height} flex-1`} />
                    ))}
                  </div>
                ) : !stats?.revenueByDay?.length ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No recent revenue data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.revenueByDay}>
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(val) => format(new Date(val), 'MMM d')} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#888' }} 
                        dy={10}
                      />
                      <YAxis
                        tickFormatter={(val) => formatCurrency(val)}
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#888' }} 
                        width={60}
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                        formatter={(val: number) => [formatCurrency(val), t("admin.revenue")]}
                        labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['events', 'elections', 'campaigns'].map(pillar => {
              const mapping: Record<string, string> = { events: 'event', elections: 'election', campaigns: 'campaign' };
              const pData = stats?.byPillar?.find((p: any) => p.pillar === mapping[pillar]) || { revenue: 0, commission: 0, count: 0 };
              const icons = {
                events: <CalendarDays className="h-5 w-5 text-emerald-600" />,
                elections: <Vote className="h-5 w-5 text-primary" />,
                campaigns: <Megaphone className="h-5 w-5 text-amber-600" />
              };
              return (
                <Card key={pillar} className="border-border/50 shadow-sm">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                        {icons[pillar as keyof typeof icons]}
                      </div>
                      <CardTitle className="text-sm font-medium capitalize">{pillar}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Revenue:</span>
                        <span className="font-medium">{formatCurrency(pData.revenue as number)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Commission:</span>
                        <span className="font-medium text-primary">{formatCurrency(pData.commission as number)}</span>
                      </div>
                      <div className="flex justify-between text-xs pt-2 border-t text-muted-foreground">
                        <span>Transactions:</span>
                        <span>{pData.count as number}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Commission Configs & Pending Settlements Summary */}
        <div className="space-y-6">
          <Card className="border-primary/20 shadow-sm bg-primary/5 dark:border-white/20 dark:bg-white/5">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base font-serif flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" /> Pending Settlements
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-serif font-bold text-primary tabular-nums">
                  {formatCurrency((stats?.pendingSettlements as any)?.total_amount || 0)}
                </span>
                <span className="text-sm text-muted-foreground">{(stats?.pendingSettlements as any)?.count || 0} batches awaiting payout</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base font-serif flex items-center gap-2">
                <Settings className="h-4 w-4" /> Commission Rates
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="pl-5">Pillar</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingConfigs ? (
                    [0, 1, 2].map((row) => (
                      <TableRow key={row}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="ml-auto h-7 w-7" /></TableCell>
                      </TableRow>
                    ))
                  ) : commissionConfigs?.map((conf: any) => (
                    <TableRow key={conf.pillar}>
                      <TableCell className="pl-5 font-medium capitalize text-sm">{conf.pillar}</TableCell>
                      <TableCell>
                        {editingConfigPillar === conf.pillar ? (
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number" 
                              value={editRate} 
                              onChange={e => setEditRate(e.target.value)} 
                              className="w-16 h-7 text-xs" 
                              step="0.1"
                              min="0" max="100"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="font-mono">{(conf.rate * 100).toFixed(1)}%</Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        {editingConfigPillar === conf.pillar ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingConfigPillar(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" className="h-7 w-7 p-0" disabled={updateConfig.isPending} onClick={() => updateConfig.mutate({ pillar: conf.pillar, rate: parseFloat(editRate) / 100 })}>
                              {updateConfig.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-xs h-7 text-primary" onClick={() => { setEditingConfigPillar(conf.pillar); setEditRate((conf.rate * 100).toString()); }}>
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Settlements Table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-serif">Settlements</CardTitle>
              <CardDescription className="mt-0.5">Manage payouts to organizations</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={settlementFilter} onValueChange={setSettlementFilter}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending_settlement">Pending</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              
              <Dialog open={createSettlementOpen} onOpenChange={setCreateSettlementOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9"><Plus className="mr-2 h-4 w-4" /> Create Settlement</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Settlement</DialogTitle>
                    <DialogDescription>Initiate a payout for an organization’s available balance in a selected currency. Payouts include the full available balance for that currency.</DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Select value={createSettlementSelection} onValueChange={setCreateSettlementSelection}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOrgBalances.map((ob: any) => (
                          <SelectItem key={`${ob.org_id}-${ob.currency}`} value={`${ob.org_id}:${ob.currency}`}>
                            {ob.org_name} — {formatCurrency(ob.available_balance || 0, ob.currency)}
                          </SelectItem>
                        ))}
                        {availableOrgBalances.length === 0 && (
                          <div className="p-4 text-sm text-center text-muted-foreground">No organizations have an available balance</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateSettlementOpen(false)}>Cancel</Button>
                    <Button
                      disabled={!createSettlementSelection || createSettlement.isPending}
                      onClick={() => {
                        const [rawOrgId, currency] = createSettlementSelection.split(":");
                        const orgId = Number.parseInt(rawOrgId, 10);
                        if (Number.isInteger(orgId) && currency) createSettlement.mutate({ orgId, currency });
                      }}
                    >
                      {createSettlement.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Create Settlement
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20">
                <TableHead className="w-16 text-center">ID</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingSettlements ? (
                [0, 1, 2, 3].map((row) => (
                  <TableRow key={row}>
                    {[0, 1, 2, 3, 4, 5, 6].map((cell) => (
                      <TableCell key={cell}><Skeleton className="h-4 w-full max-w-24" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !settlements?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No settlements found</TableCell></TableRow>
              ) : settlements.map((s: any) => (
                <TableRow key={s.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">#{s.id}</TableCell>
                  <TableCell className="font-medium">
                    <div>{s.organizationName}</div>
                    {s.payoutAccount && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {(s.payoutMethod || 'payout').replace('_', ' ')} · {s.payoutAccount}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(s.createdAt), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(s.amount, s.currency)}</TableCell>
                  <TableCell className="text-sm">{s.transactionCount}</TableCell>
                  <TableCell>{getSettlementBadge(s.status)}</TableCell>
                  <TableCell className="text-right">
                    {s.status === 'pending_settlement' && <Button size="sm" variant="outline" className="text-xs h-7" disabled={updateSettlement.isPending} onClick={() => updateSettlement.mutate({ id: s.id, status: 'ready' })}>Mark Ready</Button>}
                    {s.status === 'ready' && <Button size="sm" variant="default" className="text-xs h-7 bg-amber-500 hover:bg-amber-600 text-white" disabled={updateSettlement.isPending} onClick={() => updateSettlement.mutate({ id: s.id, status: 'released' })}>Release</Button>}
                    {s.status === 'released' && <Button size="sm" variant="default" className="text-xs h-7 bg-emerald-500 hover:bg-emerald-600 text-white" disabled={updateSettlement.isPending} onClick={() => updateSettlement.mutate({ id: s.id, status: 'completed' })}>Complete</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Organization Balances */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-serif">Organization Balances</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-right">Net Earnings</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Awaiting payout</TableHead>
                  <TableHead className="text-right">Released</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingBalances ? (
                  [0, 1, 2, 3].map((row) => (
                    <TableRow key={row}>
                      {[0, 1, 2, 3].map((cell) => (
                        <TableCell key={cell}><Skeleton className="h-4 w-full max-w-28" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : orgBalances?.slice(0, 15).map((ob: any) => (
                  <TableRow key={`${ob.org_id}-${ob.currency}`} className="hover:bg-muted/20">
                    <TableCell className="font-medium text-sm">{ob.org_name}</TableCell>
                    <TableCell className="text-right text-sm text-primary">{formatCurrency(ob.total_earnings || 0, ob.currency)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(ob.available_balance || 0, ob.currency)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(ob.pending_settlement_balance || 0, ob.currency)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(ob.released_balance || 0, ob.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Global Transaction Log */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-serif">Recent Transactions</CardTitle>
            <Select value={pillarFilter} onValueChange={setPillarFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
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
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>Org</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Comm.</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingTransactions ? (
                  [0, 1, 2, 3].map((row) => (
                    <TableRow key={row}>
                      {[0, 1, 2, 3, 4].map((cell) => (
                        <TableCell key={cell}><Skeleton className="h-4 w-full max-w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !transactionsData?.transactions?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No transactions</TableCell></TableRow>
                ) : transactionsData.transactions.slice(0, 15).map((tx: any) => (
                  <TableRow key={tx.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="font-medium text-sm truncate max-w-[120px]" title={tx.organizationName}>{tx.organizationName}</div>
                      <div className="text-[10px] text-muted-foreground">{format(new Date(tx.createdAt), 'MMM d, h:mm a')}</div>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{tx.pillar}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(tx.grossAmount, tx.currency)}</TableCell>
                    <TableCell className="text-right text-sm text-primary">{formatCurrency(tx.commissionAmount, tx.currency)}</TableCell>
                    <TableCell className="text-right">
                      {tx.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" /> : <Badge variant="outline" className="text-[10px] px-1 h-5">{tx.status}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
